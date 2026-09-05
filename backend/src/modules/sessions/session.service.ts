import type { AnnouncementService } from '../announcements/announcement.service.js';
import type { EffectiveAccessService } from '../access/access.service.js';
import type { MembershipPurchaseRepository } from '../checkout/purchase.repository.js';
import { randomUUID } from 'node:crypto';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors/app-error.js';
import { logger } from '../../core/logger.js';
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
  /** When set, the viewer may manage sessions on events linked to this speaker. */
  speakerId?: string | null;
}

function isSessionAccessible(session: Session, membershipIds: string[]): boolean {
  const allowed = session.membershipIds ?? [];
  if (allowed.length === 0) return true;
  if (membershipIds.length === 0) return false;
  return membershipIds.some((id) => allowed.includes(id));
}

function formatSessionTimeRange(startTime: string, endTime: string): string {
  const start = startTime.trim();
  const end = endTime.trim();
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

function sessionUpdateFingerprint(session: Session): string {
  return [
    session.kind,
    session.name,
    session.eventDayNumber,
    session.startTime,
    session.endTime,
    session.location,
    session.address,
    session.description,
    (session.membershipIds ?? []).slice().sort().join(','),
  ].join('|');
}

function buildSessionChangeSummary(before: Session, after: Session): string | null {
  const parts: string[] = [];

  if (before.name !== after.name) {
    parts.push(`Renamed to “${after.name}”`);
  }
  if (before.eventDayNumber !== after.eventDayNumber) {
    parts.push(`Now on Day ${after.eventDayNumber}`);
  }
  const beforeTime = formatSessionTimeRange(before.startTime, before.endTime);
  const afterTime = formatSessionTimeRange(after.startTime, after.endTime);
  if (beforeTime !== afterTime) {
    parts.push(afterTime ? `Time: ${afterTime}` : 'Time cleared');
  }
  if (before.location.trim() !== after.location.trim()) {
    parts.push(after.location.trim() ? `Location: ${after.location.trim()}` : 'Location cleared');
  }
  if (before.address.trim() !== after.address.trim()) {
    parts.push(after.address.trim() ? 'Address updated' : 'Address cleared');
  }
  if (before.description.trim() !== after.description.trim()) {
    parts.push('Description updated');
  }
  const beforeMemberships = (before.membershipIds ?? []).slice().sort().join(',');
  const afterMemberships = (after.membershipIds ?? []).slice().sort().join(',');
  if (beforeMemberships !== afterMemberships) {
    parts.push('Membership access updated');
  }
  if (before.kind !== after.kind) {
    parts.push(after.kind === 'event' ? 'Now listed as an extra activity' : 'Now listed as a session');
  }

  if (parts.length === 0) return null;
  return `${parts.join('. ')}. Open the app for the full agenda.`;
}

function isMaterialsOrFeedbackOnlyUpdate(input: UpdateSessionInput): boolean {
  const keys = Object.keys(input).filter((key) => key !== 'notifyAttendees');
  if (keys.length === 0) return true;
  return keys.every((key) => key === 'materials' || key === 'feedbackEnabled');
}

export class SessionService {
  private announcements: AnnouncementService | null = null;
  private purchases: MembershipPurchaseRepository | null = null;

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

  setAnnouncementService(service: AnnouncementService): void {
    this.announcements = service;
  }

  setPurchaseRepository(repository: MembershipPurchaseRepository): void {
    this.purchases = repository;
  }

  async list(
    query: ListSessionsQuery,
    viewer?: SessionViewerContext,
  ): Promise<PaginatedResult<PublicSession>> {
    const { items, total } = await this.sessions.list(query);
    const speakerEventIds = viewer?.speakerId
      ? await this.resolveSpeakerEventIds(viewer.speakerId)
      : null;
    const accessByEvent = new Map<
      string,
      {
        featureAccess: Awaited<ReturnType<EffectiveAccessService['resolveForUser']>> | null;
        accessibleIds: string[];
      }
    >();

    const mapped = await Promise.all(
      items.map(async (session) => {
        if (this.isSpeakerForEvent(session.eventId, speakerEventIds) || viewer?.role === 'admin') {
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
          this.buildLocks(session, cached.accessibleIds, viewer, cached.featureAccess, speakerEventIds),
        );
      }),
    );
    return { items: mapped, total };
  }

  async getById(id: string, viewer?: SessionViewerContext): Promise<PublicSession> {
    const session = await this.requireSession(id);
    const speakerEventIds = viewer?.speakerId
      ? await this.resolveSpeakerEventIds(viewer.speakerId)
      : null;
    if (this.isSpeakerForEvent(session.eventId, speakerEventIds) || viewer?.role === 'admin') {
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
      this.buildLocks(session, accessibleIds, viewer, featureAccess, speakerEventIds),
    );
  }

  async create(input: CreateSessionInput): Promise<PublicSession> {
    await this.events.requireEvent(input.eventId);
    const kind = input.kind ?? 'session';
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
    const eventDayNumber = input.eventDayNumber ?? existing.eventDayNumber;
    const startTime = input.startTime ?? existing.startTime;
    const endTime = input.endTime ?? existing.endTime;

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

    if (input.notifyAttendees) {
      void this.notifyAttendeesSessionUpdated(existing, updated, input);
    }

    return this.toPublic(updated);
  }

  async delete(id: string): Promise<void> {
    if (!(await this.sessions.delete(id))) {
      throw new NotFoundError('Session');
    }
    await this.feedback.deleteBySession(id);
  }

  /** Speakers may manage session content on events they are linked to. */
  async assertSpeakerCanManageSession(speakerId: string, sessionId: string): Promise<void> {
    const session = await this.requireSession(sessionId);
    const eventIds = await this.resolveSpeakerEventIds(speakerId);
    if (!eventIds.has(session.eventId)) {
      throw new ForbiddenError('You can only update sessions for your linked events');
    }
  }

  private async resolveFeatureAccess(userId: string, eventId?: string) {
    if (!this.access) return null;
    return this.access.resolveForUser(userId, eventId);
  }

  private async resolveSpeakerEventIds(speakerId: string): Promise<Set<string>> {
    const ids = new Set<string>();
    const speaker = await this.speakers.findById(speakerId);
    if (speaker?.eventId) ids.add(speaker.eventId);
    if (this.associations) {
      for (const eventId of await this.associations.listEventIdsForSpeaker(speakerId)) {
        ids.add(eventId);
      }
    }
    return ids;
  }

  private isSpeakerForEvent(eventId: string, speakerEventIds: Set<string> | null): boolean {
    return Boolean(speakerEventIds?.has(eventId));
  }

  private buildLocks(
    session: Session,
    accessibleIds: string[],
    viewer: SessionViewerContext | undefined,
    featureAccess: Awaited<ReturnType<EffectiveAccessService['resolveForUser']>> | null,
    speakerEventIds: Set<string> | null,
  ) {
    if (this.isSpeakerForEvent(session.eventId, speakerEventIds) || viewer?.role === 'admin') {
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

  private async toPublic(
    session: Session,
    locks: boolean | {
      accessRestricted?: boolean;
      materialsLocked?: boolean;
      reviewsLocked?: boolean;
      agendaLocked?: boolean;
    } = false,
  ): Promise<PublicSession> {
    const items = await this.feedback.listAllBySession(session.id);
    const feedbackSummary = buildFeedbackSummary(session.id, items);

    return toPublicSession(session, {
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
    // Legacy docs may omit membershipIds / feedbackEnabled / still include speakerId.
    return {
      id: session.id,
      eventId: session.eventId,
      kind: session.kind ?? 'session',
      name: session.name,
      description: session.description,
      address: session.address ?? '',
      eventDayNumber: session.eventDayNumber,
      startTime: session.startTime,
      endTime: session.endTime,
      location: session.location,
      membershipIds: session.membershipIds ?? [],
      materials: session.materials ?? [],
      feedbackEnabled: session.kind === 'event' ? false : session.feedbackEnabled !== false,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  private async notifyAttendeesSessionUpdated(
    before: Session,
    after: Session,
    input: UpdateSessionInput,
  ): Promise<void> {
    if (!this.announcements || !this.purchases) {
      logger.warn(
        { sessionId: after.id, hasAnnouncements: Boolean(this.announcements), hasPurchases: Boolean(this.purchases) },
        'Session update notify skipped: announcements or purchases not wired',
      );
      return;
    }
    if (isMaterialsOrFeedbackOnlyUpdate(input)) {
      logger.info({ sessionId: after.id }, 'Session update notify skipped: materials/feedback only');
      return;
    }

    const summary = buildSessionChangeSummary(before, after);
    if (!summary) {
      logger.info({ sessionId: after.id }, 'Session update notify skipped: no schedule/content changes detected');
      return;
    }

    try {
      const userIds = await this.purchases.listPaidUserIdsByEvent(after.eventId);
      if (userIds.length === 0) {
        logger.info({ sessionId: after.id, eventId: after.eventId }, 'Session update notify skipped: no paid purchasers');
        return;
      }

      const event = await this.events.getById(after.eventId);
      const label = after.kind === 'event' ? 'Activity' : 'Session';
      const systemKey = `session:update:${after.id}:${sessionUpdateFingerprint(before)}=>${sessionUpdateFingerprint(after)}`;

      await this.announcements.publishSessionUpdateNotice({
        systemKey,
        title: `${label} updated: ${after.name}`,
        description: `${event.name} — ${summary}`,
        userIds,
      });
    } catch (error) {
      logger.error(
        { err: error, sessionId: after.id, eventId: after.eventId },
        'Failed to notify attendees about session update',
      );
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
