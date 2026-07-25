import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const skipInTests = () => env.isTest;

export const apiRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTests,
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
