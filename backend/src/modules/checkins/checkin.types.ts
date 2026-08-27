import type {
  PublicCheckInForm,
  PublicCheckInFormSubmission,
} from '../checkin-forms/checkin-form.types.js';
import type { PublicMembershipPurchase } from '../checkout/purchase.types.js';
import type { PublicUser } from '../users/user.types.js';

export interface CheckIn {
  id: string;
  eventId: string;
  userId: string;
  checkedInAt: Date;
  /** Admin user id who scanned, or null when self-service (unused for now). */
  checkedInBy: string | null;
  /** Membership snapshot at the moment of check-in (survives later upgrades). */
  membershipIdAtCheckIn: string | null;
  membershipNameAtCheckIn: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicCheckIn {
  id: string;
  eventId: string;
  userId: string;
  checkedInAt: string;
  checkedInBy: string | null;
  membershipIdAtCheckIn: string | null;
  membershipNameAtCheckIn: string | null;
  createdAt: string;
  updatedAt: string;
  user?: PublicUser | null;
}

export interface MyCheckInQr {
  eventId: string;
  eventName: string;
  eventStatus: 'upcoming' | 'live' | 'ended' | 'paused';
  userId: string;
  /** Opaque signed token to encode in the QR. Valid only for this eventId. */
  token: string;
  checkedIn: boolean;
  checkedInAt: string | null;
}

export interface CheckInScanMembershipSummary {
  currentMembershipId: string | null;
  currentMembershipName: string | null;
  originalMembershipId: string | null;
  originalMembershipName: string | null;
  membershipIdAtCheckIn: string | null;
  membershipNameAtCheckIn: string | null;
  purchases: PublicMembershipPurchase[];
  upgrades: PublicMembershipPurchase[];
  latestPurchase: PublicMembershipPurchase | null;
  /** Staff check-in visibility */
  isRecurring?: boolean;
  paymentPeriodActive?: boolean;
  qrEntitled?: boolean;
  qrDeniedReason?: string | null;
  qrStatusLabel?: string;
  eligibleForEventContent?: boolean;
  eligibleForEventQr?: boolean;
  blockQrWhenRenewalUnpaid?: boolean;
  carriedFromPrevious?: boolean;
  currentMembershipStatus?: 'active' | 'expired' | null;
  currentMembershipExpiresAt?: string | null;
  currentBillingKind?: 'one_time' | 'renewable' | null;
  renewals?: PublicMembershipPurchase[];
}

export interface CheckInScanResult {
  /** True when an active form must be completed before check-in is created. */
  requiresForm: boolean;
  form: PublicCheckInForm | null;
  /** Saved waiver answers after (or during) check-in; null if none. */
  formSubmission: PublicCheckInFormSubmission | null;
  /** Null when requiresForm is true (check-in not created yet). */
  checkIn: PublicCheckIn | null;
  alreadyCheckedIn: boolean;
  user: PublicUser;
  membership: CheckInScanMembershipSummary;
}

export interface ListCheckInsQuery {
  eventId: string;
  page: number;
  perPage: number;
  search?: string;
  /** checked_in | not_checked_in | all */
  status?: 'checked_in' | 'not_checked_in' | 'all';
}

export interface CheckInStats {
  eventId: string;
  checkedInCount: number;
  attendeeCount: number;
}
