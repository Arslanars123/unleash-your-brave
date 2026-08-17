import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../core/errors/app-error.js';
import type { EventRepository, PaginatedResult } from './event.repository.js';
import { CANONICAL_EVENT_NAME } from './event.constants.js';
import { hasEditionEnded, startOfUtcDay, toPublicEvent } from './event.mapper.js';
import type {
  CreateEventInput,
  Event,
  EventDay,
  EventDayInput,
  EventWorkspace,
  ListEventsQuery,
  PublicEvent,
  ScheduleEventInput,
  UpdateEventInput,
} from './event.types.js';

function eachUtcDayInclusive(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = startOfUtcDay(start);
  const last = startOfUtcDay(end);
  while (cursor.getTime() <= last.getTime()) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/**
 * Normalizes day inputs into a sorted schedule.
 * Accepts either an explicit `days` list or a legacy start/end range (consecutive).
 */
export function resolveEventDays(input: {
  days?: EventDayInput[];
  startDate?: string;
  endDate?: string;
  fallbackDays?: EventDay[];
}): EventDay[] {
  if (input.days && input.days.length > 0) {
    const normalized = input.days.map((day, index) => {
      const parsed = new Date(day.date);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestError(`Invalid date for day ${index + 1}`);
      }
      return {
        dayNumber: day.dayNumber ?? index + 1,
        date: startOfUtcDay(parsed),
        label: day.label?.trim() ?? '',
      };
    });

    normalized.sort((a, b) => a.date.getTime() - b.date.getTime());

    const seen = new Set<string>();
    for (const day of normalized) {
      const key = day.date.toISOString().slice(0, 10);
      if (seen.has(key)) {
        throw new BadRequestError('Each event day must have a unique date');
      }
      seen.add(key);
    }

    return normalized.map((day, index) => ({
      ...day,
      dayNumber: index + 1,
    }));
  }

  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestError('Invalid start or end date');
    }
    if (end.getTime() < start.getTime()) {
      throw new BadRequestError('End date must be on or after the start date');
    }

    return eachUtcDayInclusive(start, end).map((date, index) => ({
      dayNumber: index + 1,
      date,
      label: '',
    }));
  }

  if (input.fallbackDays && input.fallbackDays.length > 0) {
    return input.fallbackDays;
  }

  throw new BadRequestError('Add at least one event day');
}

export class EventService {
  constructor(private readonly events: EventRepository) {}

  async list(query: ListEventsQuery): Promise<PaginatedResult<PublicEvent>> {
    const { items, total } = await this.events.list(query);
    return { items: items.map(toPublicEvent), total };
  }

  /** Latest edition (most recent start date), whether ended or not. */
  async getLatest(): Promise<Event | null> {
    const { items } = await this.events.list({ page: 1, perPage: 1 });
    return items[0] ?? null;
  }

  /** Latest edition as public DTO. */
  async getCurrent(): Promise<PublicEvent> {
    const latest = await this.getLatest();
    if (!latest) throw new NotFoundError('Event');
    return toPublicEvent(latest);
  }

  async getWorkspace(): Promise<EventWorkspace> {
    const { items } = await this.events.list({ page: 1, perPage: 100 });
    const [latest, ...older] = items;
    const current = latest ? toPublicEvent(latest) : null;
    const canScheduleNew = !latest || hasEditionEnded(latest);

    return {
      current,
      canScheduleNew,
      scheduleBlockedReason: canScheduleNew
        ? null
        : 'You can schedule a new event only after the current edition’s dates have passed.',
      pastEditions: older.map(toPublicEvent),
    };
  }

  async getById(id: string): Promise<PublicEvent> {
    return toPublicEvent(await this.requireEvent(id));
  }

  /**
   * Bootstrap / first edition. Prefer `scheduleNew` for subsequent editions.
   */
  async create(input: CreateEventInput): Promise<PublicEvent> {
    const existing = await this.getLatest();
    if (existing && !hasEditionEnded(existing)) {
      throw new ConflictError(
        'An active edition already exists. Use Schedule new event after its dates have passed.',
      );
    }
    if (existing && hasEditionEnded(existing)) {
      throw new ConflictError(
        'Use Schedule new event to create the next Unleash Your Brave edition.',
      );
    }

    return this.createEdition(input);
  }

  /**
   * Creates the next edition with new dates.
   * Blocked until the latest edition’s end date is in the past.
   */
  async scheduleNew(input: ScheduleEventInput): Promise<PublicEvent> {
    const latest = await this.getLatest();
    if (latest && !hasEditionEnded(latest)) {
      throw new ConflictError(
        'You can schedule a new event only after the current edition’s dates have passed.',
      );
    }

    const copy = Boolean(input.copyDetailsFromPrevious && latest);
    const pick = (override: string | undefined, previous: string): string => {
      const trimmed = override?.trim() ?? '';
      if (trimmed) return trimmed;
      return copy ? previous : '';
    };

    return this.createEdition({
      days: input.days,
      tagline: pick(input.tagline, latest?.tagline ?? ''),
      description: pick(input.description, latest?.description ?? ''),
      venueName: pick(input.venueName, latest?.venueName ?? ''),
      venueAddress: pick(input.venueAddress, latest?.venueAddress ?? ''),
      venueCity: pick(input.venueCity, latest?.venueCity ?? ''),
      latitude:
        input.latitude !== undefined
          ? input.latitude
          : copy
            ? (latest?.latitude ?? null)
            : null,
      longitude:
        input.longitude !== undefined
          ? input.longitude
          : copy
            ? (latest?.longitude ?? null)
            : null,
      coverImage: pick(input.coverImage, latest?.coverImage ?? ''),
      allowPreviousAttendeesAccess:
        input.allowPreviousAttendeesAccess ??
        (copy ? Boolean(latest?.allowPreviousAttendeesAccess) : false),
    });
  }

  async update(id: string, input: UpdateEventInput): Promise<PublicEvent> {
    const existing = await this.requireEvent(id);
    const latest = await this.getLatest();
    if (!latest || latest.id !== existing.id) {
      throw new ForbiddenError('Past editions are read-only. Schedule a new event for new dates.');
    }

    const shouldRebuildDays =
      input.days !== undefined || input.startDate !== undefined || input.endDate !== undefined;

    const days = shouldRebuildDays
      ? resolveEventDays({
          days: input.days,
          startDate: input.days?.length
            ? undefined
            : (input.startDate ?? existing.startDate.toISOString()),
          endDate: input.days?.length
            ? undefined
            : (input.endDate ?? existing.endDate.toISOString()),
          fallbackDays: existing.days,
        })
      : existing.days;

    const updated = await this.events.update(id, {
      name: CANONICAL_EVENT_NAME,
      ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(shouldRebuildDays
        ? {
            days,
            startDate: days[0]!.date,
            endDate: days[days.length - 1]!.date,
          }
        : {}),
      ...(input.venueName !== undefined ? { venueName: input.venueName } : {}),
      ...(input.venueAddress !== undefined ? { venueAddress: input.venueAddress } : {}),
      ...(input.venueCity !== undefined ? { venueCity: input.venueCity } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      ...(input.coverImage !== undefined ? { coverImage: input.coverImage } : {}),
      ...(input.allowPreviousAttendeesAccess !== undefined
        ? { allowPreviousAttendeesAccess: input.allowPreviousAttendeesAccess }
        : {}),
    });

    if (!updated) throw new NotFoundError('Event');
    return toPublicEvent(updated);
  }

  async delete(_id: string): Promise<void> {
    throw new ForbiddenError('Event editions cannot be deleted — history is preserved');
  }

  async requireEvent(id: string): Promise<Event> {
    const event = await this.events.findById(id);
    if (!event) throw new NotFoundError('Event');
    return event;
  }

  private async createEdition(input: CreateEventInput): Promise<PublicEvent> {
    const days = resolveEventDays({
      days: input.days,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    const created = await this.events.create({
      name: CANONICAL_EVENT_NAME,
      tagline: input.tagline ?? '',
      description: input.description ?? '',
      days,
      startDate: days[0]!.date,
      endDate: days[days.length - 1]!.date,
      venueName: input.venueName ?? '',
      venueAddress: input.venueAddress ?? '',
      venueCity: input.venueCity ?? '',
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      coverImage: input.coverImage ?? '',
      allowPreviousAttendeesAccess: Boolean(input.allowPreviousAttendeesAccess),
    });

    return toPublicEvent(created);
  }
}
