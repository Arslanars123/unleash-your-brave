import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../core/errors/app-error.js';
import { logger } from '../../core/logger.js';
import type { AnnouncementService } from '../announcements/announcement.service.js';
import type { EventRepository, PaginatedResult } from './event.repository.js';
import { CANONICAL_EVENT_NAME } from './event.constants.js';
import {
  editionStatus,
  pickPreferredEvent,
  startOfUtcDay,
  toPublicEvent,
} from './event.mapper.js';
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

function scheduleFingerprint(days: EventDay[]): string {
  return [...days]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((day) => day.date.toISOString().slice(0, 10))
    .join('|');
}

function formatEventRange(days: EventDay[]): string {
  if (days.length === 0) return '';
  const sorted = [...days].sort((a, b) => a.date.getTime() - b.date.getTime());
  const fmt = (date: Date) =>
    date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (first.date.getTime() === last.date.getTime()) return fmt(first.date);
  return `${fmt(first.date)} – ${fmt(last.date)}`;
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
  private announcements: AnnouncementService | null = null;

  constructor(private readonly events: EventRepository) {}

  /** Wired after AnnouncementService is constructed (avoids circular DI). */
  setAnnouncementService(service: AnnouncementService): void {
    this.announcements = service;
  }

  async list(query: ListEventsQuery): Promise<PaginatedResult<PublicEvent>> {
    const { items, total } = await this.events.list(query);
    return { items: items.map(toPublicEvent), total };
  }

  /** Latest edition (most recent start date), whether ended or not. */
  async getLatest(): Promise<Event | null> {
    const { items } = await this.events.list({ page: 1, perPage: 1 });
    return items[0] ?? null;
  }

  /** Preferred public edition: live → soonest upcoming → latest. */
  async getPreferred(): Promise<Event | null> {
    const { items } = await this.events.list({ page: 1, perPage: 100 });
    return pickPreferredEvent(items);
  }

  /** Preferred edition as public DTO (mobile “current” event). */
  async getCurrent(): Promise<PublicEvent> {
    const preferred = await this.getPreferred();
    if (!preferred) throw new NotFoundError('Event');
    return toPublicEvent(preferred);
  }

  /**
   * Published upcoming/live editions for checkout + app discovery
   * (excludes drafts, paused, and ended).
   */
  async listAvailableForPurchase(): Promise<PublicEvent[]> {
    const { items } = await this.events.list({ page: 1, perPage: 100 });
    return items
      .filter((event) => event.published !== false)
      .filter((event) => {
        const status = editionStatus(event);
        return status === 'upcoming' || status === 'live';
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .map(toPublicEvent);
  }

  async getWorkspace(): Promise<EventWorkspace> {
    const { items } = await this.events.list({ page: 1, perPage: 100 });
    const editions = items.map(toPublicEvent);
    const preferred = pickPreferredEvent(items);
    const current = preferred ? toPublicEvent(preferred) : null;
    const pastEditions = editions.filter((edition) => edition.status === 'ended');
    const upcomingEditions = editions.filter(
      (edition) =>
        (edition.status === 'upcoming' || edition.status === 'live' || edition.status === 'paused') &&
        edition.id !== current?.id,
    );

    return {
      current,
      canScheduleNew: true,
      scheduleBlockedReason: null,
      editions,
      pastEditions,
      upcomingEditions,
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
    if (existing) {
      throw new ConflictError(
        'Use Schedule new event to create another Unleash Your Brave edition.',
      );
    }

    return this.createEdition(input);
  }

  /**
   * Creates another edition with new dates.
   * Allowed while a live/upcoming edition already exists.
   */
  async scheduleNew(input: ScheduleEventInput): Promise<PublicEvent> {
    const latest = await this.getLatest();

    const copy = Boolean(input.copyDetailsFromPrevious && latest);
    const pick = (override: string | undefined, previous: string): string => {
      const trimmed = override?.trim() ?? '';
      if (trimmed) return trimmed;
      return copy ? previous : '';
    };

    const created = await this.createEdition({
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
      blockQrWhenRenewalUnpaid:
        input.blockQrWhenRenewalUnpaid ??
        (copy ? latest?.blockQrWhenRenewalUnpaid !== false : true),
      published: input.published !== false,
      paused: false,
    });

    if (input.notifyAttendees !== false && created.published) {
      await this.notifyDatesAnnounced(created.id, created.name, created.days.map((d) => ({
        dayNumber: d.dayNumber,
        date: new Date(d.date),
        label: d.label,
      })));
    }

    return created;
  }

  async update(id: string, input: UpdateEventInput): Promise<PublicEvent> {
    const existing = await this.requireEvent(id);

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

    const nextPaused =
      input.paused !== undefined ? Boolean(input.paused) : Boolean(existing.paused);
    const datesChanged =
      shouldRebuildDays && scheduleFingerprint(days) !== scheduleFingerprint(existing.days);
    const pausedChanged =
      input.paused !== undefined && Boolean(input.paused) !== Boolean(existing.paused);

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
      ...(input.blockQrWhenRenewalUnpaid !== undefined
        ? { blockQrWhenRenewalUnpaid: input.blockQrWhenRenewalUnpaid }
        : {}),
      ...(input.paused !== undefined ? { paused: nextPaused } : {}),
      ...(input.published !== undefined ? { published: Boolean(input.published) } : {}),
    });

    if (!updated) throw new NotFoundError('Event');

    const shouldNotify = input.notifyAttendees !== false && updated.published !== false;
    if (shouldNotify) {
      if (pausedChanged && nextPaused) {
        await this.notifyPaused(updated);
      } else if (pausedChanged && !nextPaused) {
        await this.notifyResumed(updated);
      }
      if (datesChanged) {
        await this.notifyDatesAnnounced(updated.id, updated.name, updated.days);
      }
    }

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
      blockQrWhenRenewalUnpaid: input.blockQrWhenRenewalUnpaid !== false,
      paused: Boolean(input.paused),
      published: input.published !== false,
    });

    return toPublicEvent(created);
  }

  private async notifyPaused(event: Event): Promise<void> {
    const dayKey = new Date().toISOString().slice(0, 10);
    await this.publishNotice({
      systemKey: `event:paused:${event.id}:${dayKey}`,
      title: `${event.name} paused`,
      description: `${event.name} has been temporarily paused. We’ll share updates when the event is back on.`,
    });
  }

  private async notifyResumed(event: Event): Promise<void> {
    const dayKey = new Date().toISOString().slice(0, 10);
    const range = formatEventRange(event.days);
    await this.publishNotice({
      systemKey: `event:resumed:${event.id}:${dayKey}`,
      title: `${event.name} is back on`,
      description: range
        ? `${event.name} has resumed. Upcoming dates: ${range}.`
        : `${event.name} has resumed. Open the app for the latest schedule.`,
    });
  }

  private async notifyDatesAnnounced(
    eventId: string,
    eventName: string,
    days: EventDay[],
  ): Promise<void> {
    const fingerprint = scheduleFingerprint(days);
    const range = formatEventRange(days);
    await this.publishNotice({
      systemKey: `event:dates:${eventId}:${fingerprint}`,
      title: `New dates for ${eventName}`,
      description: range
        ? `${eventName} dates have been updated: ${range}. Open the app for the full schedule.`
        : `${eventName} dates have been updated. Open the app for the full schedule.`,
    });
  }

  private async publishNotice(input: {
    systemKey: string;
    title: string;
    description: string;
  }): Promise<void> {
    if (!this.announcements) {
      logger.warn({ systemKey: input.systemKey }, 'Announcement service not wired — skip event notice');
      return;
    }
    try {
      await this.announcements.publishSystemNotice({
        ...input,
        sendPush: true,
      });
    } catch (error) {
      logger.error({ err: error, systemKey: input.systemKey }, 'Failed to publish event notice');
    }
  }
}
