import { env } from '../../config/env.js';
import { BadRequestError, NotFoundError } from '../../core/errors/app-error.js';
import type { EventAssociationService } from '../event-associations/event-association.service.js';
import type { EventService } from '../events/event.service.js';
import type { MailService } from '../mail/mail.service.js';
import type { UserService } from '../users/user.service.js';
import type { PaginatedResult, SpeakerRepository } from './speaker.repository.js';
import { toPublicSpeaker } from './speaker.mapper.js';
import type {
  CreateSpeakerInput,
  ListSpeakersQuery,
  PublicSpeaker,
  Speaker,
  UpdateSpeakerInput,
} from './speaker.types.js';

export class SpeakerService {
  private associations: EventAssociationService | null = null;

  constructor(
    private readonly speakers: SpeakerRepository,
    private readonly events: EventService,
    private readonly users: UserService,
    private readonly mail: MailService,
  ) {}

  setAssociationService(service: EventAssociationService): void {
    this.associations = service;
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
    const eventId = input.eventId?.trim() || '';
    if (eventId) {
      await this.events.requireEvent(eventId);
    }

    const created = await this.speakers.create({
      eventId,
      name: input.name,
      email: input.email?.trim().toLowerCase() ?? '',
      title: input.title ?? '',
      description: input.description ?? '',
      photo: input.photo ?? '',
    });

    if (eventId && this.associations) {
      await this.associations.linkSpeaker(eventId, created.id);
    }

    if (input.email?.trim()) {
      await this.provisionPortalAccount(created, input.email.trim(), true);
    }

    return toPublicSpeaker(
      eventId ? { ...created, eventId } : created,
    );
  }

  async update(id: string, input: UpdateSpeakerInput): Promise<PublicSpeaker> {
    await this.requireSpeaker(id);

    const updated = await this.speakers.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.photo !== undefined ? { photo: input.photo } : {}),
    });

    if (!updated) throw new NotFoundError('Speaker');

    const email = input.email?.trim() || updated.email.trim();
    if (email) {
      await this.provisionPortalAccount(updated, email, Boolean(input.email?.trim()));
    }

    return toPublicSpeaker(updated);
  }

  async delete(id: string): Promise<void> {
    if (!(await this.speakers.delete(id))) {
      throw new NotFoundError('Speaker');
    }
  }

  async assertLinkedToEvent(speakerId: string, eventId: string): Promise<void> {
    const speaker = await this.speakers.findById(speakerId);
    if (!speaker) throw new BadRequestError('Selected speaker was not found');
    if (speaker.eventId === eventId) return;
    if (this.associations && (await this.associations.isSpeakerLinked(eventId, speakerId))) {
      return;
    }
    throw new BadRequestError('Speaker must be associated with this event edition');
  }

  private async provisionPortalAccount(
    speaker: Speaker,
    email: string,
    issueInvite: boolean,
  ): Promise<void> {
    const { inviteCode } = await this.users.upsertPortalAccount({
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
      });
    } else if (issueInvite) {
      await this.mail.sendExistingAccountPortalAccess({
        to: email,
        name: speaker.name,
        portalRole: 'speaker',
      });
    }
  }

  private async requireSpeaker(id: string): Promise<Speaker> {
    const speaker = await this.speakers.findById(id);
    if (!speaker) throw new NotFoundError('Speaker');
    return speaker;
  }
}
