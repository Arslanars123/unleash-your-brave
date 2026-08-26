import type {
  Event,
  EventDay,
  EventEditionStatus,
  PublicEvent,
  PublicEventDay,
} from './event.types.js';
import {
  guestFeatureAccessFor,
  memberFeatureAccessFor,
} from './event-feature-access.js';

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function editionStatus(
  event: Pick<Event, 'startDate' | 'endDate' | 'paused'>,
  now = new Date(),
): EventEditionStatus {
  if (Boolean(event.paused)) return 'paused';
  const today = startOfUtcDay(now).getTime();
  const start = startOfUtcDay(event.startDate).getTime();
  const end = startOfUtcDay(event.endDate).getTime();
  if (today < start) return 'upcoming';
  if (today > end) return 'ended';
  return 'live';
}

export function hasEditionEnded(event: Pick<Event, 'endDate'>, now = new Date()): boolean {
  return startOfUtcDay(event.endDate).getTime() < startOfUtcDay(now).getTime();
}

export function toPublicEventDay(day: EventDay): PublicEventDay {
  return {
    dayNumber: day.dayNumber,
    date: day.date.toISOString(),
    label: day.label,
  };
}

export function toPublicEvent(event: Event): PublicEvent {
  const days = [...event.days]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(toPublicEventDay);

  return {
    id: event.id,
    name: event.name,
    tagline: event.tagline,
    description: event.description,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    days,
    dayCount: days.length,
    status: editionStatus(event),
    paused: Boolean(event.paused),
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    venueCity: event.venueCity,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    coverImage: event.coverImage,
    allowPreviousAttendeesAccess: Boolean(event.allowPreviousAttendeesAccess),
    blockQrWhenRenewalUnpaid: event.blockQrWhenRenewalUnpaid !== false,
    memberFeatureAccess: memberFeatureAccessFor(event),
    guestFeatureAccess: guestFeatureAccessFor(event),
    published: event.published !== false,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

/** Prefer live edition, else soonest upcoming, else most recent by start date. */
export function pickPreferredEvent<T extends Pick<Event, 'startDate' | 'endDate' | 'paused'>>(
  events: T[],
  now = new Date(),
): T | null {
  if (events.length === 0) return null;
  const live = events.find((event) => editionStatus(event, now) === 'live');
  if (live) return live;
  const upcoming = events
    .filter((event) => editionStatus(event, now) === 'upcoming')
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  if (upcoming[0]) return upcoming[0];
  return [...events].sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0] ?? null;
}

/** Edition that ends last — the previous schedule new editions must follow. */
export function pickChronologicallyLastEvent<
  T extends Pick<Event, 'startDate' | 'endDate'>,
>(events: T[]): T | null {
  if (events.length === 0) return null;
  return (
    [...events].sort((a, b) => {
      const endDiff = b.endDate.getTime() - a.endDate.getTime();
      if (endDiff !== 0) return endDiff;
      return b.startDate.getTime() - a.startDate.getTime();
    })[0] ?? null
  );
}

/** Next UTC calendar day after `date` (YYYY-MM-DD input helper). */
export function utcDayAfter(date: Date): Date {
  const day = startOfUtcDay(date);
  day.setUTCDate(day.getUTCDate() + 1);
  return day;
}
