import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import type { UserRole } from '../users/user.types.js';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export function signAccessToken(userId: string, role: UserRole): string {
  return jwt.sign({ sub: userId, role, type: 'access' } satisfies AccessTokenPayload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessTtl as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' } satisfies RefreshTokenPayload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTtl as jwt.SignOptions['expiresIn'],
  });
}

export function issueTokenPair(userId: string, role: UserRole): TokenPair {
  return {
    accessToken: signAccessToken(userId, role),
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
  return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;
  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return payload;
}
