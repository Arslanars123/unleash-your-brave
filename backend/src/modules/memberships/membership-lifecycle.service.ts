import { logger } from '../../core/logger.js';
import type { MailService } from '../mail/mail.service.js';
import type { PushNotificationService } from '../chat/push.service.js';
import { isBlockQrWhenRenewalUnpaid } from '../access/access.service.js';
import type { EventService } from '../events/event.service.js';
import type { MembershipRepository } from './membership.repository.js';
import type { UserRepository } from '../users/user.repository.js';

const DEFAULT_REMINDER_DAYS = 14;

const QR_BLOCKED_PUSH = {
  title: 'Check-in QR on hold',
  body: 'Your check-in QR will become valid for the next event once your membership renewal payment is completed.',
};

/**
 * Marks expired renewable memberships and sends renewal reminders.
 */
export class MembershipLifecycleService {
  constructor(
    private readonly users: UserRepository,
    private readonly memberships: MembershipRepository,
    private readonly mail: MailService,
    private readonly push?: PushNotificationService,
    private readonly events?: EventService,
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
    const latest = this.events ? await this.events.getLatest() : null;
    const shouldNotifyQrBlock = latest ? isBlockQrWhenRenewalUnpaid(latest) : true;

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

      if (shouldNotifyQrBlock && user.membershipId) {
        const membership = await this.memberships.findById(user.membershipId);
        if (membership?.billingKind === 'renewable') {
          await this.notifyQrBlockedPendingRenewal(user.id, membership.name, now);
        }
      }
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

  /** One-shot push when QR is held until renewal payment (expiry or QR fetch). */
  async notifyQrBlockedPendingRenewal(
    userId: string,
    membershipName: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const user = await this.users.findById(userId);
    if (!user) return false;
    if (user.qrRenewalBlockedNoticeSentAt) return false;

    if (this.push) {
      await this.push.notifyUsers({
        userIds: [userId],
        title: QR_BLOCKED_PUSH.title,
        body: QR_BLOCKED_PUSH.body,
        data: {
          type: 'qr_renewal_blocked',
          membershipId: user.membershipId ?? '',
          membershipName,
        },
      });
    }

    await this.users.update(userId, {
      qrRenewalBlockedNoticeSentAt: now,
    });
    return true;
  }
}
