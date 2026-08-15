import Stripe from 'stripe';
import { env } from '../../config/env.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../core/errors/app-error.js';
import { logger } from '../../core/logger.js';
import type { EventService } from '../events/event.service.js';
import type { MailService } from '../mail/mail.service.js';
import type { Membership } from '../memberships/membership.types.js';
import { toPublicMembership } from '../memberships/membership.mapper.js';
import type { MembershipRepository } from '../memberships/membership.repository.js';
import type { RealtimeHub } from '../realtime/realtime.hub.js';
import type { UserRepository } from '../users/user.repository.js';
import type { UserService } from '../users/user.service.js';
import { toPublicMembershipPurchase } from './purchase.mapper.js';
import type { MembershipPurchaseRepository } from './purchase.repository.js';
import type {
  CheckoutEligibility,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  MembershipPurchase,
  PublicMembershipPurchase,
  PurchaseKind,
} from './purchase.types.js';

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

  async listCatalog(eventId?: string) {
    const event = eventId
      ? await this.events.getById(eventId)
      : await this.events.getCurrent();

    const { items } = await this.memberships.list({
      page: 1,
      perPage: 200,
      eventId: event.id,
    });

    const sorted = [...items].sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.price - b.price ||
        a.name.localeCompare(b.name),
    );
    return {
      event: {
        id: event.id,
        name: event.name,
        status: event.status,
        startDate: event.startDate,
        endDate: event.endDate,
      },
      memberships: sorted.map(toPublicMembership),
    };
  }

  async checkEligibility(
    email: string,
    membershipId: string,
  ): Promise<CheckoutEligibility> {
    const membership = await this.requireMembership(membershipId);
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.users.findByEmail(normalizedEmail);

    if (!existing || existing.role !== 'member' || !existing.membershipId) {
      return {
        allowed: true,
        reason: null,
        kind: 'purchase',
        currentMembershipId: null,
        currentMembershipName: null,
        currentMembershipPrice: null,
        targetMembershipId: membership.id,
        targetMembershipName: membership.name,
        targetMembershipPrice: membership.price,
        eventId: membership.eventId,
      };
    }

    if (existing.membershipId === membership.id) {
      return {
        allowed: false,
        reason: 'You already have this membership for the current event',
        kind: null,
        currentMembershipId: existing.membershipId,
        currentMembershipName: membership.name,
        currentMembershipPrice: membership.price,
        targetMembershipId: membership.id,
        targetMembershipName: membership.name,
        targetMembershipPrice: membership.price,
        eventId: membership.eventId,
      };
    }

    const current = await this.memberships.findById(existing.membershipId);
    if (current && current.eventId !== membership.eventId) {
      // Different event edition on record — treat as a fresh purchase for this membership's event.
      return {
        allowed: true,
        reason: null,
        kind: 'purchase',
        currentMembershipId: null,
        currentMembershipName: null,
        currentMembershipPrice: null,
        targetMembershipId: membership.id,
        targetMembershipName: membership.name,
        targetMembershipPrice: membership.price,
        eventId: membership.eventId,
      };
    }

    const currentPrice = current?.price ?? 0;
    const currentName = current?.name ?? 'Current membership';
    const currentRank = (current?.tierRank ?? 0) > 0 ? current!.tierRank : currentPrice;
    const targetRank = (membership.tierRank ?? 0) > 0 ? membership.tierRank : membership.price;

    if (targetRank <= currentRank) {
      return {
        allowed: false,
        reason:
          'You can only upgrade to a higher-level membership. Downgrades and same-tier purchases are not allowed for this event.',
        kind: null,
        currentMembershipId: existing.membershipId,
        currentMembershipName: currentName,
        currentMembershipPrice: currentPrice,
        targetMembershipId: membership.id,
        targetMembershipName: membership.name,
        targetMembershipPrice: membership.price,
        eventId: membership.eventId,
      };
    }

    return {
      allowed: true,
      reason: null,
      kind: 'upgrade',
      currentMembershipId: existing.membershipId,
      currentMembershipName: currentName,
      currentMembershipPrice: currentPrice,
      targetMembershipId: membership.id,
      targetMembershipName: membership.name,
      targetMembershipPrice: membership.price,
      eventId: membership.eventId,
    };
  }

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    const stripe = this.requireStripe();
    const email = input.email.trim().toLowerCase();
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const membership = await this.requireMembership(input.membershipId);
    const event = await this.events.requireEvent(membership.eventId);

    const eligibility = await this.checkEligibility(email, membership.id);
    if (!eligibility.allowed || !eligibility.kind) {
      throw new ConflictError(eligibility.reason ?? 'Purchase is not allowed');
    }

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
    const unitAmount = Math.round(membership.price * 100);
    if (unitAmount < 50) {
      throw new BadRequestError('Membership price is below the Stripe minimum charge ($0.50)');
    }

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
              name: `${membership.name} — ${event.name}`,
              description:
                membership.description?.trim() ||
                `${env.appName} membership for ${event.name}`,
            },
          },
        },
      ],
      metadata: {
        membershipId: membership.id,
        membershipName: membership.name,
        eventId: event.id,
        eventName: event.name,
        email,
        firstName,
        lastName,
        kind: eligibility.kind,
        previousMembershipId: eligibility.currentMembershipId ?? '',
        previousMembershipName: eligibility.currentMembershipName ?? '',
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
      price: membership.price,
      currency,
      eventId: event.id,
    };
  }

  async getSessionStatus(sessionId: string) {
    const stripe = this.requireStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const purchase = await this.purchases.findByStripeCheckoutSessionId(sessionId);

    return {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      status: session.status,
      fulfilled: Boolean(purchase),
      purchase: purchase ? toPublicMembershipPurchase(purchase) : null,
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
      await this.fulfillCheckoutSession(session);
      return;
    }

    if (event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.fulfillCheckoutSession(session);
      return;
    }

    logger.debug({ type: event.type }, 'Ignoring Stripe webhook event');
  }

  async listPurchasesForUser(userId: string): Promise<PublicMembershipPurchase[]> {
    const items = await this.purchases.listByUserId(userId);
    return items.map(toPublicMembershipPurchase);
  }

  async getAttendeePurchaseSummary(userId: string, eventId?: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User');

    const all = await this.purchases.listByUserId(userId);
    const scoped = eventId ? all.filter((p) => p.eventId === eventId) : all;
    const paid = scoped.filter((p) => p.paymentStatus === 'paid');

    const original = paid[0] ?? null;
    const latest = paid.length > 0 ? paid[paid.length - 1]! : null;
    const upgrades = paid.filter((p) => p.kind === 'upgrade');

    let currentMembershipName: string | null = null;
    if (user.membershipId) {
      const membership = await this.memberships.findById(user.membershipId);
      currentMembershipName = membership?.name ?? null;
    }

    return {
      currentMembershipId: user.membershipId,
      currentMembershipName,
      originalMembershipId: original?.membershipId ?? user.membershipId,
      originalMembershipName: original?.membershipName ?? currentMembershipName,
      purchases: paid.map(toPublicMembershipPurchase),
      upgrades: upgrades.map(toPublicMembershipPurchase),
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
    const event = await this.events.requireEvent(membership.eventId);

    // Re-validate at fulfill time (race / stale session).
    const eligibility = await this.checkEligibility(email, membership.id);
    if (!eligibility.allowed || !eligibility.kind) {
      logger.warn(
        { sessionId: session.id, email, reason: eligibility.reason },
        'Stripe payment received but purchase no longer eligible',
      );
      // Still record a failed/conflict purchase? Prefer throwing so Stripe retries and we alert.
      // But money was taken — better to fulfill if they paid for a valid upgrade path that became invalid
      // only due to concurrent purchase. Check if they already have this or higher:
      if (eligibility.currentMembershipId === membership.id) {
        // Already has this tier (maybe duplicate webhook race with another fulfill) — no-op after logging.
        return;
      }
      // If they somehow paid for a downgrade after buying higher elsewhere, keep higher and log.
      if (
        eligibility.currentMembershipPrice != null &&
        membership.price <= eligibility.currentMembershipPrice
      ) {
        logger.error(
          { sessionId: session.id, email, membershipId },
          'Paid checkout would downgrade membership — skipping membership change',
        );
        return;
      }
      throw new ConflictError(eligibility.reason ?? 'Purchase is not allowed');
    }

    const kind: PurchaseKind = eligibility.kind;
    const previousMembershipId = eligibility.currentMembershipId;
    const previousMembershipName = eligibility.currentMembershipName;

    const upsert = await this.userService.upsertFromPurchase({
      email,
      firstName,
      lastName,
      product: membership.name,
    });

    await this.userService.update(upsert.user.id, {
      membershipId: membership.id,
      title: membership.name,
    });

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;

    let purchase: MembershipPurchase;
    try {
      purchase = await this.purchases.create({
        eventId: event.id,
        userId: upsert.user.id,
        email,
        firstName,
        lastName,
        membershipId: membership.id,
        membershipName: membership.name,
        price: membership.price,
        currency: (session.currency ?? env.stripe.currency).toLowerCase(),
        kind,
        previousMembershipId,
        previousMembershipName,
        paymentStatus: 'paid',
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        stripeCustomerId: customerId,
        purchasedAt: new Date(),
      });
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

    if (upsert.created && upsert.inviteCode) {
      await this.mail.sendInviteCode({
        to: email,
        name: upsert.user.name,
        inviteCode: upsert.inviteCode,
        expiresAt: new Date(Date.now() + env.inviteCodeTtlDays * 24 * 60 * 60 * 1000),
      });
    }

    await this.mail.sendMembershipPurchaseConfirmation({
      to: email,
      name: upsert.user.name,
      eventName: event.name,
      membershipName: membership.name,
      previousMembershipName: kind === 'upgrade' ? previousMembershipName : null,
      kind,
      priceLabel: moneyLabel(membership.price, purchase.currency),
      purchasedAt: purchase.purchasedAt,
      stripePaymentIntentId: paymentIntentId,
    });

    logger.info(
      {
        sessionId: session.id,
        userId: upsert.user.id,
        membershipId: membership.id,
        kind,
      },
      'Membership purchase fulfilled from Stripe',
    );
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
