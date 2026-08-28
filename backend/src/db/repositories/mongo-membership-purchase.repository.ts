import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../../db/map.js';
import { getDb } from '../../db/mongo.js';
import type { MembershipPurchaseRepository } from '../../modules/checkout/purchase.repository.js';
import type {
  CreateMembershipPurchaseInput,
  MembershipPurchase,
} from '../../modules/checkout/purchase.types.js';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export class MongoMembershipPurchaseRepository implements MembershipPurchaseRepository {
  private get collection(): Collection<MongoDoc<MembershipPurchase>> {
    return getDb().collection<MongoDoc<MembershipPurchase>>('membership_purchases');
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex(
      { stripeCheckoutSessionId: 1 },
      { unique: true, name: 'stripe_checkout_session_unique' },
    );
    await this.collection.createIndex({ userId: 1, purchasedAt: 1 });
    await this.collection.createIndex({ email: 1, eventId: 1, purchasedAt: 1 });
    await this.collection.createIndex({ eventId: 1, purchasedAt: -1 });
  }

  async findById(id: string): Promise<MembershipPurchase | null> {
    return fromDoc<MembershipPurchase>(await this.collection.findOne({ _id: id }));
  }

  async findByStripeCheckoutSessionId(
    stripeCheckoutSessionId: string,
  ): Promise<MembershipPurchase | null> {
    return fromDoc<MembershipPurchase>(
      await this.collection.findOne({ stripeCheckoutSessionId }),
    );
  }

  async listByUserId(userId: string): Promise<MembershipPurchase[]> {
    const docs = await this.collection
      .find({ userId })
      .sort({ purchasedAt: 1 })
      .toArray();
    return fromDocs<MembershipPurchase>(docs);
  }

  async listByEmailAndEvent(email: string, eventId: string): Promise<MembershipPurchase[]> {
    const docs = await this.collection
      .find({ email: email.trim().toLowerCase(), eventId })
      .sort({ purchasedAt: 1 })
      .toArray();
    return fromDocs<MembershipPurchase>(docs);
  }

  async listPaidUserIdsByEvent(eventId: string): Promise<string[]> {
    const docs = await this.collection
      .find({ eventId, paymentStatus: 'paid', userId: { $type: 'string' } })
      .project({ userId: 1 })
      .toArray();
    return [...new Set(docs.map((doc) => String(doc.userId)).filter(Boolean))];
  }

  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.collection.deleteMany({ userId });
    return result.deletedCount;
  }

  async deleteByUserAndEvent(userId: string, eventId: string): Promise<number> {
    const result = await this.collection.deleteMany({ userId, eventId });
    return result.deletedCount;
  }

  async listDistinctPaidEventIdsByUser(userId: string): Promise<string[]> {
    const docs = await this.collection
      .find({ userId, paymentStatus: 'paid' })
      .project({ eventId: 1 })
      .toArray();
    return [...new Set(docs.map((doc) => String(doc.eventId)).filter(Boolean))];
  }

  async summarizePaidForEvent(eventId: string) {
    const empty = {
      soldCount: 0,
      uniqueBuyers: 0,
      revenue: 0,
      discountTotal: 0,
      couponRedemptions: 0,
      currency: 'usd',
      byMembership: [] as Array<{
        membershipId: string;
        membershipName: string;
        soldCount: number;
        revenue: number;
        discountTotal: number;
      }>,
      byKind: { purchase: 0, upgrade: 0, renew: 0 },
    };

    const [row] = await this.collection
      .aggregate<{
        totals?: {
          soldCount: number;
          uniqueBuyers: string[];
          revenue: number;
          discountTotal: number;
          couponRedemptions: number;
          currency: string | null;
        };
        byMembership: Array<{
          membershipId: string;
          membershipName: string;
          soldCount: number;
          revenue: number;
          discountTotal: number;
        }>;
        byKind: Array<{ kind: string; count: number }>;
      }>([
        { $match: { eventId, paymentStatus: 'paid' } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  soldCount: { $sum: 1 },
                  uniqueBuyers: { $addToSet: '$userId' },
                  revenue: { $sum: '$price' },
                  discountTotal: { $sum: { $ifNull: ['$discountAmount', 0] } },
                  couponRedemptions: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            { $ne: [{ $ifNull: ['$couponId', null] }, null] },
                            { $ne: ['$couponId', ''] },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                  currency: { $first: '$currency' },
                },
              },
            ],
            byMembership: [
              {
                $group: {
                  _id: {
                    membershipId: '$membershipId',
                    membershipName: '$membershipName',
                  },
                  soldCount: { $sum: 1 },
                  revenue: { $sum: '$price' },
                  discountTotal: { $sum: { $ifNull: ['$discountAmount', 0] } },
                },
              },
              { $sort: { soldCount: -1, revenue: -1 } },
              {
                $project: {
                  _id: 0,
                  membershipId: '$_id.membershipId',
                  membershipName: '$_id.membershipName',
                  soldCount: 1,
                  revenue: 1,
                  discountTotal: 1,
                },
              },
            ],
            byKind: [
              {
                $group: {
                  _id: '$kind',
                  count: { $sum: 1 },
                },
              },
            ],
          },
        },
        {
          $project: {
            totals: { $arrayElemAt: ['$totals', 0] },
            byMembership: 1,
            byKind: 1,
          },
        },
      ])
      .toArray();

    if (!row?.totals) return empty;

    const byKind = { purchase: 0, upgrade: 0, renew: 0 };
    for (const item of row.byKind ?? []) {
      if (item.kind === 'purchase' || item.kind === 'upgrade' || item.kind === 'renew') {
        byKind[item.kind] = item.count;
      }
    }

    return {
      soldCount: row.totals.soldCount ?? 0,
      uniqueBuyers: (row.totals.uniqueBuyers ?? []).filter(Boolean).length,
      revenue: roundMoney(row.totals.revenue ?? 0),
      discountTotal: roundMoney(row.totals.discountTotal ?? 0),
      couponRedemptions: row.totals.couponRedemptions ?? 0,
      currency: (row.totals.currency || 'usd').toLowerCase(),
      byMembership: (row.byMembership ?? []).map((item) => ({
        membershipId: item.membershipId,
        membershipName: item.membershipName || 'Membership',
        soldCount: item.soldCount,
        revenue: roundMoney(item.revenue ?? 0),
        discountTotal: roundMoney(item.discountTotal ?? 0),
      })),
      byKind,
    };
  }

  async create(data: CreateMembershipPurchaseInput): Promise<MembershipPurchase> {
    const now = new Date();
    const purchase: MembershipPurchase = {
      id: randomUUID(),
      ...data,
      email: data.email.trim().toLowerCase(),
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(toDoc(purchase));
    return purchase;
  }

  async updatePaymentStatus(
    id: string,
    paymentStatus: MembershipPurchase['paymentStatus'],
    extras?: Partial<
      Pick<MembershipPurchase, 'stripePaymentIntentId' | 'stripeCustomerId'>
    >,
  ): Promise<MembershipPurchase | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated: MembershipPurchase = {
      ...existing,
      paymentStatus,
      ...(extras?.stripePaymentIntentId !== undefined
        ? { stripePaymentIntentId: extras.stripePaymentIntentId }
        : {}),
      ...(extras?.stripeCustomerId !== undefined
        ? { stripeCustomerId: extras.stripeCustomerId }
        : {}),
      updatedAt: new Date(),
    };
    await this.collection.replaceOne({ _id: id }, toDoc(updated));
    return updated;
  }
}
