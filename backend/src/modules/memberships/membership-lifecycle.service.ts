import { logger } from '../../core/logger.js';
import type { MailService } from '../mail/mail.service.js';
import type { PushNotificationService } from '../chat/push.service.js';
import type { MembershipRepository } from './membership.repository.js';
import type { UserRepository } from '../users/user.repository.js';

const DEFAULT_REMINDER_DAYS = 14;

/**
 * Marks expired renewable memberships and sends renewal reminders.
 */
export class MembershipLifecycleService {
  constructor(
    private readonly users: UserRepository,
    private readonly memberships: MembershipRepository,
    private readonly mail: MailService,
    private readonly push?: PushNotificationService,
    private readonly reminderDays = DEFAULT_REMINDER_DAYS,
  ) {}

  async processExpiryAndReminders(): Promise<{ expired: number; reminded: number }> {
    const now = new Date();
    const expired = await this.expireDueMemberships(now);
    const reminded = await this.sendDueRenewalReminders(now);
    return { expired, reminded };
  }

  async expireDueMemberships(now: Date = new Date()): Promise<number> {
    const due = await this.users.listDueForMembershipExpiry(now);
    let count = 0;
    for (const user of due) {
      await this.users.update(user.id, {
        membershipStatus: 'expired',
      });
      count += 1;
      logger.info(
        {
          userId: user.id,
          membershipId: user.membershipId,
          membershipExpiresAt: user.membershipExpiresAt?.toISOString(),
        },
        'Membership marked expired',
      );
    }
    return count;
  }

  async sendDueRenewalReminders(now: Date = new Date()): Promise<number> {
    const due = await this.users.listDueForRenewalReminder(now, this.reminderDays);
    let count = 0;
    for (const user of due) {
      if (!user.membershipExpiresAt || !user.membershipId) continue;
      const membership = await this.memberships.findById(user.membershipId);
      if (!membership || membership.billingKind !== 'renewable') continue;

      await this.mail.sendMembershipRenewalReminder({
        to: user.email,
        name: user.name,
        membershipName: membership.name,
        expiresAt: user.membershipExpiresAt,
      });

      if (this.push) {
        await this.push.notifyUsers({
          userIds: [user.id],
          title: 'Membership renewal',
          body: `Your ${membership.name} membership expires soon. Renew to keep your check-in QR active.`,
          data: {
            type: 'membership_renewal',
            membershipId: membership.id,
          },
        });
      }

      await this.users.update(user.id, {
        renewalReminderSentAt: now,
      });
      count += 1;
    }
    return count;
  }
}
