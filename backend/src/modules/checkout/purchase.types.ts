export const PURCHASE_KINDS = ['purchase', 'upgrade', 'renew'] as const;
export type PurchaseKind = (typeof PURCHASE_KINDS)[number];

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Immutable record of every membership purchase, upgrade, or renewal. */
export interface MembershipPurchase {
  id: string;
  eventId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  membershipId: string;
  membershipName: string;
  /** Amount charged in major currency units (e.g. dollars). */
  price: number;
  currency: string;
  couponCode: string | null;
  couponId: string | null;
  originalPrice: number | null;
  discountAmount: number | null;
  kind: PurchaseKind;
  previousMembershipId: string | null;
  previousMembershipName: string | null;
  paymentStatus: PaymentStatus;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  /** Start of the membership period this payment covers. */
  periodStart: Date | null;
  /** End of the membership period this payment covers (`null` = no expiry). */
  periodEnd: Date | null;
  purchasedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicMembershipPurchase {
  id: string;
  eventId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  membershipId: string;
  membershipName: string;
  price: number;
  currency: string;
  couponCode: string | null;
  couponId: string | null;
  originalPrice: number | null;
  discountAmount: number | null;
  kind: PurchaseKind;
  previousMembershipId: string | null;
  previousMembershipName: string | null;
  paymentStatus: PaymentStatus;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  purchasedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMembershipPurchaseInput {
  eventId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  membershipId: string;
  membershipName: string;
  price: number;
  currency: string;
  couponCode: string | null;
  couponId: string | null;
  originalPrice: number | null;
  discountAmount: number | null;
  kind: PurchaseKind;
  previousMembershipId: string | null;
  previousMembershipName: string | null;
  paymentStatus: PaymentStatus;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  purchasedAt: Date;
}

export type NameUpdateChoice = 'update' | 'keep';

/** Present when the checkout email already belongs to an account (any role). */
export interface CheckoutExistingAccount {
  exists: true;
  role: 'admin' | 'member' | 'speaker' | 'sponsor';
  existingName: string;
  proposedName: string | null;
  nameConflict: boolean;
  /** Password already set — no new invite after purchase. */
  hasPassword: boolean;
  /** Invite still required (never finished first-time setup). */
  needsInvite: boolean;
}

export interface CheckoutEligibility {
  allowed: boolean;
  reason: string | null;
  kind: PurchaseKind | null;
  currentMembershipId: string | null;
  currentMembershipName: string | null;
  currentMembershipPrice: number | null;
  targetMembershipId: string;
  targetMembershipName: string;
  targetMembershipPrice: number;
  eventId: string;
  existingAccount: CheckoutExistingAccount | null;
}

export interface CreateCheckoutSessionInput {
  membershipId: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Required when the same pass is linked to multiple editions. */
  eventId?: string;
  successUrl?: string;
  cancelUrl?: string;
  couponCode?: string;
  /** Price the attendee was shown. Reject if the live membership price differs. */
  expectedPrice?: number;
  /** `updatedAt` the attendee last loaded. Reject if the membership changed since. */
  expectedUpdatedAt?: string;
  /**
   * Required when eligibility reports a name conflict.
   * `update` = change name everywhere; `keep` = keep the existing account name.
   */
  nameUpdateChoice?: NameUpdateChoice;
}

export interface CreateCheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  kind: PurchaseKind;
  membershipId: string;
  membershipName: string;
  price: number;
  originalPrice: number;
  discountAmount: number;
  couponCode: string | null;
  currency: string;
  eventId: string;
}

export interface AttendeePurchaseSummary {
  currentMembershipId: string | null;
  currentMembershipName: string | null;
  currentMembershipStatus: 'active' | 'expired' | null;
  currentMembershipExpiresAt: string | null;
  currentBillingKind: 'one_time' | 'renewable' | null;
  originalMembershipId: string | null;
  originalMembershipName: string | null;
  purchases: PublicMembershipPurchase[];
  upgrades: PublicMembershipPurchase[];
  renewals: PublicMembershipPurchase[];
  latestPurchase: PublicMembershipPurchase | null;
}

export interface AttendeeEventRecord {
  eventId: string;
  eventName: string;
  eventStartDate: string;
  eventEndDate: string;
  eventStatus: string;
  summary: AttendeePurchaseSummary;
}
