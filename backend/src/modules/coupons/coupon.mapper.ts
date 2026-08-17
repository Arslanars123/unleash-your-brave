import type { Coupon, PublicCoupon } from './coupon.types.js';

export function toPublicCoupon(coupon: Coupon): PublicCoupon {
  return {
    id: coupon.id,
    code: coupon.code,
    name: coupon.name,
    description: coupon.description ?? '',
    active: Boolean(coupon.active),
    expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString() : null,
    maxRedemptions: coupon.maxRedemptions ?? 0,
    redemptionCount: coupon.redemptionCount ?? 0,
    membershipDiscounts: (coupon.membershipDiscounts ?? []).map((item) => ({
      membershipId: item.membershipId,
      percentOff: item.percentOff,
    })),
    createdAt: coupon.createdAt.toISOString(),
    updatedAt: coupon.updatedAt.toISOString(),
  };
}

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function generateCouponCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
