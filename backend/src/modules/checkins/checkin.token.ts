import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { BadRequestError } from '../../core/errors/app-error.js';
import type { CheckInQrTokenRepository } from './checkin-qr-token.repository.js';

const PREFIX_V1 = 'uyb1';
const PREFIX_V2 = 'uyb2';

function signingKey(): string {
  return env.jwt.accessSecret;
}

function sign(payload: string): string {
  return createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

function verifyV1(token: string): { eventId: string; userId: string } {
  const parts = token.trim().split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX_V1) {
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

/**
 * Builds a compact QR token (v2) bound to one event + user.
 * Legacy v1 tokens remain valid for older app builds.
 */
export async function issueCheckInToken(
  eventId: string,
  userId: string,
  tokens?: CheckInQrTokenRepository,
): Promise<string> {
  if (tokens) {
    const code = await tokens.issue(eventId, userId);
    return `${PREFIX_V2}.${code}`;
  }
  const body = `${eventId}.${userId}`;
  return `${PREFIX_V1}.${body}.${sign(body)}`;
}

export async function verifyCheckInToken(
  token: string,
  tokens?: CheckInQrTokenRepository,
): Promise<{ eventId: string; userId: string }> {
  const trimmed = token.trim();
  if (trimmed.startsWith(`${PREFIX_V2}.`)) {
    const code = trimmed.slice(PREFIX_V2.length + 1);
    if (!code || !tokens) {
      throw new BadRequestError('Invalid check-in QR code');
    }
    const resolved = await tokens.resolve(code);
    if (!resolved) {
      throw new BadRequestError('Invalid or expired check-in QR code');
    }
    return resolved;
  }
  return verifyV1(trimmed);
}
