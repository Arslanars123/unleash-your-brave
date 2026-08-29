import { randomUUID } from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { containsCi, getDb } from '../mongo.js';
import type {
  PaginatedResult,
  StoreCategoryRepository,
  StoreProductRepository,
} from '../../modules/store/store.repository.js';
import type {
  ListStoreCategoriesQuery,
  ListStoreProductsQuery,
  StoreCategory,
  StoreProduct,
} from '../../modules/store/store.types.js';

export class MongoStoreCategoryRepository implements StoreCategoryRepository {
  private get collection(): Collection<MongoDoc<StoreCategory>> {
    return getDb().collection<MongoDoc<StoreCategory>>('store_categories');
  }

  async findById(id: string): Promise<StoreCategory | null> {
    return fromDoc<StoreCategory>(await this.collection.findOne({ _id: id }));
  }

  async list(query: ListStoreCategoriesQuery): Promise<PaginatedResult<StoreCategory>> {
    const filter: Filter<MongoDoc<StoreCategory>> = {};
    if (query.activeOnly) filter.isActive = true;
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [containsCi('name', search), containsCi('description', search)];
    }

    const total = await this.collection.countDocuments(filter);
    const docs = await this.collection
      .find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .toArray();

    return { items: fromDocs<StoreCategory>(docs), total };
  }

  async create(data: Omit<StoreCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoreCategory> {
    const now = new Date();
    const category: StoreCategory = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    await this.collection.insertOne(toDoc(category));
    return category;
  }

  async update(
    id: string,
    data: Partial<Omit<StoreCategory, 'id' | 'createdAt'>>,
  ): Promise<StoreCategory | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated: StoreCategory = {
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
}

export class MongoStoreProductRepository implements StoreProductRepository {
  private get collection(): Collection<MongoDoc<StoreProduct>> {
    return getDb().collection<MongoDoc<StoreProduct>>('store_products');
  }

  async findById(id: string): Promise<StoreProduct | null> {
    return fromDoc<StoreProduct>(await this.collection.findOne({ _id: id }));
  }

  async list(query: ListStoreProductsQuery): Promise<PaginatedResult<StoreProduct>> {
    const filter: Filter<MongoDoc<StoreProduct>> = {};
    if (query.categoryId) filter.categoryId = query.categoryId;
    if (query.featured !== undefined) filter.featured = query.featured;
    if (query.activeOnly) filter.isActive = true;
    if (query.inStockOnly) {
      filter.stockQty = { $gt: 0 };
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      const searchClause = {
        $or: [containsCi('name', search), containsCi('description', search), containsCi('sku', search)],
      };
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, searchClause];
        delete filter.$or;
      } else {
        Object.assign(filter, searchClause);
      }
    }

    const total = await this.collection.countDocuments(filter);
    const docs = await this.collection
      .find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .toArray();

    return { items: fromDocs<StoreProduct>(docs), total };
  }

  async countByCategory(categoryId: string): Promise<number> {
    return this.collection.countDocuments({ categoryId });
  }

  async create(data: Omit<StoreProduct, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoreProduct> {
    const now = new Date();
    const product: StoreProduct = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    await this.collection.insertOne(toDoc(product));
    return product;
  }

  async update(
    id: string,
    data: Partial<Omit<StoreProduct, 'id' | 'createdAt'>>,
  ): Promise<StoreProduct | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated: StoreProduct = {
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

  async clearCategory(categoryId: string): Promise<number> {
    const result = await this.collection.updateMany(
      { categoryId },
      { $set: { categoryId: null, updatedAt: new Date() } },
    );
    return result.modifiedCount;
  }

  async decrementStock(id: string, quantity: number): Promise<boolean> {
    if (quantity <= 0) return false;
    const result = await this.collection.findOneAndUpdate(
      { _id: id, stockQty: { $gte: quantity } },
      { $inc: { stockQty: -quantity }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    return Boolean(result);
  }
}
