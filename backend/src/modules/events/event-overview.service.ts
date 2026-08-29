import type { CheckInService } from '../checkins/checkin.service.js';
import type { MembershipPurchaseRepository } from '../checkout/purchase.repository.js';
import type { EventService } from './event.service.js';
import type { EventOverviewStats } from './event-overview.types.js';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const EMPTY_STORE_STATS = {
  orderCount: 0,
  unitsSold: 0,
  uniqueBuyers: 0,
  revenue: 0,
};

export class EventOverviewService {
  constructor(
    private readonly events: EventService,
    private readonly purchases: MembershipPurchaseRepository,
    private readonly checkIns?: CheckInService,
  ) {}

  async getOverview(eventId: string): Promise<EventOverviewStats> {
    await this.events.requireEvent(eventId);

    const [memberships, checkins] = await Promise.all([
      this.purchases.summarizePaidForEvent(eventId),
      this.checkIns
        ? this.checkIns.stats(eventId).catch(() => ({
            eventId,
            checkedInCount: 0,
            attendeeCount: 0,
          }))
        : Promise.resolve({ eventId, checkedInCount: 0, attendeeCount: 0 }),
    ]);

    const currency = memberships.currency || 'usd';

    return {
      eventId,
      currency,
      memberships: {
        soldCount: memberships.soldCount,
        uniqueBuyers: memberships.uniqueBuyers,
        revenue: memberships.revenue,
        discountTotal: memberships.discountTotal,
        couponRedemptions: memberships.couponRedemptions,
        byMembership: memberships.byMembership,
        byKind: memberships.byKind,
      },
      store: EMPTY_STORE_STATS,
      checkins: {
        checkedInCount: checkins.checkedInCount,
        attendeeCount: checkins.attendeeCount,
      },
      totals: {
        revenue: roundMoney(memberships.revenue),
        discountTotal: memberships.discountTotal,
      },
    };
  }
}
