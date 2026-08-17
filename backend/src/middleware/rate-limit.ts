import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const skipInTests = () => env.isTest;

export const apiRateLimiter = rateLimit({
  windowMs: 60_000,
  // Chat room polling + catalog refreshes can exceed a tight budget,
  // especially when several clients share a NAT / proxy IP.
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) =>
    skipInTests() ||
    req.path === '/health' ||
    req.path.startsWith('/api/v1/chat/stream') ||
    req.path.startsWith('/api/v1/realtime'),
});

/** Tighter budget for credential endpoints to blunt brute-force attempts. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: skipInTests,
});
