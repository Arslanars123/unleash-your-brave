import type { EventFeatureAccess } from './event-feature-access.js';

export type { EventFeatureAccess } from './event-feature-access.js';

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

export type EventEditionStatus = 'upcoming' | 'live' | 'ended' | 'paused';

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
  /**
   * When true (default), unpaid/expired renewable memberships cannot get a
   * check-in QR for this (or future) edition until they renew.
   * Admin can turn this off to allow QR even when renewal is pending.
   */
  blockQrWhenRenewalUnpaid: boolean;
  /**
   * Feature permissions for attendees entitled to this edition
   * (paid purchase, same-edition membership, or previous-attendee content carry).
   */
  memberFeatureAccess?: EventFeatureAccess;
  /**
   * Feature permissions for everyone else (no purchase / membership for this edition).
   * Defaults all locked.
   */
  guestFeatureAccess?: EventFeatureAccess;
  /**
   * Admin pause — event is temporarily on hold. Status surfaces as `paused`
   * and attendees are notified when this toggles or when dates change.
   */
  paused: boolean;
  /**
   * When false, the edition is a draft: hidden from public catalog / app discovery
   * (admins can still manage it). Defaults to true for legacy documents.
   */
  published: boolean;
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
  paused: boolean;
  venueName: string;
  venueAddress: string;
  venueCity: string;
  latitude: number | null;
  longitude: number | null;
  coverImage: string;
  allowPreviousAttendeesAccess: boolean;
  blockQrWhenRenewalUnpaid: boolean;
  memberFeatureAccess: EventFeatureAccess;
  guestFeatureAccess: EventFeatureAccess;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Admin Event page payload: active edition + full edition list. */
export interface EventWorkspace {
  /** Preferred active edition (live → soonest upcoming → latest). */
  current: PublicEvent | null;
  /** New editions are always allowed; dates must start after the previous edition ends. */
  canScheduleNew: boolean;
  /** Guidance about the earliest allowed start date when a previous edition exists. */
  scheduleBlockedReason: string | null;
  /** Earliest UTC midnight ISO date a new edition may start (day after previous end). */
  earliestNextStart: string | null;
  /** All editions newest-first (including current). */
  editions: PublicEvent[];
  /** Ended editions only (excludes current when it is still active). */
  pastEditions: PublicEvent[];
  /** Upcoming/live editions that are not the preferred current row. */
  upcomingEditions: PublicEvent[];
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
  blockQrWhenRenewalUnpaid?: boolean;
  memberFeatureAccess?: EventFeatureAccess;
  guestFeatureAccess?: EventFeatureAccess;
  paused?: boolean;
  published?: boolean;
}

/** Dedicated “Schedule new event” payload — new edition with new dates. */
export interface ScheduleEventInput {
  name?: string;
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
  blockQrWhenRenewalUnpaid?: boolean;
  memberFeatureAccess?: EventFeatureAccess;
  guestFeatureAccess?: EventFeatureAccess;
  /** Draft until published (default true when omitted). */
  published?: boolean;
  /** When false, skip the “new dates announced” push. Default true. */
  notifyAttendees?: boolean;
  /** Shared catalog entities to link to this new edition. */
  speakerIds?: string[];
  sponsorIds?: string[];
  membershipIds?: string[];
}

export interface UpdateEventInput {
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
  blockQrWhenRenewalUnpaid?: boolean;
  memberFeatureAccess?: EventFeatureAccess;
  guestFeatureAccess?: EventFeatureAccess;
  paused?: boolean;
  published?: boolean;
  /** When false, skip pause/date-change push. Default true. */
  notifyAttendees?: boolean;
}

export interface ListEventsQuery {
  page: number;
  perPage: number;
  search?: string;
}
