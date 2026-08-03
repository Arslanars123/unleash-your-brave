import { NotFoundError } from '../../core/errors/app-error.js';
import type { EventService } from '../events/event.service.js';
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
      title: input.title ?? '',
      description: input.description ?? '',
      photo: input.photo ?? '',
    });

    return toPublicSpeaker(created);
  }

  async update(id: string, input: UpdateSpeakerInput): Promise<PublicSpeaker> {
    await this.requireSpeaker(id);

    const updated = await this.speakers.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.photo !== undefined ? { photo: input.photo } : {}),
    });

    if (!updated) throw new NotFoundError('Speaker');
    return toPublicSpeaker(updated);
  }

  async delete(id: string): Promise<void> {
    if (!(await this.speakers.delete(id))) {
      throw new NotFoundError('Speaker');
    }
  }

  private async requireSpeaker(id: string): Promise<Speaker> {
    const speaker = await this.speakers.findById(id);
    if (!speaker) throw new NotFoundError('Speaker');
    return speaker;
  }
}
