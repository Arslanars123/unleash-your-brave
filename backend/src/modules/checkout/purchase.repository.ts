import type {
  CreateMembershipPurchaseInput,
  MembershipPurchase,
} from '../../modules/checkout/purchase.types.js';

export interface MembershipPurchaseRepository {
  findById(id: string): Promise<MembershipPurchase | null>;
  findByStripeCheckoutSessionId(
    stripeCheckoutSessionId: string,
  ): Promise<MembershipPurchase | null>;
  listByUserId(userId: string): Promise<MembershipPurchase[]>;
  listByEmailAndEvent(email: string, eventId: string): Promise<MembershipPurchase[]>;
  create(data: CreateMembershipPurchaseInput): Promise<MembershipPurchase>;
  updatePaymentStatus(
    id: string,
    paymentStatus: MembershipPurchase['paymentStatus'],
    extras?: Partial<
      Pick<MembershipPurchase, 'stripePaymentIntentId' | 'stripeCustomerId'>
    >,
  ): Promise<MembershipPurchase | null>;
}
