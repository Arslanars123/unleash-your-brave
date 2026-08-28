import Stripe from 'stripe';
import { env } from '../../config/env.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../core/errors/app-error.js';
import { formatEditionRange } from '../../core/format-date.js';
import { logger } from '../../core/logger.js';
import type { CouponService } from '../coupons/coupon.service.js';
import type { EventService } from '../events/event.service.js';
import type { MailService } from '../mail/mail.service.js';
import { computeMembershipPeriod } from '../memberships/membership-entitlement.js';
import type { Membership } from '../memberships/membership.types.js';
import { toPublicMembership } from '../memberships/membership.mapper.js';
import type { MembershipRepository } from '../memberships/membership.repository.js';
import type { MembershipService } from '../memberships/membership.service.js';
import type { RealtimeHub } from '../realtime/realtime.hub.js';
import type { UserRepository } from '../users/user.repository.js';
import type { UserService } from '../users/user.service.js';
import { toPublicMembershipPurchase } from './purchase.mapper.js';
import type { MembershipPurchaseRepository } from './purchase.repository.js';
import type {
  AttendeePurchaseSummary,
  CheckoutEligibility,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  MembershipPurchase,
  PublicMembershipPurchase,
  PurchaseKind,
} from './purchase.types.js';
import { PURCHASE_KINDS } from './purchase.types.js';

function moneyLabel(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount} ${currency.toUpperCase()}`;
  }
}

function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function splitDisplayName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Attendee', lastName: 'Attendee' };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: parts[0]! };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

export class CheckoutService {
  private stripe: Stripe | null = null;

  constructor(
    private readonly purchases: MembershipPurchaseRepository,
    private readonly memberships: MembershipRepository,
    private readonly users: UserRepository,
    private readonly userService: UserService,
    private readonly events: EventService,
    private readonly mail: MailService,
    private readonly realtimeHub: RealtimeHub,
    private readonly coupons?: CouponService,
    private readonly storeCheckout?: { fulfillCheckoutSession: (session: Stripe.Checkout.Session) => Promise<void> },
    private readonly membershipCatalog?: MembershipService,
  ) {}

  private requireStripe(): Stripe {
    if (!env.stripe.secretKey) {
      throw new BadRequestError('Stripe is not configured on the server');
    }
    if (!this.stripe) {
      this.stripe = new Stripe(env.stripe.secretKey, {
        apiVersion: '2025-02-24.acacia',
      });
    }
    return this.stripe;
  }

  private async listMembershipsForEvent(eventId: string) {
    if (this.membershipCatalog) {
      const { items } = await this.membershipCatalog.list({
        page: 1,
        perPage: 200,
        eventId,
      });
      return items;
    }

    const { items } = await this.memberships.list({
      page: 1,
      perPage: 200,
      eventId,
    });
    return items.map(toPublicMembership);
  }

  private catalogEventSummary(event: {
    id: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
    tagline: string;
    description: string;
    venueName: string;
    venueCity: string;
    coverImage: string | null;
    published: boolean;
  }) {
    return {
      id: event.id,
      name: event.name,
      status: event.status,
      startDate: event.startDate,
      endDate: event.endDate,
      tagline: event.tagline,
      description: event.description,
      venueName: event.venueName,
      venueCity: event.venueCity,
      coverImage: event.coverImage,
      published: event.published,
    };
  }

  async listCatalog(eventId?: string) {
    if (eventId) {
      const event = await this.events.getById(eventId);
      const memberships = await this.listMembershipsForEvent(event.id);
      const summary = this.catalogEventSummary(event);
      return {
        event: summary,
        memberships,
        events: [{ event: summary, memberships }],
      };
    }

    const available = await this.events.listAvailableForPurchase();
    const events = [];
    for (const event of available) {
      const memberships = await this.listMembershipsForEvent(event.id);
      events.push({
        event: this.catalogEventSummary(event),
        memberships,
      });
    }

    const primary = events[0] ?? null;
    return {
      event: primary?.event ?? null,
      memberships: primary?.memberships ?? [],
      events,
    };
  }

  private async resolveCheckoutEventId(
    membership: Membership,
    eventId?: string,
  ): Promise<string> {
    const resolved = eventId?.trim() || membership.eventId;
    if (!resolved) {
      throw new BadRequestError('Event is required for this membership');
    }
    if (this.membershipCatalog) {
      await this.membershipCatalog.assertLinkedToEvent(membership.id, resolved);
    } else if (membership.eventId && membership.eventId !== resolved) {
      throw new BadRequestError('Membership must be associated with this event edition');
    }
    return resolved;
  }

  async checkEligibility(
    email: string,
    membershipId: string,
    nameInput?: { firstName?: string; lastName?: string; eventId?: string },
  ): Promise<CheckoutEligibility> {
    const membership = await this.requireMembership(membershipId);
    const checkoutEventId = await this.resolveCheckoutEventId(membership, nameInput?.eventId);
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.users.findByEmail(normalizedEmail);

    const withAccount = (
      base: Omit<CheckoutEligibility, 'existingAccount'>,
    ): CheckoutEligibility => this.attachExistingAccount(base, existing, nameInput);

    // Event-scoped: what they already paid for on THIS edition.
    const paidForEvent = existing
      ? (await this.purchases.listByEmailAndEvent(normalizedEmail, checkoutEventId)).filter(
          (item) => item.paymentStatus === 'paid',
        )
      : [];
    const latestPaidForEvent = [...paidForEvent].sort(
      (a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime(),
    )[0];

    if (latestPaidForEvent) {
      if (latestPaidForEvent.membershipId === membership.id) {
        if (membership.billingKind === 'renewable') {
          return withAccount({
            allowed: true,
            reason: null,
            kind: 'renew',
            currentMembershipId: membership.id,
            currentMembershipName: membership.name,
            currentMembershipPrice: membership.price,
            targetMembershipId: membership.id,
            targetMembershipName: membership.name,
            targetMembershipPrice: membership.price,
            eventId: checkoutEventId,
          });
        }
        return withAccount({
          allowed: false,
          reason: 'You already have this membership for this event',
          kind: null,
          currentMembershipId: membership.id,
          currentMembershipName: membership.name,
          currentMembershipPrice: membership.price,
          targetMembershipId: membership.id,
          targetMembershipName: membership.name,
          targetMembershipPrice: membership.price,
          eventId: checkoutEventId,
        });
      }

      const currentOnEvent = await this.memberships.findById(latestPaidForEvent.membershipId);
      const currentPrice = currentOnEvent?.price ?? latestPaidForEvent.price;
      const currentName = currentOnEvent?.name ?? latestPaidForEvent.membershipName;
      const currentRank =
        currentOnEvent && (currentOnEvent.tierRank ?? 0) > 0
          ? currentOnEvent.tierRank
          : currentPrice;
      const targetRank = (membership.tierRank ?? 0) > 0 ? membership.tierRank : membership.price;

      if (targetRank <= currentRank) {
        return withAccount({
          allowed: false,
          reason:
            'You already have access to this event. You can only upgrade to a higher membership plan.',
          kind: null,
          currentMembershipId: latestPaidForEvent.membershipId,
          currentMembershipName: currentName,
          currentMembershipPrice: currentPrice,
          targetMembershipId: membership.id,
          targetMembershipName: membership.name,
          targetMembershipPrice: membership.price,
          eventId: checkoutEventId,
        });
      }

      return withAccount({
        allowed: true,
        reason: null,
        kind: 'upgrade',
        currentMembershipId: latestPaidForEvent.membershipId,
        currentMembershipName: currentName,
        currentMembershipPrice: currentPrice,
        targetMembershipId: membership.id,
        targetMembershipName: membership.name,
        targetMembershipPrice: membership.price,
        eventId: checkoutEventId,
      });
    }

    // No paid booking for this event yet — always allow a fresh purchase for
    // this edition, even if the user holds the same plan on another edition.
    return withAccount({
      allowed: true,
      reason: null,
      kind: 'purchase',
      currentMembershipId: null,
      currentMembershipName: null,
      currentMembershipPrice: null,
      targetMembershipId: membership.id,
      targetMembershipName: membership.name,
      targetMembershipPrice: membership.price,
      eventId: checkoutEventId,
    });
  }

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    const stripe = this.requireStripe();
    const email = input.email.trim().toLowerCase();
    let firstName = input.firstName.trim();
    let lastName = input.lastName.trim();
    const membership = await this.requireMembership(input.membershipId);
    const checkoutEventId = await this.resolveCheckoutEventId(membership, input.eventId);
    const event = await this.events.requireEvent(checkoutEventId);

    const eligibility = await this.checkEligibility(email, membership.id, {
      firstName,
      lastName,
      eventId: checkoutEventId,
    });
    if (!eligibility.allowed || !eligibility.kind) {
      throw new ConflictError(eligibility.reason ?? 'Purchase is not allowed');
    }

    const nameUpdateChoice = await this.resolveNameUpdateChoice(eligibility, input);
    if (nameUpdateChoice === 'keep' && eligibility.existingAccount) {
      const parts = splitDisplayName(eligibility.existingAccount.existingName);
      firstName = parts.firstName;
      lastName = parts.lastName;
    } else if (nameUpdateChoice === 'update' && eligibility.existingAccount) {
      await this.userService.updateAccountNameEverywhere(email, {
        firstName,
        lastName,
      });
    }

    this.assertMembershipUnchanged(membership, input);

    if (!(membership.price > 0)) {
      throw new BadRequestError('Membership must have a price greater than zero for Stripe checkout');
    }

    const successUrl = this.resolveRedirectUrl(
      input.successUrl,
      env.stripe.successUrl,
      'success URL',
    );
    const cancelUrl = this.resolveRedirectUrl(
      input.cancelUrl,
      env.stripe.cancelUrl,
      'cancel URL',
    );

    const currency = env.stripe.currency;
    let chargedPrice = membership.price;
    let originalPrice = membership.price;
    let discountAmount = 0;
    let couponCode: string | null = null;
    let couponId: string | null = null;

    if (input.couponCode?.trim()) {
      if (!this.coupons) {
        throw new BadRequestError('Coupons are not available');
      }
      const applied = await this.coupons.applyCoupon(
        input.couponCode,
        membership.id,
        membership.price,
      );
      chargedPrice = applied.finalPrice;
      originalPrice = applied.originalPrice;
      discountAmount = applied.discountAmount;
      couponCode = applied.code;
      couponId = applied.couponId;
    }

    const unitAmount = Math.round(chargedPrice * 100);
    if (unitAmount < 50) {
      throw new BadRequestError(
        chargedPrice < membership.price
          ? 'Discounted price is below the Stripe minimum charge ($0.50). Use a smaller discount.'
          : 'Membership price is below the Stripe minimum charge ($0.50)',
      );
    }

    const eventDateLabel = formatEditionRange(event.startDate, event.endDate);
    const membershipBlurb = membership.description?.trim();
    const productDescription = membershipBlurb
      ? `${event.name} · ${eventDateLabel}\n${membershipBlurb}`
      : `${event.name} · ${eventDateLabel}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      client_reference_id: email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: `${membership.name} — ${event.name} (${eventDateLabel})`,
              description: productDescription,
            },
          },
        },
      ],
      metadata: {
        membershipId: membership.id,
        membershipName: membership.name,
        eventId: event.id,
        eventName: event.name,
        eventStartDate: event.startDate.toISOString(),
        eventEndDate: event.endDate.toISOString(),
        eventDateLabel,
        email,
        firstName,
        lastName,
        kind: eligibility.kind,
        previousMembershipId: eligibility.currentMembershipId ?? '',
        previousMembershipName: eligibility.currentMembershipName ?? '',
        couponCode: couponCode ?? '',
        couponId: couponId ?? '',
        originalPrice: String(originalPrice),
        discountAmount: String(discountAmount),
        chargedPrice: String(chargedPrice),
        nameUpdateChoice: nameUpdateChoice ?? '',
      },
    });

    if (!session.url) {
      throw new BadRequestError('Stripe did not return a checkout URL');
    }

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
      kind: eligibility.kind,
      membershipId: membership.id,
      membershipName: membership.name,
      price: chargedPrice,
      originalPrice,
      discountAmount,
      couponCode,
      currency,
      eventId: event.id,
    };
  }

  async getSessionStatus(sessionId: string) {
    const stripe = this.requireStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const purchase = await this.purchases.findByStripeCheckoutSessionId(sessionId);
    const metadata = session.metadata ?? {};

    let eventName = metadata.eventName?.trim() || null;
    let eventDateLabel = metadata.eventDateLabel?.trim() || null;
    const eventId = metadata.eventId?.trim() || purchase?.eventId || null;

    if (eventId && (!eventName || !eventDateLabel)) {
      try {
        const event = await this.events.getById(eventId);
        eventName = eventName ?? event.name;
        eventDateLabel =
          eventDateLabel ?? formatEditionRange(event.startDate, event.endDate);
      } catch {
        // Session may reference a removed edition — keep Stripe metadata only.
      }
    }

    const membershipName =
      purchase?.membershipName ?? metadata.membershipName?.trim() ?? null;
    const kind =
      purchase?.kind ??
      (metadata.kind && PURCHASE_KINDS.includes(metadata.kind as PurchaseKind)
        ? (metadata.kind as PurchaseKind)
        : null);

    return {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      status: session.status,
      fulfilled: Boolean(purchase),
      purchase: purchase ? toPublicMembershipPurchase(purchase) : null,
      eventName,
      eventDateLabel,
      membershipName,
      kind,
    };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
    const stripe = this.requireStripe();
    if (!env.stripe.webhookSecret) {
      throw new BadRequestError('Stripe webhook secret is not configured');
    }
    if (!signature) {
      throw new BadRequestError('Missing Stripe signature');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, env.stripe.webhookSecret);
    } catch (error) {
      logger.warn({ err: error }, 'Stripe webhook signature verification failed');
      throw new BadRequestError('Invalid Stripe webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.purchaseType === 'store') {
        if (!this.storeCheckout) {
          logger.error({ sessionId: session.id }, 'Store checkout handler is not configured');
          throw new BadRequestError('Store checkout is not configured');
        }
        await this.storeCheckout.fulfillCheckoutSession(session);
        return;
      }
      await this.fulfillCheckoutSession(session);
      return;
    }

    if (event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.purchaseType === 'store') {
        if (!this.storeCheckout) {
          logger.error({ sessionId: session.id }, 'Store checkout handler is not configured');
          throw new BadRequestError('Store checkout is not configured');
        }
        await this.storeCheckout.fulfillCheckoutSession(session);
        return;
      }
      await this.fulfillCheckoutSession(session);
      return;
    }

    logger.debug({ type: event.type }, 'Ignoring Stripe webhook event');
  }

  async listPurchasesForUser(userId: string): Promise<PublicMembershipPurchase[]> {
    const items = await this.purchases.listByUserId(userId);
    return items.map(toPublicMembershipPurchase);
  }

  async listPaidPurchaserIdsForEvent(eventId: string): Promise<string[]> {
    return this.purchases.listPaidUserIdsByEvent(eventId);
  }

  async getAttendeePurchaseSummary(
    userId: string,
    eventId?: string,
  ): Promise<AttendeePurchaseSummary> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User');

    const all = await this.purchases.listByUserId(userId);
    const paidAll = all.filter((p) => p.paymentStatus === 'paid');
    const preferred = eventId
      ? paidAll.filter((p) => p.eventId === eventId)
      : [];
    // When an event filter is applied, put that edition's purchases first, then the rest.
    const paid = eventId
      ? [
          ...preferred,
          ...paidAll.filter((p) => p.eventId !== eventId),
        ]
      : paidAll;

    const eventPaid = eventId ? preferred : paid;
    const original = (eventId ? eventPaid : paid)[0] ?? paid[0] ?? null;
    const latest =
      (eventId ? eventPaid : paid).length > 0
        ? (eventId ? eventPaid : paid)[(eventId ? eventPaid : paid).length - 1]!
        : paid.length > 0
          ? paid[paid.length - 1]!
          : null;
    const upgrades = paid.filter((p) => p.kind === 'upgrade');
    const renewals = paid.filter((p) => p.kind === 'renew');

    const focusMembershipId =
      latest?.membershipId ??
      (eventId ? null : user.membershipId) ??
      user.membershipId;

    let currentMembershipName: string | null = null;
    let currentBillingKind: 'one_time' | 'renewable' | null = null;
    let currentMembershipId: string | null = focusMembershipId;
    if (focusMembershipId) {
      const membership = await this.memberships.findById(focusMembershipId);
      currentMembershipName = membership?.name ?? latest?.membershipName ?? null;
      currentBillingKind =
        membership?.billingKind === 'renewable' ? 'renewable' : membership ? 'one_time' : null;
    } else if (latest) {
      currentMembershipId = latest.membershipId;
      currentMembershipName = latest.membershipName;
    }

    const now = Date.now();
    let currentMembershipStatus = user.membershipStatus ?? null;
    if (
      user.membershipExpiresAt &&
      user.membershipExpiresAt.getTime() <= now &&
      currentMembershipStatus !== 'expired'
    ) {
      currentMembershipStatus = 'expired';
    } else if (currentMembershipId && !currentMembershipStatus) {
      currentMembershipStatus = 'active';
    }

    return {
      currentMembershipId,
      currentMembershipName,
      currentMembershipStatus,
      currentMembershipExpiresAt: user.membershipExpiresAt
        ? user.membershipExpiresAt.toISOString()
        : null,
      currentBillingKind,
      originalMembershipId: original?.membershipId ?? currentMembershipId,
      originalMembershipName: original?.membershipName ?? currentMembershipName,
      purchases: paid.map(toPublicMembershipPurchase),
      upgrades: upgrades.map(toPublicMembershipPurchase),
      renewals: renewals.map(toPublicMembershipPurchase),
      latestPurchase: latest ? toPublicMembershipPurchase(latest) : null,
    };
  }

  private async fulfillCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
    const existing = await this.purchases.findByStripeCheckoutSessionId(session.id);
    if (existing) {
      logger.info({ sessionId: session.id }, 'Stripe checkout already fulfilled');
      return;
    }

    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
      logger.info(
        { sessionId: session.id, paymentStatus: session.payment_status },
        'Skipping Stripe fulfill — payment not complete',
      );
      return;
    }

    const metadata = session.metadata ?? {};
    const membershipId = metadata.membershipId?.trim();
    const email = (metadata.email || session.customer_email || session.customer_details?.email || '')
      .trim()
      .toLowerCase();
    const firstName =
      metadata.firstName?.trim() ||
      session.customer_details?.name?.split(/\s+/)[0] ||
      '';
    const lastName =
      metadata.lastName?.trim() ||
      session.customer_details?.name?.split(/\s+/).slice(1).join(' ') ||
      '';

    if (!membershipId || !email) {
      logger.error({ sessionId: session.id }, 'Stripe session missing membershipId or email');
      throw new BadRequestError('Checkout session is missing required metadata');
    }

    const membership = await this.requireMembership(membershipId);
    const checkoutEventId = await this.resolveCheckoutEventId(
      membership,
      metadata.eventId?.trim() || undefined,
    );
    const event = await this.events.requireEvent(checkoutEventId);

    // Re-validate at fulfill time (race / stale session).
    const eligibility = await this.checkEligibility(email, membership.id, {
      eventId: checkoutEventId,
    });
    if (!eligibility.allowed || !eligibility.kind) {
      logger.warn(
        { sessionId: session.id, email, reason: eligibility.reason },
        'Stripe payment received but purchase no longer eligible',
      );
      // Already has this one-time tier (duplicate webhook) — no-op.
      if (
        eligibility.currentMembershipId === membership.id &&
        membership.billingKind !== 'renewable'
      ) {
        return;
      }
      // If they somehow paid for a downgrade after buying higher elsewhere, keep higher and log.
      if (
        eligibility.currentMembershipPrice != null &&
        membership.price <= eligibility.currentMembershipPrice &&
        eligibility.kind !== 'renew'
      ) {
        logger.error(
          { sessionId: session.id, email, membershipId },
          'Paid checkout would downgrade membership — skipping membership change',
        );
        return;
      }
      if (!eligibility.allowed) {
        throw new ConflictError(eligibility.reason ?? 'Purchase is not allowed');
      }
    }

    const kind: PurchaseKind = eligibility.kind ?? 'purchase';
    const previousMembershipId = eligibility.currentMembershipId;
    const previousMembershipName = eligibility.currentMembershipName;

    const nameUpdateChoice = metadata.nameUpdateChoice?.trim();
    const applyName = nameUpdateChoice !== 'keep';

    const upsert = await this.userService.upsertFromPurchase({
      email,
      firstName,
      lastName,
      product: membership.name,
      applyName,
    });

    const existingUser = await this.users.findById(upsert.user.id);
    const period = computeMembershipPeriod({
      membership,
      currentExpiresAt: existingUser?.membershipExpiresAt ?? null,
    });

    await this.users.update(upsert.user.id, {
      membershipId: membership.id,
      title: membership.name,
      membershipStatus: period.membershipStatus,
      membershipExpiresAt: period.periodEnd,
      renewalReminderSentAt: null,
      qrRenewalBlockedNoticeSentAt: null,
    });

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;

    let purchase: MembershipPurchase;
    try {
      const chargedFromMeta = Number(metadata.chargedPrice);
      const originalFromMeta = Number(metadata.originalPrice);
      const discountFromMeta = Number(metadata.discountAmount);
      const chargedPrice =
        Number.isFinite(chargedFromMeta) && chargedFromMeta > 0
          ? chargedFromMeta
          : session.amount_total != null
            ? session.amount_total / 100
            : membership.price;
      const originalPrice =
        Number.isFinite(originalFromMeta) && originalFromMeta > 0
          ? originalFromMeta
          : membership.price;
      const discountAmount =
        Number.isFinite(discountFromMeta) && discountFromMeta >= 0
          ? discountFromMeta
          : Math.max(0, originalPrice - chargedPrice);
      const couponCode = metadata.couponCode?.trim() || null;
      const couponId = metadata.couponId?.trim() || null;

      purchase = await this.purchases.create({
        eventId: event.id,
        userId: upsert.user.id,
        email,
        firstName,
        lastName,
        membershipId: membership.id,
        membershipName: membership.name,
        price: chargedPrice,
        currency: (session.currency ?? env.stripe.currency).toLowerCase(),
        couponCode,
        couponId,
        originalPrice,
        discountAmount,
        kind,
        previousMembershipId,
        previousMembershipName,
        paymentStatus: 'paid',
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        stripeCustomerId: customerId,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        purchasedAt: new Date(),
      });

      if (couponId && this.coupons) {
        await this.coupons.recordRedemption(couponId);
      }
    } catch (error) {
      // Unique index race — another worker fulfilled first.
      const raced = await this.purchases.findByStripeCheckoutSessionId(session.id);
      if (raced) return;
      throw error;
    }

    this.realtimeHub.publish({
      type: 'attendee.upserted',
      payload: {
        id: upsert.user.id,
        email,
        name: upsert.user.name,
        firstName,
        lastName,
        created: upsert.created,
        membershipId: membership.id,
        membershipName: membership.name,
        kind,
        product: membership.name,
        amount: membership.price,
      },
    });

    // Fresh invite when first-time setup is still needed; otherwise tell them to use
    // their existing email + password (speaker/sponsor/member with password already set).
    if (upsert.inviteCode) {
      await this.mail.sendInviteCode({
        to: email,
        name: upsert.user.name,
        inviteCode: upsert.inviteCode,
        expiresAt: new Date(Date.now() + env.inviteCodeTtlDays * 24 * 60 * 60 * 1000),
        dualAccess: Boolean(upsert.user.speakerId || upsert.user.sponsorId),
      });
    } else if (!upsert.created) {
      await this.mail.sendExistingAccountMembershipAccess({
        to: email,
        name: upsert.user.name,
        membershipName: membership.name,
        role: upsert.user.role,
        speakerId: upsert.user.speakerId,
        sponsorId: upsert.user.sponsorId,
      });
    }

    await this.mail.sendMembershipPurchaseConfirmation({
      to: email,
      name: upsert.user.name,
      eventName: event.name,
      membershipName: membership.name,
      previousMembershipName: kind === 'upgrade' ? previousMembershipName : null,
      kind,
      priceLabel: moneyLabel(purchase.price, purchase.currency),
      purchasedAt: purchase.purchasedAt,
      stripePaymentIntentId: paymentIntentId,
      periodEnd: period.periodEnd,
    });

    logger.info(
      {
        sessionId: session.id,
        userId: upsert.user.id,
        membershipId: membership.id,
        kind,
        periodEnd: period.periodEnd?.toISOString() ?? null,
      },
      'Membership purchase fulfilled from Stripe',
    );
  }

  private attachExistingAccount(
    base: Omit<CheckoutEligibility, 'existingAccount'>,
    existing: Awaited<ReturnType<UserRepository['findByEmail']>>,
    nameInput?: { firstName?: string; lastName?: string },
  ): CheckoutEligibility {
    if (!existing) {
      return { ...base, existingAccount: null };
    }

    const hasNameInput = Boolean(
      nameInput?.firstName?.trim() || nameInput?.lastName?.trim(),
    );
    const proposedName = hasNameInput
      ? [nameInput?.firstName?.trim(), nameInput?.lastName?.trim()]
          .filter(Boolean)
          .join(' ')
          .trim()
      : null;
    const existingName = existing.name.trim();
    const nameConflict =
      proposedName != null &&
      normalizePersonName(existingName) !== normalizePersonName(proposedName);

    return {
      ...base,
      existingAccount: {
        exists: true,
        role: existing.role,
        existingName,
        proposedName,
        nameConflict,
        hasPassword: !existing.mustChangePassword,
        needsInvite: existing.mustChangePassword,
      },
    };
  }

  private async resolveNameUpdateChoice(
    eligibility: CheckoutEligibility,
    input: CreateCheckoutSessionInput,
  ): Promise<'update' | 'keep' | null> {
    const account = eligibility.existingAccount;
    if (!account?.nameConflict) {
      return null;
    }
    if (input.nameUpdateChoice === 'update' || input.nameUpdateChoice === 'keep') {
      return input.nameUpdateChoice;
    }
    throw new ConflictError(
      `This email is already registered under the name ${account.existingName}. Would you like to update your name to ${account.proposedName} across your account?`,
      {
        existingName: account.existingName,
        proposedName: account.proposedName,
        role: account.role,
      },
      'NAME_CONFLICT',
    );
  }

  private assertMembershipUnchanged(
    membership: Membership,
    input: Pick<CreateCheckoutSessionInput, 'expectedPrice' | 'expectedUpdatedAt'>,
  ): void {
    const liveCents = Math.round(membership.price * 100);
    if (input.expectedPrice != null && Number.isFinite(input.expectedPrice)) {
      const shownCents = Math.round(input.expectedPrice * 100);
      if (shownCents !== liveCents) {
        throw new ConflictError(
          `This membership was updated. The current price is ${moneyLabel(membership.price, env.stripe.currency)}. Review the new details before paying.`,
          { membership: toPublicMembership(membership) },
          'MEMBERSHIP_CHANGED',
        );
      }
    }

    if (input.expectedUpdatedAt) {
      const shown = Date.parse(input.expectedUpdatedAt);
      const live = membership.updatedAt.getTime();
      if (!Number.isNaN(shown) && shown !== live) {
        throw new ConflictError(
          'This membership was updated. Please review the new price and details before paying.',
          { membership: toPublicMembership(membership) },
          'MEMBERSHIP_CHANGED',
        );
      }
    }
  }

  private resolveRedirectUrl(
    override: string | undefined,
    fallback: string,
    label: string,
  ): string {
    const url = (override?.trim() || fallback).trim();
    if (!url) {
      throw new BadRequestError(`Stripe ${label} is not configured`);
    }
    if (!url.includes('{CHECKOUT_SESSION_ID}') && label === 'success URL') {
      // Stripe allows optional placeholder; both forms are fine.
    }
    try {
      // eslint-disable-next-line no-new
      new URL(url.replace('{CHECKOUT_SESSION_ID}', 'cs_test'));
    } catch {
      throw new BadRequestError(`Invalid Stripe ${label}`);
    }
    return url;
  }

  private async requireMembership(id: string): Promise<Membership> {
    const membership = await this.memberships.findById(id);
    if (!membership) throw new NotFoundError('Membership');
    return membership;
  }
}
