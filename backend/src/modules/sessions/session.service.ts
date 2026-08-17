import type { EffectiveAccessService } from '../access/access.service.js';
import { randomUUID } from 'node:crypto';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors/app-error.js';
import type { EventService } from '../events/event.service.js';
import type { MembershipRepository } from '../memberships/membership.repository.js';
import type { SpeakerRepository } from '../speakers/speaker.repository.js';
import type { UserRepository } from '../users/user.repository.js';
import type { UserRole } from '../users/user.types.js';
import { buildFeedbackSummary } from './feedback/session-feedback.mapper.js';
import type { SessionFeedbackRepository } from './feedback/session-feedback.repository.js';
import { toPublicSession } from './session.mapper.js';
import type { PaginatedResult, SessionRepository } from './session.repository.js';
import type {
  CreateSessionInput,
  PublicSession,
  Session,
  SessionMaterial,
  SessionMaterialInput,
  SessionSpeakerSummary,
  ListSessionsQuery,
  UpdateSessionInput,
} from './session.types.js';

function normalizeMaterials(materials: SessionMaterialInput[] | undefined): SessionMaterial[] {
  return (materials ?? []).map((material) => ({
    id: material.id ?? randomUUID(),
    type: material.type,
    title: material.title.trim(),
    url: material.url.trim(),
  }));
}

export interface SessionViewerContext {
  userId: string;
  role: UserRole;
}

function isSessionAccessible(session: Session, membershipIds: string[]): boolean {
  const allowed = session.membershipIds ?? [];
  if (allowed.length === 0) return true;
  if (membershipIds.length === 0) return false;
  return membershipIds.some((id) => allowed.includes(id));
}

export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly speakers: SpeakerRepository,
    private readonly events: EventService,
    private readonly feedback: SessionFeedbackRepository,
    private readonly users?: UserRepository,
    private readonly memberships?: MembershipRepository,
    private readonly access?: EffectiveAccessService,
  ) {}

  async list(
    query: ListSessionsQuery,
    viewer?: SessionViewerContext,
  ): Promise<PaginatedResult<PublicSession>> {
    let listQuery = query;

    if (viewer) {
      const ids = await this.resolveAccessibleMembershipIds(viewer.userId, query.eventId);
      // Members always; speakers/sponsors only when they also hold a membership.
      if (viewer.role === 'member' || ids.length > 0) {
        listQuery = { ...query, accessibleToMembershipIds: ids };
      }
    }

    const { items, total } = await this.sessions.list(listQuery);
    const mapped = await Promise.all(items.map((session) => this.toPublic(session)));
    return { items: mapped, total };
  }

  async getById(id: string, viewer?: SessionViewerContext): Promise<PublicSession> {
    const session = await this.requireSession(id);

    if (viewer) {
      const ids = await this.resolveAccessibleMembershipIds(viewer.userId, session.eventId);
      if (viewer.role === 'member' || ids.length > 0) {
        if (!isSessionAccessible(session, ids)) {
          throw new ForbiddenError('You do not have access to this session');
        }
      }
    }

    return this.toPublic(session);
  }

  async create(input: CreateSessionInput): Promise<PublicSession> {
    await this.events.requireEvent(input.eventId);
    const kind = input.kind ?? 'session';
    const speakerId = kind === 'session' ? (input.speakerId ?? null) : null;
    if (kind === 'session' && !speakerId) {
      throw new BadRequestError('Select a speaker');
    }
    if (speakerId) {
      await this.requireSpeakerForEvent(speakerId, input.eventId);
    }
    await this.assertValidEventDay(input.eventId, input.eventDayNumber);
    await this.assertMembershipsForEvent(input.membershipIds ?? [], input.eventId);

    const created = await this.sessions.create({
      eventId: input.eventId,
      kind,
      name: input.name,
      description: input.description ?? '',
      speakerId,
      address: input.address ?? '',
      eventDayNumber: input.eventDayNumber,
      startTime: input.startTime ?? '',
      endTime: input.endTime ?? '',
      location: input.location ?? '',
      membershipIds: input.membershipIds ?? [],
      materials: kind === 'session' ? normalizeMaterials(input.materials) : [],
      feedbackEnabled: kind === 'session' ? (input.feedbackEnabled ?? true) : false,
    });

    return this.toPublic(created);
  }

  async update(id: string, input: UpdateSessionInput): Promise<PublicSession> {
    const existing = await this.requireSession(id);

    const kind = input.kind ?? existing.kind;
    const speakerId =
      kind === 'event'
        ? null
        : input.speakerId !== undefined
          ? input.speakerId
          : existing.speakerId;
    const eventDayNumber = input.eventDayNumber ?? existing.eventDayNumber;

    if (kind === 'session' && !speakerId) {
      throw new BadRequestError('Select a speaker');
    }
    if (speakerId && input.speakerId !== undefined) {
      await this.requireSpeakerForEvent(speakerId, existing.eventId);
    }
    if (input.eventDayNumber !== undefined) {
      await this.assertValidEventDay(existing.eventId, eventDayNumber);
    }
    if (input.membershipIds !== undefined) {
      await this.assertMembershipsForEvent(input.membershipIds, existing.eventId);
    }

    const updated = await this.sessions.update(id, {
      ...(input.kind !== undefined ? { kind } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.kind !== undefined || input.speakerId !== undefined ? { speakerId } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.eventDayNumber !== undefined ? { eventDayNumber } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.membershipIds !== undefined ? { membershipIds: input.membershipIds } : {}),
      ...(input.materials !== undefined && kind === 'session'
        ? { materials: normalizeMaterials(input.materials) }
        : {}),
      ...(input.kind === 'event' ? { materials: [], feedbackEnabled: false } : {}),
      ...(input.feedbackEnabled !== undefined && kind === 'session'
        ? { feedbackEnabled: input.feedbackEnabled }
        : {}),
    });

    if (!updated) throw new NotFoundError('Session');
    return this.toPublic(updated);
  }

  async delete(id: string): Promise<void> {
    if (!(await this.sessions.delete(id))) {
      throw new NotFoundError('Session');
    }
    await this.feedback.deleteBySession(id);
  }

  private async resolveAccessibleMembershipIds(
    userId: string,
    eventId?: string,
  ): Promise<string[]> {
    if (this.access) {
      const resolved = await this.access.resolveForUser(userId, eventId);
      return resolved.accessibleMembershipIds;
    }
    if (!this.users) return [];
    const user = await this.users.findById(userId);
    return user?.membershipId ? [user.membershipId] : [];
  }

  private async resolveMembershipId(userId: string): Promise<string | null> {
    if (!this.users) return null;
    const user = await this.users.findById(userId);
    return user?.membershipId ?? null;
  }

  private async toPublic(session: Session): Promise<PublicSession> {
    const speaker = session.speakerId
      ? await this.speakers.findById(session.speakerId)
      : null;
    const summary: SessionSpeakerSummary | null = speaker
      ? {
          id: speaker.id,
          name: speaker.name,
          title: speaker.title,
          photo: speaker.photo,
        }
      : null;

    const items = await this.feedback.listAllBySession(session.id);
    const feedbackSummary = buildFeedbackSummary(session.id, items);

    return toPublicSession(session, summary, {
      averageRating: feedbackSummary.averageRating,
      ratingsCount: feedbackSummary.ratingsCount,
    });
  }

  private async requireSession(id: string): Promise<Session> {
    const session = await this.sessions.findById(id);
    if (!session) throw new NotFoundError('Session');
    // Legacy docs may omit membershipIds / feedbackEnabled.
    return {
      ...session,
      kind: session.kind ?? 'session',
      address: session.address ?? '',
      speakerId: session.speakerId ?? null,
      membershipIds: session.membershipIds ?? [],
      materials: session.materials ?? [],
      feedbackEnabled: session.kind === 'event' ? false : session.feedbackEnabled !== false,
    };
  }

  private async requireSpeakerForEvent(speakerId: string, eventId: string): Promise<void> {
    const speaker = await this.speakers.findById(speakerId);
    if (!speaker) throw new BadRequestError('Selected speaker was not found');
    if (speaker.eventId !== eventId) {
      throw new BadRequestError('Speaker must belong to the same event edition');
    }
  }

  private async assertMembershipsForEvent(
    membershipIds: string[],
    eventId: string,
  ): Promise<void> {
    if (membershipIds.length === 0) return;
    if (!this.memberships) return;
    for (const membershipId of membershipIds) {
      const membership = await this.memberships.findById(membershipId);
      if (!membership) {
        throw new BadRequestError('Selected membership was not found');
      }
      if (membership.eventId !== eventId) {
        throw new BadRequestError('Membership must belong to the same event edition');
      }
    }
  }

  private async assertValidEventDay(eventId: string, dayNumber: number): Promise<void> {
    const event = await this.events.getById(eventId);
    const exists = event.days.some((day) => day.dayNumber === dayNumber);
    if (!exists) {
      throw new BadRequestError(
        `Day ${dayNumber} is not part of this event edition’s schedule`,
      );
    }
  }
}
