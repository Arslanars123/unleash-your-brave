import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../../db/map.js';
import { getDb } from '../../db/mongo.js';
import type { MembershipPurchaseRepository } from '../../modules/checkout/purchase.repository.js';
import type {
  CreateMembershipPurchaseInput,
  MembershipPurchase,
} from '../../modules/checkout/purchase.types.js';

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
