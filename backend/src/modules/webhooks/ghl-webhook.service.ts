import { BadRequestError, UnauthorizedError } from '../../core/errors/app-error.js';
import { env } from '../../config/env.js';
import { logger } from '../../core/logger.js';
import type { MailService } from '../mail/mail.service.js';
import type { RealtimeHub } from '../realtime/realtime.hub.js';
import type { UserService } from '../users/user.service.js';
import type { GhlPurchaseResult, GhlPurchaseWebhookPayload } from './ghl-webhook.types.js';

function parseAmount(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : null;
}

export class GhlWebhookService {
  constructor(
    private readonly users: UserService,
    private readonly realtime: RealtimeHub,
    private readonly mail: MailService,
  ) {}

  assertSecret(provided: string | undefined): void {
    if (!env.ghlWebhookSecret) return;
    if (!provided || provided !== env.ghlWebhookSecret) {
      throw new UnauthorizedError('Invalid webhook secret');
    }
  }

  async handlePurchase(raw: Record<string, unknown>): Promise<GhlPurchaseResult> {
    const payload = normalizePayload(raw);
    if (!payload.email) {
      throw new BadRequestError('email is required');
    }

    const { user, created, inviteCode } = await this.users.upsertFromPurchase({
      email: payload.email,
      name: payload.name,
      firstName: payload.firstName,
      lastName: payload.lastName,
      product: payload.product,
      contactId: payload.contactId,
    });

    let inviteEmailSent = false;
    if (inviteCode) {
      const expiresAt = new Date(Date.now() + env.inviteCodeTtlDays * 24 * 60 * 60 * 1000);
      try {
        const result = await this.mail.sendInviteCode({
          to: user.email,
          name: user.name,
          inviteCode,
          expiresAt,
        });
        inviteEmailSent = result.sent;
        if (!result.sent && env.nodeEnv !== 'production') {
          logger.info(
            { email: user.email, inviteCode },
            'Invite email skipped (SMTP off) — invite code logged for local testing only',
          );
        }
      } catch (error) {
        logger.error({ err: error, email: user.email }, 'Failed to send invite email');
      }
    }

    const amount = parseAmount(payload.amount);

    this.realtime.publish({
      type: 'attendee.upserted',
      payload: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        created,
        product: payload.product ?? null,
        amount,
        inviteEmailSent,
      },
    });

    logger.info(
      {
        email: user.email,
        userId: user.id,
        created,
        inviteEmailSent,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        product: payload.product ?? null,
        amount,
        contactId: payload.contactId ?? null,
      },
      'GHL purchase webhook processed',
    );

    return {
      received: true,
      created,
      contactId: payload.contactId ?? null,
      product: payload.product ?? null,
      amount,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
      },
    };
  }
}

function normalizePayload(raw: Record<string, unknown>): GhlPurchaseWebhookPayload {
  // Flatten common GHL wrappers (customData / data / contact / customer).
  const bags: Record<string, unknown>[] = [raw];
  for (const key of ['customData', 'custom_data', 'data', 'contact', 'customer', 'order', 'purchase']) {
    const value = raw[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      bags.push(value as Record<string, unknown>);
    }
  }

  const email =
    pickString(bags, [
      'email',
      'Email',
      'contact_email',
      'customerEmail',
      'Customer Email',
    ]) ?? '';

  const firstName = pickString(bags, [
    'firstName',
    'first_name',
    'First Name',
    'FirstName',
    'firstname',
    'buyer_first_name',
    'customerFirstName',
  ]);

  const lastName = pickString(bags, [
    'lastName',
    'last_name',
    'Last Name',
    'LastName',
    'lastname',
    'buyer_last_name',
    'customerLastName',
  ]);

  const fullName = pickString(bags, [
    'name',
    'Name',
    'fullName',
    'full_name',
    'Full Name',
    'contact_name',
    'customerName',
  ]);

  // If GHL only sent "name" like "Jane Doe", split once for first/last display.
  let derivedFirst = firstName;
  let derivedLast = lastName;
  if (!derivedFirst && !derivedLast && fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      derivedFirst = parts[0];
    } else if (parts.length > 1) {
      derivedFirst = parts[0];
      derivedLast = parts.slice(1).join(' ');
    }
  }

  const contactId = pickString(bags, [
    'contactId',
    'contact_id',
    'Contact Id',
    'Contact ID',
    'id',
  ]);

  const product = pickString(bags, [
    'product',
    'Product',
    'productName',
    'product_name',
    'Product Name',
    'offer_name',
  ]);

  const amount =
    bags.map((bag) => bag.amount ?? bag.Amount ?? bag.payment_amount).find((v) => v !== undefined);

  logger.info(
    {
      keys: Object.keys(raw),
      email: email || null,
      firstName: derivedFirst ?? null,
      lastName: derivedLast ?? null,
      fullName: fullName ?? null,
      product: product ?? null,
      contactId: contactId ?? null,
    },
    'GHL webhook payload normalized',
  );

  return {
    email,
    name: fullName,
    firstName: derivedFirst,
    lastName: derivedLast,
    contactId,
    product,
    amount: amount as string | number | undefined,
  };
}

function pickString(
  bags: Record<string, unknown>[],
  keys: string[],
): string | undefined {
  for (const bag of bags) {
    for (const key of keys) {
      const value = stringField(bag, key);
      if (value) return value;
    }
  }
  return undefined;
}

function stringField(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  // Ignore unresolved GHL merge tags like {{contact.first_name}}
  if (!trimmed || (trimmed.includes('{{') && trimmed.includes('}}'))) return undefined;
  return trimmed;
}
