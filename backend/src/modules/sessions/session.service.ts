import type { EffectiveAccessService } from '../access/access.service.js';
import { randomUUID } from 'node:crypto';
import { BadRequestError, NotFoundError } from '../../core/errors/app-error.js';
import type { EventAssociationService } from '../event-associations/event-association.service.js';
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
  SessionKind,
  SessionMaterial,
  SessionMaterialInput,
  SessionSpeakerSummary,
  ListSessionsQuery,
  UpdateSessionInput,
} from './session.types.js';
import {
  findScheduleConflict,
  scheduleConflictMessage,
} from './session-schedule.js';

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
  /** When set, the viewer may manage sessions assigned to this speaker. */
  speakerId?: string | null;
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
    private readonly associations?: EventAssociationService,
  ) {}

  async list(
    query: ListSessionsQuery,
    viewer?: SessionViewerContext,
  ): Promise<PaginatedResult<PublicSession>> {
    const { items, total } = await this.sessions.list(query);
    // Resolve attendee feature access per edition — never reuse the preferred/current
    // event's locks for sessions that belong to other editions.
    const accessByEvent = new Map<
      string,
      {
        featureAccess: Awaited<ReturnType<EffectiveAccessService['resolveForUser']>> | null;
        accessibleIds: string[];
      }
    >();

    const mapped = await Promise.all(
      items.map(async (session) => {
        if (this.isSpeakerOwner(session, viewer) || viewer?.role === 'admin') {
          return this.toPublic(session, {
            accessRestricted: false,
            agendaLocked: false,
            materialsLocked: false,
            reviewsLocked: false,
          });
        }

        if (!viewer) {
          return this.toPublic(session);
        }

        let cached = accessByEvent.get(session.eventId);
        if (!cached) {
          const featureAccess = await this.resolveFeatureAccess(viewer.userId, session.eventId);
          const accessibleIds =
            featureAccess?.accessibleMembershipIds ??
            (await this.resolveAccessibleMembershipIds(viewer.userId, session.eventId));
          cached = { featureAccess, accessibleIds };
          accessByEvent.set(session.eventId, cached);
        }

        return this.toPublic(
          session,
          this.buildLocks(session, cached.accessibleIds, viewer, cached.featureAccess),
        );
      }),
    );
    return { items: mapped, total };
  }

  async getById(id: string, viewer?: SessionViewerContext): Promise<PublicSession> {
    const session = await this.requireSession(id);
    if (this.isSpeakerOwner(session, viewer) || viewer?.role === 'admin') {
      return this.toPublic(session, {
        accessRestricted: false,
        agendaLocked: false,
        materialsLocked: false,
        reviewsLocked: false,
      });
    }
    const featureAccess = viewer
      ? await this.resolveFeatureAccess(viewer.userId, session.eventId)
      : null;
    const accessibleIds = featureAccess?.accessibleMembershipIds
      ?? (viewer
        ? await this.resolveAccessibleMembershipIds(viewer.userId, session.eventId)
        : []);
    return this.toPublic(
      session,
      this.buildLocks(session, accessibleIds, viewer, featureAccess),
    );
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

    const startTime = input.startTime ?? '';
    const endTime = input.endTime ?? '';
    await this.assertNoScheduleConflict(
      {
        eventId: input.eventId,
        eventDayNumber: input.eventDayNumber,
        startTime,
        endTime,
        kind,
      },
    );

    const created = await this.sessions.create({
      eventId: input.eventId,
      kind,
      name: input.name,
      description: input.description ?? '',
      speakerId,
      address: input.address ?? '',
      eventDayNumber: input.eventDayNumber,
      startTime,
      endTime,
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
    const startTime = input.startTime ?? existing.startTime;
    const endTime = input.endTime ?? existing.endTime;

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

    await this.assertNoScheduleConflict(
      {
        eventId: existing.eventId,
        eventDayNumber,
        startTime,
        endTime,
        kind,
      },
      existing.id,
    );

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

  private async resolveFeatureAccess(userId: string, eventId?: string) {
    if (!this.access) return null;
    return this.access.resolveForUser(userId, eventId);
  }

  private isSpeakerOwner(session: Session, viewer?: SessionViewerContext): boolean {
    return Boolean(
      viewer?.speakerId && session.speakerId && viewer.speakerId === session.speakerId,
    );
  }

  private buildLocks(
    session: Session,
    accessibleIds: string[],
    viewer: SessionViewerContext | undefined,
    featureAccess: Awaited<ReturnType<EffectiveAccessService['resolveForUser']>> | null,
  ) {
    if (this.isSpeakerOwner(session, viewer) || viewer?.role === 'admin') {
      return {
        accessRestricted: false,
        agendaLocked: false,
        materialsLocked: false,
        reviewsLocked: false,
      };
    }
    const accessRestricted = this.isAccessRestricted(session, accessibleIds, viewer);
    return {
      accessRestricted,
      agendaLocked: featureAccess ? !featureAccess.viewAgenda : false,
      materialsLocked: featureAccess ? !featureAccess.viewMaterials : false,
      reviewsLocked: featureAccess ? !featureAccess.submitReviews : false,
    };
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

  private async toPublic(
    session: Session,
    locks: boolean | {
      accessRestricted?: boolean;
      materialsLocked?: boolean;
      reviewsLocked?: boolean;
      agendaLocked?: boolean;
    } = false,
  ): Promise<PublicSession> {
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
    }, locks);
  }

  private isAccessRestricted(
    session: Session,
    accessibleIds: string[],
    viewer?: SessionViewerContext,
  ): boolean {
    const allowed = session.membershipIds ?? [];
    if (allowed.length === 0) return false;
    if (!viewer) return false;
    if (viewer.role === 'admin') return false;
    if (viewer.role !== 'member' && accessibleIds.length === 0) return false;
    return !isSessionAccessible(session, accessibleIds);
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

  /**
   * Speakers live in a shared library. Assigning one to a session links them to the
   * edition automatically — no separate event-level speaker association step.
   */
  private async requireSpeakerForEvent(speakerId: string, eventId: string): Promise<void> {
    const speaker = await this.speakers.findById(speakerId);
    if (!speaker) throw new BadRequestError('Selected speaker was not found');
    if (speaker.eventId === eventId) return;
    if (this.associations) {
      await this.associations.linkSpeaker(eventId, speakerId);
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
      if (membership.eventId === eventId) continue;
      if (
        this.associations &&
        (await this.associations.isMembershipLinked(eventId, membershipId))
      ) {
        continue;
      }
      throw new BadRequestError('Membership must be associated with this event edition');
    }
  }

  private async assertNoScheduleConflict(
    candidate: {
      eventId: string;
      eventDayNumber: number;
      startTime: string;
      endTime: string;
      kind: SessionKind;
    },
    excludeId?: string,
  ): Promise<void> {
    const { items } = await this.sessions.list({
      eventId: candidate.eventId,
      eventDayNumber: candidate.eventDayNumber,
      page: 1,
      perPage: 500,
    });

    const conflict = findScheduleConflict(candidate, items, excludeId);
    if (conflict) {
      throw new BadRequestError(scheduleConflictMessage(conflict));
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
