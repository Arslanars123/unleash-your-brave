import type { Membership } from './membership.types.js';
import type { MembershipStatus, User } from '../users/user.types.js';

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Computes the paid period for a membership purchase/renewal.
 * Renewable memberships extend from the later of now or the current expiry.
 */
export function computeMembershipPeriod(input: {
  membership: Pick<Membership, 'billingKind' | 'durationDays'>;
  now?: Date;
  currentExpiresAt?: Date | null;
}): {
  periodStart: Date;
  periodEnd: Date | null;
  membershipStatus: MembershipStatus;
} {
  const now = input.now ?? new Date();
  if (input.membership.billingKind !== 'renewable') {
    return {
      periodStart: now,
      periodEnd: null,
      membershipStatus: 'active',
    };
  }

  const days = Math.max(1, input.membership.durationDays || 365);
  const base =
    input.currentExpiresAt && input.currentExpiresAt.getTime() > now.getTime()
      ? input.currentExpiresAt
      : now;

  return {
    periodStart: now,
    periodEnd: addDays(base, days),
    membershipStatus: 'active',
  };
}

/** Whether the attendee’s current membership payment period is still valid for QR. */
export function isMembershipPaymentActive(
  user: Pick<User, 'membershipId' | 'membershipStatus' | 'membershipExpiresAt'>,
  now: Date = new Date(),
): boolean {
  if (!user.membershipId) return false;
  if (user.membershipStatus === 'expired') return false;
  if (user.membershipExpiresAt && user.membershipExpiresAt.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}
