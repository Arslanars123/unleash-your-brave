import { env } from '../../config/env.js';
import { formatEditionRange } from '../../core/format-date.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../core/errors/app-error.js';
import { logger } from '../../core/logger.js';
import type { EventAssociationService } from '../event-associations/event-association.service.js';
import type { EventService } from '../events/event.service.js';
import type { MailService } from '../mail/mail.service.js';
import type { SessionRepository } from '../sessions/session.repository.js';
import type { UserService } from '../users/user.service.js';
import type { PaginatedResult, SpeakerRepository } from './speaker.repository.js';
import { toPublicSpeaker } from './speaker.mapper.js';
import type {
  CreateSpeakerInput,
  LinkedSpeakerEvent,
  ListSpeakersQuery,
  PublicSpeaker,
  Speaker,
  UpdateSpeakerInput,
} from './speaker.types.js';

export class SpeakerService {
  private associations: EventAssociationService | null = null;
  private sessions: SessionRepository | null = null;

  constructor(
    private readonly speakers: SpeakerRepository,
    private readonly events: EventService,
    private readonly users: UserService,
    private readonly mail: MailService,
  ) {}

  setAssociationService(service: EventAssociationService): void {
    this.associations = service;
  }

  setSessionRepository(sessions: SessionRepository): void {
    this.sessions = sessions;
  }

  async list(query: ListSpeakersQuery): Promise<PaginatedResult<PublicSpeaker>> {
    if (query.eventId && this.associations) {
      const linkedIds = await this.associations.listSpeakerIds(query.eventId);
      const legacy = await this.speakers.list({
        page: 1,
        perPage: 500,
        eventId: query.eventId,
        search: query.search,
      });
      const byId = new Map<string, Speaker>();
      for (const speaker of await this.speakers.listByIds(linkedIds)) {
        byId.set(speaker.id, speaker);
      }
      for (const speaker of legacy.items) {
        byId.set(speaker.id, speaker);
      }

      let items = this.dedupeByEmail([...byId.values()]);
      if (query.search?.trim()) {
        const search = query.search.trim().toLowerCase();
        items = items.filter(
          (speaker) =>
            speaker.name.toLowerCase().includes(search) ||
            speaker.email.toLowerCase().includes(search) ||
            speaker.title.toLowerCase().includes(search) ||
            speaker.description.toLowerCase().includes(search),
        );
      }
      items.sort((a, b) => a.name.localeCompare(b.name));
      const total = items.length;
      const start = (query.page - 1) * query.perPage;
      const pageItems = items.slice(start, start + query.perPage);
      return {
        items: await Promise.all(
          pageItems.map(async (speaker) =>
            toPublicSpeaker(speaker, await this.listEventIds(speaker)),
          ),
        ),
        total,
      };
    }

    const fetched = await this.speakers.list({
      page: 1,
      perPage: 500,
      search: query.search,
    });
    const deduped = this.dedupeByEmail(fetched.items);
    const total = deduped.length;
    const start = (query.page - 1) * query.perPage;
    const pageItems = deduped.slice(start, start + query.perPage);
    return {
      items: await Promise.all(
        pageItems.map(async (speaker) =>
          toPublicSpeaker(speaker, await this.listEventIds(speaker)),
        ),
      ),
      total,
    };
  }

  async getById(id: string): Promise<PublicSpeaker> {
    const speaker = await this.requireSpeaker(id);
    return toPublicSpeaker(speaker, await this.listEventIds(speaker));
  }

  async create(input: CreateSpeakerInput): Promise<PublicSpeaker> {
    const eventIds = await this.normalizeAndValidateEventIds(input);
    const email = input.email?.trim().toLowerCase() ?? '';

    if (email) {
      const existing = await this.consolidateByEmail(email);
      if (existing) {
        return this.linkExistingSpeakerToEvents(existing, eventIds, {
          name: input.name,
          title: input.title ?? existing.title,
          description: input.description ?? existing.description,
          photo: input.photo ?? existing.photo,
          sendPortalInvite: true,
        });
      }
    }

    const primaryEventId = eventIds[0]!;
    const created = await this.speakers.create({
      eventId: primaryEventId,
      name: input.name,
      email,
      title: input.title ?? '',
      description: input.description ?? '',
      photo: input.photo ?? '',
    });

    const linked: string[] = [];
    for (const eventId of eventIds) {
      await this.linkSpeakerToEvent(created.id, eventId);
      linked.push(eventId);
    }

    if (email) {
      await this.provisionPortalAccount(created, email, true);
    }
    for (const eventId of linked) {
      await this.notifyAssignedToEvent(created.id, eventId);
    }

    return toPublicSpeaker(created, linked);
  }

  async update(id: string, input: UpdateSpeakerInput): Promise<PublicSpeaker> {
    const existing = await this.requireSpeaker(id);
    const wantsEventSync =
      input.eventIds !== undefined || input.eventId !== undefined;

    let nextEmail =
      input.email !== undefined ? input.email.trim().toLowerCase() : existing.email;
    if (input.email !== undefined && nextEmail) {
      const clash = await this.consolidateByEmail(nextEmail);
      if (clash && clash.id !== id) {
        throw new ConflictError('That email already belongs to another speaker');
      }
    }

    const updated = await this.speakers.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: nextEmail } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.photo !== undefined ? { photo: input.photo } : {}),
    });
    if (!updated) throw new NotFoundError('Speaker');

    let eventIds = await this.listEventIds(updated);

    if (wantsEventSync) {
      const nextEventIds = await this.normalizeAndValidateEventIds(input);
      const previous = new Set(eventIds);
      const next = new Set(nextEventIds);
      const added = nextEventIds.filter((eventId) => !previous.has(eventId));
      const removed = eventIds.filter((eventId) => !next.has(eventId));

      for (const eventId of added) {
        await this.linkSpeakerToEvent(id, eventId);
      }
      for (const eventId of removed) {
        await this.unlinkSpeakerFromEvent(id, eventId);
      }

      const primaryEventId = nextEventIds[0]!;
      if (updated.eventId !== primaryEventId) {
        await this.speakers.update(id, { eventId: primaryEventId });
      }

      eventIds = nextEventIds;

      for (const eventId of added) {
        await this.notifyAssignedToEvent(id, eventId);
      }
      for (const eventId of removed) {
        await this.notifyRemovedFromEvent(id, eventId, updated);
      }
    }

    const email = nextEmail.trim();
    if (email && (input.email !== undefined || input.name !== undefined)) {
      const fresh = (await this.speakers.findById(id)) ?? updated;
      await this.provisionPortalAccount(fresh, email, true);
    }

    const fresh = (await this.speakers.findById(id)) ?? updated;
    return toPublicSpeaker(fresh, eventIds);
  }

  async delete(id: string): Promise<void> {
    const speaker = await this.requireSpeaker(id);
    const eventIds = await this.listEventIds(speaker);

    if (this.associations) {
      await this.associations.purgeSpeakerLinks(id);
    }

    for (const eventId of eventIds) {
      await this.notifyRemovedFromEvent(id, eventId, speaker);
    }

    await this.users.clearSpeakerPortalLink(id);
    if (!(await this.speakers.delete(id))) {
      throw new NotFoundError('Speaker');
    }
  }

  async assertLinkedToEvent(speakerId: string, eventId: string): Promise<void> {
    const eventIds = await this.collectEventIdsForSpeaker(speakerId);
    if (eventIds.has(eventId)) return;
    throw new BadRequestError('Speaker must be associated with this event edition');
  }

  /**
   * Editions where this speaker is linked (home eventId and/or associations),
   * including sibling profiles that share the same portal email (legacy).
   */
  async listLinkedEvents(speakerId: string): Promise<LinkedSpeakerEvent[]> {
    await this.requireSpeaker(speakerId);

    const eventIds = await this.collectEventIdsForSpeaker(speakerId);

    const results: LinkedSpeakerEvent[] = [];
    for (const eventId of eventIds) {
      try {
        const event = await this.events.getById(eventId);
        let sessionCount = 0;
        if (this.sessions) {
          const { total } = await this.sessions.list({
            eventId,
            page: 1,
            perPage: 1,
          });
          sessionCount = total;
        }
        results.push({
          id: event.id,
          name: event.name,
          startDate: event.startDate,
          endDate: event.endDate,
          status: event.status,
          sessionCount,
        });
      } catch {
        // Skip deleted / missing events.
      }
    }
    results.sort((a, b) => b.startDate.localeCompare(a.startDate));
    return results;
  }

  /** Email when this speaker is newly linked to an event edition. */
  async notifyAssignedToEvent(speakerId: string, eventId: string): Promise<void> {
    try {
      const speaker = await this.speakers.findById(speakerId);
      const email = speaker?.email?.trim().toLowerCase();
      if (!speaker || !email) return;
      const event = await this.events.getById(eventId);
      await this.mail.sendSpeakerEventAssigned({
        to: email,
        name: speaker.name,
        eventName: `${event.name} (${formatEditionRange(event.startDate, event.endDate)})`,
      });
    } catch (error) {
      logger.error(
        { err: error, speakerId, eventId },
        'Failed to send speaker event assignment email',
      );
    }
  }

  async notifyRemovedFromEvent(
    speakerId: string,
    eventId: string,
    speakerSnapshot?: Speaker,
  ): Promise<void> {
    try {
      const speaker = speakerSnapshot ?? (await this.speakers.findById(speakerId));
      const email = speaker?.email?.trim().toLowerCase();
      if (!speaker || !email) return;
      const event = await this.events.getById(eventId);
      await this.mail.sendSpeakerEventRemoved({
        to: email,
        name: speaker.name,
        eventName: `${event.name} (${formatEditionRange(event.startDate, event.endDate)})`,
      });
    } catch (error) {
      logger.error(
        { err: error, speakerId, eventId },
        'Failed to send speaker event removal email',
      );
    }
  }

  private async linkExistingSpeakerToEvents(
    existing: Speaker,
    eventIds: string[],
    patch: {
      name: string;
      title: string;
      description: string;
      photo: string;
      sendPortalInvite: boolean;
    },
  ): Promise<PublicSpeaker> {
    const current = new Set(await this.listEventIds(existing));
    const toAdd = eventIds.filter((eventId) => !current.has(eventId));
    if (toAdd.length === 0) {
      throw new ConflictError(
        'This speaker is already associated with the selected event(s)',
      );
    }

    const updated =
      (await this.speakers.update(existing.id, {
        name: patch.name,
        title: patch.title,
        description: patch.description,
        photo: patch.photo,
        email: existing.email,
        ...(existing.eventId ? {} : { eventId: toAdd[0] }),
      })) ?? existing;

    for (const eventId of toAdd) {
      await this.linkSpeakerToEvent(existing.id, eventId);
    }

    if (patch.sendPortalInvite && updated.email.trim()) {
      await this.provisionPortalAccount(updated, updated.email, true);
    }
    for (const eventId of toAdd) {
      await this.notifyAssignedToEvent(existing.id, eventId);
    }

    const fresh = (await this.speakers.findById(existing.id)) ?? updated;
    return toPublicSpeaker(fresh, await this.listEventIds(fresh));
  }

  private async normalizeAndValidateEventIds(input: {
    eventId?: string;
    eventIds?: string[];
  }): Promise<string[]> {
    const raw = [
      ...(input.eventIds ?? []),
      ...(input.eventId ? [input.eventId] : []),
    ]
      .map((id) => id.trim())
      .filter(Boolean);
    const unique = [...new Set(raw)];
    if (unique.length === 0) {
      throw new BadRequestError('Select at least one event');
    }
    for (const eventId of unique) {
      await this.events.requireEvent(eventId);
    }
    return unique;
  }

  private async linkSpeakerToEvent(speakerId: string, eventId: string): Promise<void> {
    if (!this.associations) {
      await this.speakers.update(speakerId, { eventId });
      return;
    }
    await this.associations.linkSpeaker(eventId, speakerId);
    const speaker = await this.speakers.findById(speakerId);
    if (speaker && !speaker.eventId) {
      await this.speakers.update(speakerId, { eventId });
    }
  }

  private async unlinkSpeakerFromEvent(
    speakerId: string,
    eventId: string,
  ): Promise<void> {
    if (this.associations) {
      try {
        await this.associations.unlinkSpeaker(eventId, speakerId);
      } catch {
        // Legacy home-only link may not have an association row.
      }
    }
    const speaker = await this.speakers.findById(speakerId);
    if (speaker?.eventId === eventId) {
      const remaining: string[] = [];
      if (this.associations) {
        remaining.push(...(await this.associations.listEventIdsForSpeaker(speakerId)));
      }
      const nextHome = remaining.find((id) => id !== eventId) ?? remaining[0];
      if (nextHome) {
        await this.speakers.update(speakerId, { eventId: nextHome });
      }
    }
  }

  private async listEventIds(speaker: Speaker): Promise<string[]> {
    const ids = new Set<string>();
    if (speaker.eventId) ids.add(speaker.eventId);
    if (this.associations) {
      for (const eventId of await this.associations.listEventIdsForSpeaker(speaker.id)) {
        ids.add(eventId);
      }
    }
    return [...ids];
  }

  /**
   * Keep one speaker document per email. Move associations from duplicates onto
   * the oldest profile, then delete the extras.
   */
  private async consolidateByEmail(email: string): Promise<Speaker | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;
    const all = await this.speakers.listByEmail(normalized);
    if (all.length === 0) return null;
    all.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const [canonical, ...dupes] = all;
    if (!canonical) return null;

    for (const dupe of dupes) {
      const eventIds = await this.listEventIds(dupe);
      for (const eventId of eventIds) {
        await this.linkSpeakerToEvent(canonical.id, eventId);
      }
      if (this.associations) {
        await this.associations.purgeSpeakerLinks(dupe.id);
      }
      await this.users.repointSpeakerPortalLink(dupe.id, canonical.id);
      await this.speakers.delete(dupe.id);
    }

    return (await this.speakers.findById(canonical.id)) ?? canonical;
  }

  /** Prefer a single visible row when legacy duplicates share an email. */
  private dedupeByEmail(speakers: Speaker[]): Speaker[] {
    const seen = new Set<string>();
    const result: Speaker[] = [];
    const sorted = [...speakers].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    for (const speaker of sorted) {
      const email = speaker.email.trim().toLowerCase();
      if (email) {
        if (seen.has(email)) continue;
        seen.add(email);
      }
      result.push(speaker);
    }
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }

  private async provisionPortalAccount(
    speaker: Speaker,
    email: string,
    issueInvite: boolean,
  ): Promise<void> {
    const { user, inviteCode } = await this.users.upsertPortalAccount({
      email,
      name: speaker.name,
      role: 'speaker',
      speakerId: speaker.id,
      issueInvite,
    });

    if (inviteCode) {
      const expiresAt = new Date(
        Date.now() + env.inviteCodeTtlDays * 24 * 60 * 60 * 1000,
      );
      await this.mail.sendInviteCode({
        to: email,
        name: speaker.name,
        inviteCode,
        expiresAt,
        dualAccess: true,
        isSpeaker: true,
        isSponsor: Boolean(user.sponsorId),
        isAttendee: Boolean(user.membershipId) || user.role === 'member',
      });
    } else if (issueInvite) {
      await this.mail.sendExistingAccountPortalAccess({
        to: email,
        name: speaker.name,
        portalRole: 'speaker',
        mustChangePassword: false,
        isAttendee: Boolean(user.membershipId) || user.role === 'member',
        isSponsor: Boolean(user.sponsorId),
      });
    }
  }

  /**
   * Union of home event + association links for this speaker and any other
   * speaker profiles that use the same portal email (legacy duplicates).
   */
  private async collectEventIdsForSpeaker(speakerId: string): Promise<Set<string>> {
    const speaker = await this.speakers.findById(speakerId);
    if (!speaker) throw new BadRequestError('Selected speaker was not found');

    const profileIds = new Set<string>([speakerId]);
    if (speaker.email.trim()) {
      for (const sibling of await this.speakers.listByEmail(speaker.email)) {
        profileIds.add(sibling.id);
      }
    }

    const eventIds = new Set<string>();
    for (const profileId of profileIds) {
      const profile = profileId === speakerId ? speaker : await this.speakers.findById(profileId);
      if (profile?.eventId) eventIds.add(profile.eventId);
      if (this.associations) {
        for (const eventId of await this.associations.listEventIdsForSpeaker(profileId)) {
          eventIds.add(eventId);
        }
      }
    }
    return eventIds;
  }

  private async requireSpeaker(id: string): Promise<Speaker> {
    const speaker = await this.speakers.findById(id);
    if (!speaker) throw new NotFoundError('Speaker');
    return speaker;
  }
}
