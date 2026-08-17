import { logger } from '../../core/logger.js';
import type { MailService } from '../mail/mail.service.js';
import type { PushNotificationService } from '../chat/push.service.js';
import type { MembershipRepository } from './membership.repository.js';
import type { UserRepository } from '../users/user.repository.js';

/** First heads-up before expiry. */
const EARLY_REMINDER_DAYS = 14;
/** Second reminder when expiry is imminent. */
const FINAL_REMINDER_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Marks expired renewable memberships and notifies members about
 * upcoming expiry, expiry, and pending renewal payment.
 */
export class MembershipLifecycleService {
  constructor(
    private readonly users: UserRepository,
    private readonly memberships: MembershipRepository,
    private readonly mail: MailService,
    private readonly push?: PushNotificationService,
    _events?: unknown,
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

      if (!user.membershipId) continue;
      const membership = await this.memberships.findById(user.membershipId);
      if (!membership || membership.billingKind !== 'renewable') continue;

      await this.notifyMembershipExpired(user.id, membership.name, now);
    }
    return count;
  }

  async sendDueRenewalReminders(now: Date = new Date()): Promise<number> {
    const due = await this.users.listDueForRenewalReminder(now, EARLY_REMINDER_DAYS);
    let count = 0;
    for (const user of due) {
      if (!user.membershipExpiresAt || !user.membershipId) continue;
      const membership = await this.memberships.findById(user.membershipId);
      if (!membership || membership.billingKind !== 'renewable') continue;

      const expiresAt = user.membershipExpiresAt;
      const msLeft = expiresAt.getTime() - now.getTime();
      const inFinalWindow = msLeft <= FINAL_REMINDER_DAYS * DAY_MS;
      const finalWindowStart = expiresAt.getTime() - FINAL_REMINDER_DAYS * DAY_MS;
      const sentAt = user.renewalReminderSentAt?.getTime() ?? null;

      let urgency: 'upcoming' | 'final' | null = null;
      if (sentAt == null) {
        urgency = inFinalWindow ? 'final' : 'upcoming';
      } else if (inFinalWindow && sentAt < finalWindowStart) {
        urgency = 'final';
      }

      if (!urgency) continue;

      await this.mail.sendMembershipRenewalReminder({
        to: user.email,
        name: user.name,
        membershipName: membership.name,
        expiresAt,
        urgency,
      });

      if (this.push) {
        await this.push.notifyUsers({
          userIds: [user.id],
          title: urgency === 'final' ? 'Membership expires soon' : 'Membership renewal',
          body:
            urgency === 'final'
              ? `Your ${membership.name} membership expires in a few days. Renew now so payment isn’t pending when you need your QR.`
              : `Your ${membership.name} membership expires soon. Renew in the app to keep your check-in QR active.`,
          data: {
            type: urgency === 'final' ? 'membership_renewal_final' : 'membership_renewal',
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

  /** Expired + unpaid renewal: email + push. */
  async notifyMembershipExpired(
    userId: string,
    membershipName: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const user = await this.users.findById(userId);
    if (!user) return false;
    // Reuse stamp so we don't spam if QR fetch also triggers payment-pending notice.
    if (user.qrRenewalBlockedNoticeSentAt) return false;

    await this.mail.sendMembershipExpiredNotice({
      to: user.email,
      name: user.name,
      membershipName,
    });

    if (this.push) {
      await this.push.notifyUsers({
        userIds: [userId],
        title: 'Membership expired',
        body: `Your ${membershipName} membership has expired. Renew in the app — your check-in QR stays invalid until payment is completed.`,
        data: {
          type: 'membership_expired',
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

  /**
   * One-shot notice when QR is held because renewal payment is still pending
   * (e.g. user opens check-in QR after expiry).
   */
  async notifyQrBlockedPendingRenewal(
    userId: string,
    membershipName: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const user = await this.users.findById(userId);
    if (!user) return false;
    if (user.qrRenewalBlockedNoticeSentAt) return false;

    await this.mail.sendMembershipExpiredNotice({
      to: user.email,
      name: user.name,
      membershipName,
    });

    if (this.push) {
      await this.push.notifyUsers({
        userIds: [userId],
        title: 'Renewal payment pending',
        body: 'Your check-in QR will become valid once your membership renewal payment is completed.',
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
