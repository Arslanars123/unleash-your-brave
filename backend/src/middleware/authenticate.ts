import type { RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../core/errors/app-error.js';
import { verifyAccessToken } from '../modules/auth/token.service.js';
import type { UserRole } from '../modules/users/user.types.js';

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing bearer token'));
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
    req.auth = {
      userId: payload.sub,
      role: payload.role,
      speakerId: payload.speakerId ?? null,
      sponsorId: payload.sponsorId ?? null,
    };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
};

/** Attach auth when a valid token is present; continue as anonymous otherwise. */
export const optionalAuthenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
    req.auth = {
      userId: payload.sub,
      role: payload.role,
      speakerId: payload.speakerId ?? null,
      sponsorId: payload.sponsorId ?? null,
    };
  } catch {
    // Ignore invalid tokens for public reads.
  }
  next();
};

/** Route guard. Must run after `authenticate`.
 * Portal capabilities also match via linked `speakerId` / `sponsorId` so one
 * account can be speaker and sponsor (and attendee) at the same time.
 */
export function authorize(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }
    if (roles.includes(req.auth.role)) {
      next();
      return;
    }
    if (roles.includes('speaker') && req.auth.speakerId) {
      next();
      return;
    }
    if (roles.includes('sponsor') && req.auth.sponsorId) {
      next();
      return;
    }
    next(new ForbiddenError());
  };
}
