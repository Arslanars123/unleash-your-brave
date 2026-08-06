import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { BadRequestError } from '../../core/errors/app-error.js';

const PREFIX = 'uyb1';

function signingKey(): string {
  return env.jwt.accessSecret;
}

function sign(payload: string): string {
  return createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

/**
 * Builds an opaque QR token bound to one event + user.
 * A new event id produces a different QR; old tokens fail verification for other events.
 */
export function issueCheckInToken(eventId: string, userId: string): string {
  const body = `${eventId}.${userId}`;
  return `${PREFIX}.${body}.${sign(body)}`;
}

export function verifyCheckInToken(token: string): { eventId: string; userId: string } {
  const parts = token.trim().split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new BadRequestError('Invalid check-in QR code');
  }
  const [, eventId, userId, signature] = parts;
  if (!eventId || !userId || !signature) {
    throw new BadRequestError('Invalid check-in QR code');
  }
  const body = `${eventId}.${userId}`;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new BadRequestError('Invalid or tampered check-in QR code');
  }
  return { eventId, userId };
}
