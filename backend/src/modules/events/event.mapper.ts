import type {
  Event,
  EventDay,
  EventEditionStatus,
  PublicEvent,
  PublicEventDay,
} from './event.types.js';

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
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}
