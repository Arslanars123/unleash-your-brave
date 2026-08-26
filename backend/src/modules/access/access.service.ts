import { isMembershipPaymentActive } from '../memberships/membership-entitlement.js';
import type { MembershipPurchaseRepository } from '../checkout/purchase.repository.js';
import {
  resolveEffectiveFeatureAccess,
  type EventFeatureAccess,
} from '../events/event-feature-access.js';
import type { EventService } from '../events/event.service.js';
import type { Event } from '../events/event.types.js';
import type { MembershipRepository } from '../memberships/membership.repository.js';
import type { Membership } from '../memberships/membership.types.js';
import type { UserRepository } from '../users/user.repository.js';
import type { MembershipStatus, User } from '../users/user.types.js';

/** Why check-in QR is not available (null when qrEntitled). */
export type QrDeniedReason =
  | null
  | 'no_membership'
  | 'account_inactive'
  | 'renewal_payment_required'
  | 'membership_not_valid_for_qr';

export interface EffectiveEventAccess {
  eventId: string;
  allowPreviousAttendeesAccess: boolean;
  /** Admin rule: unpaid/expired renewable memberships block QR (default true). */
  blockQrWhenRenewalUnpaid: boolean;
  /** User may view this edition’s app content (sessions/open areas). */
  entitled: boolean;
  /** User may receive a check-in QR for this edition. */
  qrEntitled: boolean;
  /** Access comes from a previous edition membership. */
  carriedFromPrevious: boolean;
  /** Membership UUID(s) that unlock restricted sessions on this event. */
  accessibleMembershipIds: string[];
  /** Best single membership id for this event (mapped or owned). */
  effectiveMembershipId: string | null;
  effectiveMembershipName: string | null;
  sourceMembershipId: string | null;
  sourceMembershipName: string | null;
  validForFutureEvents: boolean;
  validForFutureQr: boolean;
  billingKind: 'one_time' | 'renewable' | null;
  membershipStatus: MembershipStatus | null;
  membershipExpiresAt: string | null;
  /** True when the paid period is still valid (independent of admin QR rule). */
  paymentPeriodActive: boolean;
  /** Set when qrEntitled is false. */
  qrDeniedReason: QrDeniedReason;
  /**
   * Upgrade options the app should show for this user on this event.
   * Empty = show purchase catalog as-is (no current pass).
   * One id = only that next level.
   */
  upgradeMembershipIds: string[];
  /** Effective: session list + session details. */
  viewAgenda: boolean;
  /** Effective: session materials (requires viewAgenda). */
  viewMaterials: boolean;
  /** Effective: submit reviews (requires viewAgenda + event started). */
  submitReviews: boolean;
  /** True once the edition start date (UTC day) has arrived. */
  eventStarted: boolean;
  /** Admin-configured pack for entitled attendees. */
  memberFeatureAccess: EventFeatureAccess;
  /** Admin-configured pack for non-entitled attendees. */
  guestFeatureAccess: EventFeatureAccess;
}

/** Default true when the field is missing on older event documents. */
export function isBlockQrWhenRenewalUnpaid(
  event: { blockQrWhenRenewalUnpaid?: boolean | null },
): boolean {
  return event.blockQrWhenRenewalUnpaid !== false;
}

/**
 * Whether payment status allows QR under the admin rule.
 * When the rule is off, renewable members keep QR even if unpaid/expired.
 */
export function paymentAllowsQr(input: {
  billingKind: Membership['billingKind'] | null | undefined;
  paymentActive: boolean;
  blockQrWhenRenewalUnpaid: boolean;
  hasMembership: boolean;
}): boolean {
  if (!input.hasMembership) return false;
  if (input.billingKind === 'renewable' && !input.blockQrWhenRenewalUnpaid) {
    return true;
  }
  return input.paymentActive;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function upgradeRank(membership: Membership): number {
  if ((membership.tierRank ?? 0) > 0) return membership.tierRank;
  return membership.price;
}

function mapPastToCurrent(
  past: Membership,
  currentEventMemberships: Membership[],
): Membership | null {
  const byName = currentEventMemberships.find(
    (item) => normalizeName(item.name) === normalizeName(past.name),
  );
  if (byName) return byName;

  if ((past.tierRank ?? 0) > 0) {
    const byRank = currentEventMemberships.find(
      (item) => (item.tierRank ?? 0) === past.tierRank,
    );
    if (byRank) return byRank;
  }

  return null;
}

function nextUpgradeIds(
  current: Membership,
  catalog: Membership[],
): string[] {
  if (current.upgradeToMembershipId) {
    const explicit = catalog.find((item) => item.id === current.upgradeToMembershipId);
    if (explicit && explicit.id !== current.id) return [explicit.id];
  }

  const rank = upgradeRank(current);
  const higher = catalog
    .filter((item) => item.id !== current.id && upgradeRank(item) > rank)
    .sort((a, b) => {
      const rankDiff = upgradeRank(a) - upgradeRank(b);
      if (rankDiff !== 0) return rankDiff;
      return a.sortOrder - b.sortOrder;
    });

  return higher[0] ? [higher[0].id] : [];
}

function userPaymentFields(user: User | null | undefined) {
  return {
    membershipStatus: (user?.membershipStatus ?? null) as MembershipStatus | null,
    membershipExpiresAt: user?.membershipExpiresAt
      ? user.membershipExpiresAt.toISOString()
      : null,
    paymentPeriodActive: user ? isMembershipPaymentActive(user) : false,
  };
}

function emptyAccess(
  eventId: string,
  extras: Partial<EffectiveEventAccess> = {},
): EffectiveEventAccess {
  return {
    eventId,
    allowPreviousAttendeesAccess: false,
    blockQrWhenRenewalUnpaid: true,
    entitled: false,
    qrEntitled: false,
    carriedFromPrevious: false,
    accessibleMembershipIds: [],
    effectiveMembershipId: null,
    effectiveMembershipName: null,
    sourceMembershipId: null,
    sourceMembershipName: null,
    validForFutureEvents: false,
    validForFutureQr: false,
    billingKind: null,
    membershipStatus: null,
    membershipExpiresAt: null,
    paymentPeriodActive: false,
    qrDeniedReason: 'no_membership',
    upgradeMembershipIds: [],
    viewAgenda: false,
    viewMaterials: false,
    submitReviews: false,
    eventStarted: false,
    memberFeatureAccess: {
      viewAgenda: true,
      viewMaterials: true,
      submitReviews: true,
    },
    guestFeatureAccess: {
      viewAgenda: false,
      viewMaterials: false,
      submitReviews: false,
    },
    ...extras,
  };
}

function attachFeatureAccess(
  access: EffectiveEventAccess,
  event: Event,
): EffectiveEventAccess {
  const features = resolveEffectiveFeatureAccess({
    entitled: access.entitled,
    event,
  });
  return {
    ...access,
    ...features,
  };
}

function denyReasonForUnpaidRenewable(input: {
  billingKind: Membership['billingKind'];
  paymentActive: boolean;
  blockUnpaid: boolean;
  qrWouldOtherwiseApply: boolean;
}): QrDeniedReason {
  if (!input.qrWouldOtherwiseApply) return 'membership_not_valid_for_qr';
  if (
    input.billingKind === 'renewable' &&
    input.blockUnpaid &&
    !input.paymentActive
  ) {
    return 'renewal_payment_required';
  }
  if (!input.paymentActive) return 'renewal_payment_required';
  return 'membership_not_valid_for_qr';
}

/**
 * Resolves whether a member can access a given event edition’s content and QR,
 * including carry-forward from previous memberships.
 *
 * Content and QR are independent for previous-edition holders:
 * - content: `validForFutureEvents` OR event `allowPreviousAttendeesAccess`
 * - QR: `validForFutureQr` only (never granted by the event-wide content toggle alone)
 *
 * Renewable QR can additionally be blocked when payment is unpaid/expired if
 * `blockQrWhenRenewalUnpaid` is enabled (default).
 */
export class EffectiveAccessService {
  constructor(
    private readonly users: UserRepository,
    private readonly memberships: MembershipRepository,
    private readonly events: EventService,
    private readonly purchases?: MembershipPurchaseRepository,
  ) {}

  async resolveForUser(
    userId: string,
    eventId?: string,
  ): Promise<EffectiveEventAccess> {
    const event = eventId
      ? await this.events.requireEvent(eventId)
      : (await this.events.getPreferred()) ?? (await this.events.getLatest());
    if (!event) {
      return emptyAccess(eventId ?? '');
    }

    return attachFeatureAccess(await this.resolveEntitlement(userId, event), event);
  }

  private async resolveEntitlement(
    userId: string,
    event: Event,
  ): Promise<EffectiveEventAccess> {
    const allowPrevious = Boolean(event.allowPreviousAttendeesAccess);
    const blockUnpaid = isBlockQrWhenRenewalUnpaid(event);
    const { items: catalog } = await this.memberships.list({
      page: 1,
      perPage: 100,
      eventId: event.id,
    });

    const user = await this.users.findById(userId);
    const payment = userPaymentFields(user);

    const isAttendee =
      user != null &&
      user.status === 'active' &&
      (user.role === 'member' || Boolean(user.membershipId));

    if (!user || user.status !== 'active') {
      return emptyAccess(event.id, {
        allowPreviousAttendeesAccess: allowPrevious,
        blockQrWhenRenewalUnpaid: blockUnpaid,
        ...payment,
        qrDeniedReason: 'account_inactive',
        upgradeMembershipIds: catalog.map((item) => item.id),
      });
    }

    if (!isAttendee) {
      return emptyAccess(event.id, {
        allowPreviousAttendeesAccess: allowPrevious,
        blockQrWhenRenewalUnpaid: blockUnpaid,
        ...payment,
        qrDeniedReason: 'no_membership',
        upgradeMembershipIds: catalog.map((item) => item.id),
      });
    }

    // Prefer a paid purchase for THIS event (supports multi-event bookings).
    const eventPurchaseMembership = await this.resolveMembershipFromPurchases(
      user,
      event.id,
    );
    if (eventPurchaseMembership) {
      return this.buildSameEditionAccess({
        eventId: event.id,
        allowPrevious,
        blockUnpaid,
        source: eventPurchaseMembership,
        catalog,
        payment,
        carriedFromPrevious: false,
      });
    }

    const sourceId = user.membershipId;
    if (!sourceId) {
      return emptyAccess(event.id, {
        allowPreviousAttendeesAccess: allowPrevious,
        blockQrWhenRenewalUnpaid: blockUnpaid,
        ...payment,
        qrDeniedReason: 'no_membership',
        upgradeMembershipIds: catalog.map((item) => item.id),
      });
    }

    const source = await this.memberships.findById(sourceId);
    if (!source) {
      return emptyAccess(event.id, {
        allowPreviousAttendeesAccess: allowPrevious,
        blockQrWhenRenewalUnpaid: blockUnpaid,
        sourceMembershipId: sourceId,
        ...payment,
        qrDeniedReason: 'no_membership',
        upgradeMembershipIds: catalog.map((item) => item.id),
      });
    }

    const validForFutureEvents = Boolean(source.validForFutureEvents);
    const validForFutureQr = Boolean(source.validForFutureQr);
    const paymentActive = payment.paymentPeriodActive;
    const billingKind = source.billingKind ?? 'one_time';
    const paymentOk = paymentAllowsQr({
      billingKind,
      paymentActive,
      blockQrWhenRenewalUnpaid: blockUnpaid,
      hasMembership: true,
    });

    // Same-edition membership — content when they hold the tier; QR gated by payment rule.
    if (source.eventId === event.id) {
      return this.buildSameEditionAccess({
        eventId: event.id,
        allowPrevious,
        blockUnpaid,
        source,
        catalog,
        payment,
        carriedFromPrevious: false,
      });
    }

    const contentCarry = validForFutureEvents || allowPrevious;
    const qrCarryBase = validForFutureQr;
    const qrCarry = qrCarryBase && paymentOk;

    if (!contentCarry && !qrCarry) {
      return emptyAccess(event.id, {
        allowPreviousAttendeesAccess: allowPrevious,
        blockQrWhenRenewalUnpaid: blockUnpaid,
        sourceMembershipId: source.id,
        sourceMembershipName: source.name,
        validForFutureEvents,
        validForFutureQr,
        billingKind,
        membershipStatus: payment.membershipStatus,
        membershipExpiresAt: payment.membershipExpiresAt,
        paymentPeriodActive: paymentActive,
        qrDeniedReason: denyReasonForUnpaidRenewable({
          billingKind,
          paymentActive,
          blockUnpaid,
          qrWouldOtherwiseApply: qrCarryBase,
        }),
        upgradeMembershipIds: catalog.map((item) => item.id),
      });
    }

    const mapped = mapPastToCurrent(source, catalog);
    if (mapped) {
      return {
        ...emptyAccess(event.id),
        eventId: event.id,
        allowPreviousAttendeesAccess: allowPrevious,
        blockQrWhenRenewalUnpaid: blockUnpaid,
        entitled: contentCarry,
        qrEntitled: qrCarry,
        carriedFromPrevious: true,
        accessibleMembershipIds: contentCarry ? [mapped.id] : [],
        effectiveMembershipId: contentCarry ? mapped.id : null,
        effectiveMembershipName: contentCarry ? mapped.name : null,
        sourceMembershipId: source.id,
        sourceMembershipName: source.name,
        validForFutureEvents,
        validForFutureQr,
        billingKind,
        membershipStatus: payment.membershipStatus,
        membershipExpiresAt: payment.membershipExpiresAt,
        paymentPeriodActive: paymentActive,
        qrDeniedReason: qrCarry
          ? null
          : denyReasonForUnpaidRenewable({
              billingKind,
              paymentActive,
              blockUnpaid,
              qrWouldOtherwiseApply: qrCarryBase,
            }),
        upgradeMembershipIds: contentCarry
          ? nextUpgradeIds(mapped, catalog)
          : catalog.map((item) => item.id),
      };
    }

    // Carry-eligible but no matching tier on the new edition:
    // open sessions when content carry is on; QR only when membership QR flag + payment rule allow.
    return {
      ...emptyAccess(event.id),
      eventId: event.id,
      allowPreviousAttendeesAccess: allowPrevious,
      blockQrWhenRenewalUnpaid: blockUnpaid,
      entitled: contentCarry,
      qrEntitled: qrCarry,
      carriedFromPrevious: true,
      accessibleMembershipIds: [],
      effectiveMembershipId: null,
      effectiveMembershipName: null,
      sourceMembershipId: source.id,
      sourceMembershipName: source.name,
      validForFutureEvents,
      validForFutureQr,
      billingKind,
      membershipStatus: payment.membershipStatus,
      membershipExpiresAt: payment.membershipExpiresAt,
      paymentPeriodActive: paymentActive,
      qrDeniedReason: qrCarry
        ? null
        : denyReasonForUnpaidRenewable({
            billingKind,
            paymentActive,
            blockUnpaid,
            qrWouldOtherwiseApply: qrCarryBase,
          }),
      upgradeMembershipIds: catalog.map((item) => item.id),
    };
  }

  private async resolveMembershipFromPurchases(
    user: User,
    eventId: string,
  ): Promise<Membership | null> {
    if (!this.purchases) return null;
    const purchases = await this.purchases.listByUserId(user.id);
    const paidForEvent = purchases
      .filter((item) => item.eventId === eventId && item.paymentStatus === 'paid')
      .sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
    const latest = paidForEvent[0];
    if (!latest) return null;
    return this.memberships.findById(latest.membershipId);
  }

  private buildSameEditionAccess(input: {
    eventId: string;
    allowPrevious: boolean;
    blockUnpaid: boolean;
    source: Membership;
    catalog: Membership[];
    payment: ReturnType<typeof userPaymentFields>;
    carriedFromPrevious: boolean;
  }): EffectiveEventAccess {
    const { source, catalog, payment, allowPrevious, blockUnpaid } = input;
    const validForFutureEvents = Boolean(source.validForFutureEvents);
    const validForFutureQr = Boolean(source.validForFutureQr);
    const paymentActive = payment.paymentPeriodActive;
    const billingKind = source.billingKind ?? 'one_time';
    const paymentOk = paymentAllowsQr({
      billingKind,
      paymentActive,
      blockQrWhenRenewalUnpaid: blockUnpaid,
      hasMembership: true,
    });
    const qrEntitled = paymentOk;
    return {
      ...emptyAccess(input.eventId),
      eventId: input.eventId,
      allowPreviousAttendeesAccess: allowPrevious,
      blockQrWhenRenewalUnpaid: blockUnpaid,
      entitled: true,
      qrEntitled,
      carriedFromPrevious: input.carriedFromPrevious,
      accessibleMembershipIds: [source.id],
      effectiveMembershipId: source.id,
      effectiveMembershipName: source.name,
      sourceMembershipId: source.id,
      sourceMembershipName: source.name,
      validForFutureEvents,
      validForFutureQr,
      billingKind,
      membershipStatus: payment.membershipStatus,
      membershipExpiresAt: payment.membershipExpiresAt,
      paymentPeriodActive: paymentActive,
      qrDeniedReason: qrEntitled
        ? null
        : denyReasonForUnpaidRenewable({
            billingKind,
            paymentActive,
            blockUnpaid,
            qrWouldOtherwiseApply: true,
          }),
      upgradeMembershipIds: nextUpgradeIds(source, catalog),
    };
  }
}
