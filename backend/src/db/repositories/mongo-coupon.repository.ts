import { randomUUID } from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { containsCi, getDb } from '../mongo.js';
import type { CouponRepository, PaginatedResult } from '../../modules/coupons/coupon.repository.js';
import type { Coupon, ListCouponsQuery } from '../../modules/coupons/coupon.types.js';

export class MongoCouponRepository implements CouponRepository {
  private get collection(): Collection<MongoDoc<Coupon>> {
    return getDb().collection<MongoDoc<Coupon>>('coupons');
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ code: 1 }, { unique: true });
  }

  async findById(id: string): Promise<Coupon | null> {
    return fromDoc<Coupon>(await this.collection.findOne({ _id: id }));
  }

  async findByCode(code: string): Promise<Coupon | null> {
    return fromDoc<Coupon>(await this.collection.findOne({ code }));
  }

  async list(query: ListCouponsQuery): Promise<PaginatedResult<Coupon>> {
    const filter: Filter<MongoDoc<Coupon>> = {};
    if (query.active !== undefined) filter.active = query.active;
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [
        containsCi('code', search),
        containsCi('name', search),
        containsCi('description', search),
      ];
    }

    const total = await this.collection.countDocuments(filter);
    const docs = await this.collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .toArray();

    return { items: fromDocs<Coupon>(docs), total };
  }

  async create(data: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt'>): Promise<Coupon> {
    const now = new Date();
    const coupon: Coupon = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    await this.collection.insertOne(toDoc(coupon));
    return coupon;
  }

  async update(
    id: string,
    data: Partial<Omit<Coupon, 'id' | 'createdAt'>>,
  ): Promise<Coupon | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated: Coupon = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    await this.collection.replaceOne({ _id: id }, toDoc(updated));
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  async incrementRedemption(id: string): Promise<Coupon | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $inc: { redemptionCount: 1 }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    return fromDoc<Coupon>(result);
  }
}
