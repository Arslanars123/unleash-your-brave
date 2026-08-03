import { randomUUID } from 'node:crypto';
import { BadRequestError, NotFoundError } from '../../core/errors/app-error.js';
import type { EventService } from '../events/event.service.js';
import type { SpeakerRepository } from '../speakers/speaker.repository.js';
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

export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly speakers: SpeakerRepository,
    private readonly events: EventService,
    private readonly feedback: SessionFeedbackRepository,
  ) {}

  async list(query: ListSessionsQuery): Promise<PaginatedResult<PublicSession>> {
    const { items, total } = await this.sessions.list(query);
    const mapped = await Promise.all(items.map((session) => this.toPublic(session)));
    return { items: mapped, total };
  }

  async getById(id: string): Promise<PublicSession> {
    return this.toPublic(await this.requireSession(id));
  }

  async create(input: CreateSessionInput): Promise<PublicSession> {
    await this.events.requireEvent(input.eventId);
    await this.requireSpeakerForEvent(input.speakerId, input.eventId);
    await this.assertValidEventDay(input.eventId, input.eventDayNumber);

    const created = await this.sessions.create({
      eventId: input.eventId,
      name: input.name,
      description: input.description ?? '',
      speakerId: input.speakerId,
      eventDayNumber: input.eventDayNumber,
      startTime: input.startTime ?? '',
      endTime: input.endTime ?? '',
      location: input.location ?? '',
      materials: normalizeMaterials(input.materials),
      feedbackEnabled: input.feedbackEnabled ?? true,
    });

    return this.toPublic(created);
  }

  async update(id: string, input: UpdateSessionInput): Promise<PublicSession> {
    const existing = await this.requireSession(id);

    const speakerId = input.speakerId ?? existing.speakerId;
    const eventDayNumber = input.eventDayNumber ?? existing.eventDayNumber;

    if (input.speakerId !== undefined) {
      await this.requireSpeakerForEvent(speakerId, existing.eventId);
    }
    if (input.eventDayNumber !== undefined) {
      await this.assertValidEventDay(existing.eventId, eventDayNumber);
    }

    const updated = await this.sessions.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.speakerId !== undefined ? { speakerId } : {}),
      ...(input.eventDayNumber !== undefined ? { eventDayNumber } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.materials !== undefined ? { materials: normalizeMaterials(input.materials) } : {}),
      ...(input.feedbackEnabled !== undefined ? { feedbackEnabled: input.feedbackEnabled } : {}),
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

  private async toPublic(session: Session): Promise<PublicSession> {
    const speaker = await this.speakers.findById(session.speakerId);
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
    return session;
  }

  private async requireSpeakerForEvent(speakerId: string, eventId: string): Promise<void> {
    const speaker = await this.speakers.findById(speakerId);
    if (!speaker) throw new BadRequestError('Selected speaker was not found');
    if (speaker.eventId !== eventId) {
      throw new BadRequestError('Speaker must belong to the same event edition');
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
