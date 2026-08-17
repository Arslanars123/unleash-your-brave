import { env } from '../../config/env.js';
import { NotFoundError } from '../../core/errors/app-error.js';
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
  constructor(
    private readonly speakers: SpeakerRepository,
    private readonly events: EventService,
    private readonly users: UserService,
    private readonly mail: MailService,
  ) {}

  async list(query: ListSpeakersQuery): Promise<PaginatedResult<PublicSpeaker>> {
    const { items, total } = await this.speakers.list(query);
    return { items: items.map(toPublicSpeaker), total };
  }

  async getById(id: string): Promise<PublicSpeaker> {
    return toPublicSpeaker(await this.requireSpeaker(id));
  }

  async create(input: CreateSpeakerInput): Promise<PublicSpeaker> {
    await this.events.requireEvent(input.eventId);

    const created = await this.speakers.create({
      eventId: input.eventId,
      name: input.name,
      email: input.email?.trim().toLowerCase() ?? '',
      title: input.title ?? '',
      description: input.description ?? '',
      photo: input.photo ?? '',
    });

    if (input.email?.trim()) {
      await this.provisionPortalAccount(created, input.email.trim(), true);
    }

    return toPublicSpeaker(created);
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
      // Attendee (or other) already has a password — same login unlocks dashboard.
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
