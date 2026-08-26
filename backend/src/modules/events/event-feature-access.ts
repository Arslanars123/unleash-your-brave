import type { Event } from './event.types.js';

/** Granular content permissions configured per edition in Event access. */
export interface EventFeatureAccess {
  /** Session list + session detail (about / schedule). */
  viewAgenda: boolean;
  /** Session materials / resources. Implies agenda when enabled in UI. */
  viewMaterials: boolean;
  /** Submit session reviews (also requires the event start date to have arrived). */
  submitReviews: boolean;
}

export const DEFAULT_MEMBER_FEATURE_ACCESS: EventFeatureAccess = {
  viewAgenda: true,
  viewMaterials: true,
  submitReviews: true,
};

export const DEFAULT_GUEST_FEATURE_ACCESS: EventFeatureAccess = {
  viewAgenda: false,
  viewMaterials: false,
  submitReviews: false,
};

export function normalizeFeatureAccess(
  raw: Partial<EventFeatureAccess> | null | undefined,
  defaults: EventFeatureAccess,
): EventFeatureAccess {
  return {
    viewAgenda: raw?.viewAgenda ?? defaults.viewAgenda,
    viewMaterials: raw?.viewMaterials ?? defaults.viewMaterials,
    submitReviews: raw?.submitReviews ?? defaults.submitReviews,
  };
}

export function memberFeatureAccessFor(
  event: Pick<Event, 'memberFeatureAccess'>,
): EventFeatureAccess {
  return normalizeFeatureAccess(event.memberFeatureAccess, DEFAULT_MEMBER_FEATURE_ACCESS);
}

export function guestFeatureAccessFor(
  event: Pick<Event, 'guestFeatureAccess'>,
): EventFeatureAccess {
  return normalizeFeatureAccess(event.guestFeatureAccess, DEFAULT_GUEST_FEATURE_ACCESS);
}

/** Event day has started (UTC calendar day of startDate). */
export function eventStartDateReached(
  event: Pick<Event, 'startDate'>,
  now = new Date(),
): boolean {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const start = Date.UTC(
    event.startDate.getUTCFullYear(),
    event.startDate.getUTCMonth(),
    event.startDate.getUTCDate(),
  );
  return today >= start;
}

export function resolveEffectiveFeatureAccess(input: {
  /**
   * True when the attendee should receive the member feature pack
   * (paid purchase / linked membership for this edition — not content carry).
   */
  entitled: boolean;
  event: Pick<Event, 'memberFeatureAccess' | 'guestFeatureAccess' | 'startDate'>;
  now?: Date;
}): {
  viewAgenda: boolean;
  viewMaterials: boolean;
  submitReviews: boolean;
  eventStarted: boolean;
  memberFeatureAccess: EventFeatureAccess;
  guestFeatureAccess: EventFeatureAccess;
} {
  const memberFeatureAccess = memberFeatureAccessFor(input.event);
  const guestFeatureAccess = guestFeatureAccessFor(input.event);
  const policy = input.entitled ? memberFeatureAccess : guestFeatureAccess;
  const eventStarted = eventStartDateReached(input.event, input.now);
  const viewAgenda = Boolean(policy.viewAgenda);
  return {
    memberFeatureAccess,
    guestFeatureAccess,
    eventStarted,
    viewAgenda,
    viewMaterials: viewAgenda && Boolean(policy.viewMaterials),
    submitReviews: viewAgenda && Boolean(policy.submitReviews) && eventStarted,
  };
}
