import type { UserService } from '../modules/users/user.service.js';
import { logger } from '../core/logger.js';

/**
 * Seeds a known admin so the dashboard is usable out of the box. Replace this
 * once a real database and migrations are wired up.
 */
export async function seedDemoData(userService: UserService): Promise<void> {
  try {
    await userService.create({
      email: 'admin@unleashyourbrave.com',
      name: 'Platform Admin',
      password: 'Admin123!',
      role: 'admin',
    });

    await userService.create({
      email: 'member@unleashyourbrave.com',
      name: 'Demo Member',
      password: 'Member123!',
      role: 'member',
    });

    logger.info(
      {
        admin: 'admin@unleashyourbrave.com / Admin123!',
        member: 'member@unleashyourbrave.com / Member123!',
      },
      'Seeded demo accounts',
    );
  } catch (error) {
    // Re-seed is fine across hot reloads; ignore conflicts.
    logger.debug({ err: error }, 'Seed skipped (accounts may already exist)');
  }
}
