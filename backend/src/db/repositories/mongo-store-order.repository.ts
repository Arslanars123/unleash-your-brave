import { randomUUID } from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../../db/map.js';
import { getDb } from '../../db/mongo.js';
import type { StoreOrderRepository } from '../../modules/store/store-order.repository.js';
import type {
  CreateStoreOrderInput,
  ListStoreOrdersQuery,
  StoreOrder,
} from '../../modules/store/store-order.types.js';
import type { PaginatedResult } from '../../modules/store/store.repository.js';

function containsCi(field: string, value: string) {
  return { [field]: { $regex: value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } };
}

export class MongoStoreOrderRepository implements StoreOrderRepository {
  private get collection(): Collection<MongoDoc<StoreOrder>> {
    return getDb().collection<MongoDoc<StoreOrder>>('store_orders');
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex(
      { stripeCheckoutSessionId: 1 },
      { unique: true, name: 'store_orders_stripe_session_unique' },
    );
    await this.collection.createIndex(
      { eventId: 1, purchasedAt: -1 },
      { name: 'store_orders_event_purchased' },
    );
    await this.collection.createIndex(
      { userId: 1, purchasedAt: -1 },
      { name: 'store_orders_user_purchased' },
    );
    await this.collection.createIndex(
      { productId: 1, purchasedAt: -1 },
      { name: 'store_orders_product_purchased' },
    );
  }

  async findById(id: string): Promise<StoreOrder | null> {
    return fromDoc<StoreOrder>(await this.collection.findOne({ _id: id }));
  }

  async findByStripeCheckoutSessionId(
    stripeCheckoutSessionId: string,
  ): Promise<StoreOrder | null> {
    return fromDoc<StoreOrder>(
      await this.collection.findOne({ stripeCheckoutSessionId }),
    );
  }

  async list(query: ListStoreOrdersQuery): Promise<PaginatedResult<StoreOrder>> {
    const filter: Filter<MongoDoc<StoreOrder>> = {};
    if (query.eventId) filter.eventId = query.eventId;
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [
        containsCi('productName', search),
        containsCi('email', search),
        containsCi('sku', search),
      ];
    }

    const total = await this.collection.countDocuments(filter);
    const docs = await this.collection
      .find(filter)
      .sort({ purchasedAt: -1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .toArray();

    return { items: fromDocs<StoreOrder>(docs), total };
  }

  async listByUserId(userId: string): Promise<StoreOrder[]> {
    const docs = await this.collection
      .find({ userId })
      .sort({ purchasedAt: -1 })
      .toArray();
    return fromDocs<StoreOrder>(docs);
  }

  async listPaidUserIdsByEvent(eventId: string): Promise<string[]> {
    const docs = await this.collection
      .find({ eventId, paymentStatus: 'paid', userId: { $type: 'string' } })
      .project({ userId: 1 })
      .toArray();
    return [...new Set(docs.map((doc) => String(doc.userId)).filter(Boolean))];
  }

  async create(data: CreateStoreOrderInput): Promise<StoreOrder> {
    const now = new Date();
    const order: StoreOrder = {
      id: randomUUID(),
      ...data,
      email: data.email.trim().toLowerCase(),
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(toDoc(order));
    return order;
  }

  async update(
    id: string,
    data: Partial<Omit<StoreOrder, 'id' | 'createdAt'>>,
  ): Promise<StoreOrder | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated: StoreOrder = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    await this.collection.replaceOne({ _id: id }, toDoc(updated));
    return updated;
  }
}
