import { env } from '../../config/env.js';
import { BadRequestError, NotFoundError } from '../../core/errors/app-error.js';
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

      let items = [...byId.values()];
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
        items: pageItems.map((speaker) =>
          toPublicSpeaker({ ...speaker, eventId: query.eventId! }),
        ),
        total,
      };
    }

    const { items, total } = await this.speakers.list(query);
    return { items: items.map(toPublicSpeaker), total };
  }

  async getById(id: string): Promise<PublicSpeaker> {
    return toPublicSpeaker(await this.requireSpeaker(id));
  }

  async create(input: CreateSpeakerInput): Promise<PublicSpeaker> {
    const eventId = input.eventId.trim();
    if (!eventId) {
      throw new BadRequestError('Event is required');
    }
    await this.events.requireEvent(eventId);

    const created = await this.speakers.create({
      eventId,
      name: input.name,
      email: input.email?.trim().toLowerCase() ?? '',
      title: input.title ?? '',
      description: input.description ?? '',
      photo: input.photo ?? '',
    });

    if (this.associations) {
      await this.associations.linkSpeaker(eventId, created.id);
    }

    if (input.email?.trim()) {
      await this.provisionPortalAccount(created, input.email.trim(), true);
    }

    return toPublicSpeaker({ ...created, eventId });
  }

  async update(id: string, input: UpdateSpeakerInput): Promise<PublicSpeaker> {
    const existing = await this.requireSpeaker(id);

    let nextEventId = existing.eventId;
    if (input.eventId !== undefined) {
      nextEventId = input.eventId.trim();
      if (!nextEventId) {
        throw new BadRequestError('Event is required');
      }
      await this.events.requireEvent(nextEventId);
    }

    const updated = await this.speakers.update(id, {
      ...(input.eventId !== undefined ? { eventId: nextEventId } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.photo !== undefined ? { photo: input.photo } : {}),
    });

    if (!updated) throw new NotFoundError('Speaker');

    if (this.associations && input.eventId !== undefined && nextEventId !== existing.eventId) {
      await this.associations.purgeSpeakerLinks(id);
      await this.associations.linkSpeaker(nextEventId, id);
    }

    const email = input.email?.trim() || updated.email.trim();
    if (email) {
      await this.provisionPortalAccount(updated, email, true);
    }

    return toPublicSpeaker(updated);
  }

  async delete(id: string): Promise<void> {
    await this.requireSpeaker(id);

    if (this.associations) {
      await this.associations.purgeSpeakerLinks(id);
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
   * including sibling profiles that share the same portal email.
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

    // Portal stays on the first speaker profile for this email; later edition
    // profiles share login via email sibling resolution — skip duplicate invites.
    if (user.speakerId && user.speakerId !== speaker.id) {
      return;
    }

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
   * speaker profiles that use the same portal email.
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
