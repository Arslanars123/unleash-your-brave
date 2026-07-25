import { createContainer } from './app/container.js';
import { createApp } from './app/create-app.js';
import { env } from './config/env.js';
import { logger } from './core/logger.js';

async function bootstrap(): Promise<void> {
  const container = await createContainer();
  const app = createApp(container);

  const server = app.listen(env.port, () => {
    logger.info({ port: env.port, env: env.nodeEnv }, 'API listening');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
