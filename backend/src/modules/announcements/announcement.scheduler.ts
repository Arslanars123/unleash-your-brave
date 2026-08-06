import { logger } from '../../core/logger.js';
import type { AnnouncementService } from './announcement.service.js';

const TICK_MS = 60_000;

/**
 * Periodically publishes due scheduled announcements and evaluates
 * automatic event-countdown notifications.
 */
export function startAnnouncementScheduler(service: AnnouncementService): () => void {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const published = await service.processDueScheduled();
      const countdown = await service.processCountdownAutomation();
      if (published > 0 || countdown > 0) {
        logger.info({ published, countdown }, 'Announcement scheduler tick');
      }
    } catch (error) {
      logger.error({ err: error }, 'Announcement scheduler tick failed');
    } finally {
      running = false;
    }
  };

  void tick();
  const handle = setInterval(() => {
    void tick();
  }, TICK_MS);

  logger.info({ everyMs: TICK_MS }, 'Announcement scheduler started');
  return () => clearInterval(handle);
}
