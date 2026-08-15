import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import type { UserRole } from '../users/user.types.js';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  speakerId: string | null;
  sponsorId: string | null;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
}

export interface ResetTokenPayload {
  sub: string;
  type: 'reset';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface TokenProfileLinks {
  speakerId?: string | null;
  sponsorId?: string | null;
}

export function signAccessToken(
  userId: string,
  role: UserRole,
  links: TokenProfileLinks = {},
): string {
  return jwt.sign(
    {
      sub: userId,
      role,
      speakerId: links.speakerId ?? null,
      sponsorId: links.sponsorId ?? null,
      type: 'access',
    } satisfies AccessTokenPayload,
    env.jwt.accessSecret,
    {
      expiresIn: env.jwt.accessTtl as jwt.SignOptions['expiresIn'],
    },
  );
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' } satisfies RefreshTokenPayload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTtl as jwt.SignOptions['expiresIn'],
  });
}

export function issueTokenPair(
  userId: string,
  role: UserRole,
  links: TokenProfileLinks = {},
): TokenPair {
  return {
    accessToken: signAccessToken(userId, role, links),
    refreshToken: signRefreshToken(userId),
    tokenType: 'Bearer',
    expiresIn: env.jwt.accessTtl,
  };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return {
    ...payload,
    speakerId: payload.speakerId ?? null,
    sponsorId: payload.sponsorId ?? null,
  };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;
  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return payload;
}

export function signResetToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'reset' } satisfies ResetTokenPayload, env.jwt.accessSecret, {
    expiresIn: env.jwt.resetTtl as jwt.SignOptions['expiresIn'],
  });
}

export function verifyResetToken(token: string): ResetTokenPayload {
  const payload = jwt.verify(token, env.jwt.accessSecret) as ResetTokenPayload;
  if (payload.type !== 'reset') {
    throw new Error('Invalid token type');
  }
  return payload;
}
