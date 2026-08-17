import type {
  MembershipPurchase,
  PublicMembershipPurchase,
} from './purchase.types.js';

export function toPublicMembershipPurchase(
  purchase: MembershipPurchase,
): PublicMembershipPurchase {
  return {
    id: purchase.id,
    eventId: purchase.eventId,
    userId: purchase.userId,
    email: purchase.email,
    firstName: purchase.firstName,
    lastName: purchase.lastName,
    membershipId: purchase.membershipId,
    membershipName: purchase.membershipName,
    price: purchase.price,
    currency: purchase.currency,
    couponCode: purchase.couponCode ?? null,
    couponId: purchase.couponId ?? null,
    originalPrice: purchase.originalPrice ?? null,
    discountAmount: purchase.discountAmount ?? null,
    kind: purchase.kind,
    previousMembershipId: purchase.previousMembershipId,
    previousMembershipName: purchase.previousMembershipName,
    paymentStatus: purchase.paymentStatus,
    stripeCheckoutSessionId: purchase.stripeCheckoutSessionId,
    stripePaymentIntentId: purchase.stripePaymentIntentId,
    stripeCustomerId: purchase.stripeCustomerId,
    purchasedAt: purchase.purchasedAt.toISOString(),
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
  };
}
