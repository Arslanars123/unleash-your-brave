export interface EventOverviewMembershipBreakdown {
  membershipId: string;
  membershipName: string;
  soldCount: number;
  revenue: number;
  discountTotal: number;
}

export interface EventOverviewStats {
  eventId: string;
  currency: string;
  memberships: {
    soldCount: number;
    uniqueBuyers: number;
    revenue: number;
    discountTotal: number;
    couponRedemptions: number;
    byMembership: EventOverviewMembershipBreakdown[];
    byKind: {
      purchase: number;
      upgrade: number;
      renew: number;
    };
  };
  store: {
    orderCount: number;
    unitsSold: number;
    uniqueBuyers: number;
    revenue: number;
  };
  checkins: {
    checkedInCount: number;
    attendeeCount: number;
  };
  totals: {
    revenue: number;
    discountTotal: number;
  };
}
