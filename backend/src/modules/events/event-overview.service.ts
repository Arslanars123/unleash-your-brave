import type { CheckInService } from '../checkins/checkin.service.js';
import type { MembershipPurchaseRepository } from '../checkout/purchase.repository.js';
import type { StoreOrderRepository } from '../store/store-order.repository.js';
import type { EventService } from './event.service.js';
import type { EventOverviewStats } from './event-overview.types.js';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export class EventOverviewService {
  constructor(
    private readonly events: EventService,
    private readonly purchases: MembershipPurchaseRepository,
    private readonly storeOrders: StoreOrderRepository,
    private readonly checkIns?: CheckInService,
  ) {}

  async getOverview(eventId: string): Promise<EventOverviewStats> {
    await this.events.requireEvent(eventId);

    const [memberships, store, checkins] = await Promise.all([
      this.purchases.summarizePaidForEvent(eventId),
      this.storeOrders.summarizePaidForEvent(eventId),
      this.checkIns
        ? this.checkIns.stats(eventId).catch(() => ({
            eventId,
            checkedInCount: 0,
            attendeeCount: 0,
          }))
        : Promise.resolve({ eventId, checkedInCount: 0, attendeeCount: 0 }),
    ]);

    const currency = memberships.currency || store.currency || 'usd';

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
      store: {
        orderCount: store.orderCount,
        unitsSold: store.unitsSold,
        uniqueBuyers: store.uniqueBuyers,
        revenue: store.revenue,
      },
      checkins: {
        checkedInCount: checkins.checkedInCount,
        attendeeCount: checkins.attendeeCount,
      },
      totals: {
        revenue: roundMoney(memberships.revenue + store.revenue),
        discountTotal: memberships.discountTotal,
      },
    };
  }
}
