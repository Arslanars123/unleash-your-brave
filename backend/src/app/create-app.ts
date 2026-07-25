import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage } from 'node:http';
import { env } from '../config/env.js';
import { logger } from '../core/logger.js';
import { sendSuccess } from '../core/http/response.js';
import { errorHandler, notFoundHandler } from '../middleware/error-handler.js';
import { apiRateLimiter } from '../middleware/rate-limit.js';
import type { Container } from './container.js';

export function createApp(container: Container): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req: IncomingMessage) => req.url === '/health',
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
