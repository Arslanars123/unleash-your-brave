import type {
  CreateMembershipPurchaseInput,
  MembershipPurchase,
} from '../../modules/checkout/purchase.types.js';

export interface MembershipPurchaseEventSummary {
  soldCount: number;
  uniqueBuyers: number;
  revenue: number;
  discountTotal: number;
  couponRedemptions: number;
  currency: string;
  byMembership: Array<{
    membershipId: string;
    membershipName: string;
    soldCount: number;
    revenue: number;
    discountTotal: number;
  }>;
  byKind: {
    purchase: number;
    upgrade: number;
    renew: number;
  };
}

export interface MembershipPurchaseRepository {
  findById(id: string): Promise<MembershipPurchase | null>;
  findByStripeCheckoutSessionId(
    stripeCheckoutSessionId: string,
  ): Promise<MembershipPurchase | null>;
  listByUserId(userId: string): Promise<MembershipPurchase[]>;
  listByEmailAndEvent(email: string, eventId: string): Promise<MembershipPurchase[]>;
  /** Distinct user ids with a paid membership purchase for the event. */
  listPaidUserIdsByEvent(eventId: string): Promise<string[]>;
  summarizePaidForEvent(eventId: string): Promise<MembershipPurchaseEventSummary>;
  create(data: CreateMembershipPurchaseInput): Promise<MembershipPurchase>;
  updatePaymentStatus(
    id: string,
    paymentStatus: MembershipPurchase['paymentStatus'],
    extras?: Partial<
      Pick<MembershipPurchase, 'stripePaymentIntentId' | 'stripeCustomerId'>
    >,
  ): Promise<MembershipPurchase | null>;
}
