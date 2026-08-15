import { createContainer } from './app/container.js';
import { createApp } from './app/create-app.js';
import { env } from './config/env.js';
import { logger } from './core/logger.js';
import { closeMongo } from './db/mongo.js';
import { startAnnouncementScheduler } from './modules/announcements/announcement.scheduler.js';
import { attachChatWebSocket } from './modules/chat/chat.ws.js';

async function bootstrap(): Promise<void> {
  const container = await createContainer();
  const app = createApp(container);

  const stopAnnouncementScheduler = startAnnouncementScheduler(
    container.services.announcementService,
  );

  const server = app.listen(env.port, () => {
    logger.info({ port: env.port, env: env.nodeEnv }, 'API listening');
  });

  const chatWss = attachChatWebSocket(server, {
    hub: container.services.chatHub,
    chatService: container.services.chatService,
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    stopAnnouncementScheduler();
    chatWss.close();
    server.close(() => {
      void closeMongo().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
