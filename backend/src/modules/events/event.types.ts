export interface EventDay {
  /** 1-based day index within the event (Day 1, Day 2, …). */
  dayNumber: number;
  /** Calendar date for this day (stored as Date at midnight UTC of that day). */
  date: Date;
  /** Optional display label, e.g. "Opening night". */
  label: string;
}

export interface PublicEventDay {
  dayNumber: number;
  date: string;
  label: string;
}

export interface EventDayInput {
  dayNumber?: number;
  date: string;
  label?: string;
}

export type EventEditionStatus = 'upcoming' | 'live' | 'ended';

export interface Event {
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** Derived from the earliest day date. */
  startDate: Date;
  /** Derived from the latest day date. */
  endDate: Date;
  /** Explicit schedule — consecutive or with gaps. */
  days: EventDay[];
  venueName: string;
  venueAddress: string;
  venueCity: string;
  /** Google Places / map pin. Null when not set. */
  latitude: number | null;
  longitude: number | null;
  coverImage: string;
  /**
   * When true, attendees who held a membership on a previous edition can access
   * this edition’s content (sessions map by name/tier when possible).
   */
  allowPreviousAttendeesAccess: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicEvent {
  id: string;
  name: string;
  tagline: string;
  description: string;
  startDate: string;
  endDate: string;
  days: PublicEventDay[];
  dayCount: number;
  status: EventEditionStatus;
  venueName: string;
  venueAddress: string;
  venueCity: string;
  latitude: number | null;
  longitude: number | null;
  coverImage: string;
  allowPreviousAttendeesAccess: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Admin Event page payload: latest edition + history + schedule gate. */
export interface EventWorkspace {
  current: PublicEvent | null;
  canScheduleNew: boolean;
  scheduleBlockedReason: string | null;
  pastEditions: PublicEvent[];
}

export interface CreateEventInput {
  name?: string;
  tagline?: string;
  description?: string;
  days?: EventDayInput[];
  startDate?: string;
  endDate?: string;
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  latitude?: number | null;
  longitude?: number | null;
  coverImage?: string;
  allowPreviousAttendeesAccess?: boolean;
}

/** Dedicated “Schedule new event” payload — new edition with new dates. */
export interface ScheduleEventInput {
  days: EventDayInput[];
  tagline?: string;
  description?: string;
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  latitude?: number | null;
  longitude?: number | null;
  coverImage?: string;
  /** When true, copies tagline/description/venue/cover from the previous edition. */
  copyDetailsFromPrevious?: boolean;
  allowPreviousAttendeesAccess?: boolean;
}

export interface UpdateEventInput {
  tagline?: string;
  description?: string;
  days?: EventDayInput[];
  startDate?: string;
  endDate?: string;
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  latitude?: number | null;
  longitude?: number | null;
  coverImage?: string;
  allowPreviousAttendeesAccess?: boolean;
}

export interface ListEventsQuery {
  page: number;
  perPage: number;
  search?: string;
}
