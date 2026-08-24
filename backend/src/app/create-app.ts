import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage } from 'node:http';
import { env } from '../config/env.js';
import { logger } from '../core/logger.js';
import { asyncHandler } from '../core/http/async-handler.js';
import { sendSuccess } from '../core/http/response.js';
import { errorHandler, notFoundHandler } from '../middleware/error-handler.js';
import { apiRateLimiter } from '../middleware/rate-limit.js';
import { uploadsRoot } from '../modules/uploads/upload.paths.js';
import type { Container } from './container.js';

export function createApp(container: Container): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // Allow dashboard (and later the app) to load uploaded images cross-origin.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(
    compression({
      filter: (req, res) => {
        if (req.url?.startsWith('/api/v1/realtime') || req.url?.startsWith('/api/v1/chat/stream')) {
          return false;
        }
        return compression.filter(req, res);
      },
    }),
  );

  // Stripe webhooks require the raw body for signature verification.
  app.post(
    '/api/v1/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    asyncHandler(container.controllers.checkout.stripeWebhook),
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(uploadsRoot));
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req: IncomingMessage) =>
          req.url === '/health' ||
          Boolean(req.url?.startsWith('/api/v1/realtime')) ||
          Boolean(req.url?.startsWith('/api/v1/chat/stream')),
      },
    }),
  );
  app.use(apiRateLimiter);

  app.get('/health', (_req, res) => {
    sendSuccess(res, {
      status: 'ok',
      service: 'unleash-your-brave-api',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/v1/auth', container.routers.auth);
  app.use('/api/v1/users', container.routers.users);
  app.use('/api/v1/events', container.routers.events);
  app.use('/api/v1/speakers', container.routers.speakers);
  app.use('/api/v1/sessions', container.routers.sessions);
  app.use('/api/v1/sponsors', container.routers.sponsors);
  app.use('/api/v1/store', container.routers.store);
  app.use('/api/v1/memberships', container.routers.memberships);
  app.use('/api/v1/coupons', container.routers.coupons);
  app.use('/api/v1/access', container.routers.access);
  app.use('/api/v1/checkout', container.routers.checkout);
  app.use('/api/v1/announcements', container.routers.announcements);
  app.use('/api/v1/checkin-forms', container.routers.checkinForms);
  app.use('/api/v1/checkins', container.routers.checkins);
  app.use('/api/v1/posts', container.routers.posts);
  app.use('/api/v1/uploads', container.routers.uploads);
  app.use('/api/v1/webhooks', container.routers.webhooks);
  app.use('/api/v1/realtime', container.routers.realtime);
  app.use('/api/v1/chat', container.routers.chat);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
