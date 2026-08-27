export interface CouponMembershipDiscount {
  membershipId: string;
  /** 1–100 percentage off that membership’s price. */
  percentOff: number;
}

export interface Coupon {
  id: string;
  /** Edition this coupon applies to. */
  eventId: string;
  /** Unique uppercase code attendees enter at checkout. */
  code: string;
  name: string;
  description: string;
  active: boolean;
  expiresAt: Date | null;
  /** 0 = unlimited. */
  maxRedemptions: number;
  redemptionCount: number;
  /**
   * Per-membership discount percentages.
   * A coupon is only valid for memberships listed here.
   */
  membershipDiscounts: CouponMembershipDiscount[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicCoupon {
  id: string;
  eventId: string;
  code: string;
  name: string;
  description: string;
  active: boolean;
  expiresAt: string | null;
  maxRedemptions: number;
  redemptionCount: number;
  membershipDiscounts: CouponMembershipDiscount[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCouponInput {
  eventId: string;
  code?: string;
  name: string;
  description?: string;
  active?: boolean;
  expiresAt?: string | null;
  maxRedemptions?: number;
  membershipDiscounts: CouponMembershipDiscount[];
}

export interface UpdateCouponInput {
  eventId?: string;
  code?: string;
  name?: string;
  description?: string;
  active?: boolean;
  expiresAt?: string | null;
  maxRedemptions?: number;
  membershipDiscounts?: CouponMembershipDiscount[];
}

export interface ListCouponsQuery {
  page: number;
  perPage: number;
  search?: string;
  active?: boolean;
}

export interface CouponPreview {
  valid: boolean;
  reason: string | null;
  code: string;
  couponId: string | null;
  membershipId: string;
  originalPrice: number;
  percentOff: number;
  discountAmount: number;
  finalPrice: number;
}
