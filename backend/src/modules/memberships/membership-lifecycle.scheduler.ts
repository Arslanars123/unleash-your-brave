import { logger } from '../../core/logger.js';
import type { MembershipLifecycleService } from './membership-lifecycle.service.js';

const TICK_MS = 60 * 60 * 1000; // hourly

export function startMembershipLifecycleScheduler(
  service: MembershipLifecycleService,
): () => void {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await service.processExpiryAndReminders();
      if (result.expired > 0 || result.reminded > 0) {
        logger.info(result, 'Membership lifecycle scheduler tick');
      }
    } catch (error) {
      logger.error({ err: error }, 'Membership lifecycle scheduler tick failed');
    } finally {
      running = false;
    }
  };

  void tick();
  const handle = setInterval(() => {
    void tick();
  }, TICK_MS);

  logger.info({ everyMs: TICK_MS }, 'Membership lifecycle scheduler started');
  return () => clearInterval(handle);
}
