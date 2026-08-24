import { randomUUID } from 'node:crypto';
import type {
  ListStoreCategoriesQuery,
  ListStoreProductsQuery,
  StoreCategory,
  StoreProduct,
} from './store.types.js';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface StoreCategoryRepository {
  findById(id: string): Promise<StoreCategory | null>;
  list(query: ListStoreCategoriesQuery): Promise<PaginatedResult<StoreCategory>>;
  create(data: Omit<StoreCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoreCategory>;
  update(
    id: string,
    data: Partial<Omit<StoreCategory, 'id' | 'createdAt'>>,
  ): Promise<StoreCategory | null>;
  delete(id: string): Promise<boolean>;
}

export interface StoreProductRepository {
  findById(id: string): Promise<StoreProduct | null>;
  list(query: ListStoreProductsQuery): Promise<PaginatedResult<StoreProduct>>;
  countByCategory(categoryId: string): Promise<number>;
  countByEventCategories(eventId: string): Promise<Map<string, number>>;
  create(data: Omit<StoreProduct, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoreProduct>;
  update(
    id: string,
    data: Partial<Omit<StoreProduct, 'id' | 'createdAt'>>,
  ): Promise<StoreProduct | null>;
  delete(id: string): Promise<boolean>;
  clearCategory(categoryId: string): Promise<number>;
  /** Atomically reduce stock when qty is available. Returns false if insufficient. */
  decrementStock(id: string, quantity: number): Promise<boolean>;
}

export class InMemoryStoreCategoryRepository implements StoreCategoryRepository {
  private readonly items = new Map<string, StoreCategory>();

  async findById(id: string): Promise<StoreCategory | null> {
    return this.items.get(id) ?? null;
  }

  async list(query: ListStoreCategoriesQuery): Promise<PaginatedResult<StoreCategory>> {
    const search = query.search?.toLowerCase();
    const filtered = [...this.items.values()]
      .filter((item) => {
        if (query.eventId && item.eventId !== query.eventId) return false;
        if (query.activeOnly && !item.isActive) return false;
        if (!search) return true;
        return (
          item.name.toLowerCase().includes(search) ||
          item.description.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const start = (query.page - 1) * query.perPage;
    return { items: filtered.slice(start, start + query.perPage), total: filtered.length };
  }

  async create(data: Omit<StoreCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoreCategory> {
    const now = new Date();
    const item: StoreCategory = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    this.items.set(item.id, item);
    return item;
  }

  async update(
    id: string,
    data: Partial<Omit<StoreCategory, 'id' | 'createdAt'>>,
  ): Promise<StoreCategory | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated: StoreCategory = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }
}

export class InMemoryStoreProductRepository implements StoreProductRepository {
  private readonly items = new Map<string, StoreProduct>();

  async findById(id: string): Promise<StoreProduct | null> {
    return this.items.get(id) ?? null;
  }

  async list(query: ListStoreProductsQuery): Promise<PaginatedResult<StoreProduct>> {
    const search = query.search?.toLowerCase();
    const filtered = [...this.items.values()]
      .filter((item) => {
        if (query.eventId && item.eventId !== query.eventId) return false;
        if (query.categoryId && item.categoryId !== query.categoryId) return false;
        if (query.featured !== undefined && item.featured !== query.featured) return false;
        if (query.activeOnly && !item.isActive) return false;
        if (query.inStockOnly && item.stockQty <= 0) return false;
        if (!search) return true;
        return (
          item.name.toLowerCase().includes(search) ||
          item.description.toLowerCase().includes(search) ||
          item.sku.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const start = (query.page - 1) * query.perPage;
    return { items: filtered.slice(start, start + query.perPage), total: filtered.length };
  }

  async countByCategory(categoryId: string): Promise<number> {
    return [...this.items.values()].filter((item) => item.categoryId === categoryId).length;
  }

  async countByEventCategories(eventId: string): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const item of this.items.values()) {
      if (item.eventId !== eventId || !item.categoryId) continue;
      counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
    }
    return counts;
  }

  async create(data: Omit<StoreProduct, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoreProduct> {
    const now = new Date();
    const item: StoreProduct = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    this.items.set(item.id, item);
    return item;
  }

  async update(
    id: string,
    data: Partial<Omit<StoreProduct, 'id' | 'createdAt'>>,
  ): Promise<StoreProduct | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated: StoreProduct = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  async clearCategory(categoryId: string): Promise<number> {
    let count = 0;
    for (const [id, item] of this.items) {
      if (item.categoryId === categoryId) {
        this.items.set(id, { ...item, categoryId: null, updatedAt: new Date() });
        count += 1;
      }
    }
    return count;
  }

  async decrementStock(id: string, quantity: number): Promise<boolean> {
    const existing = this.items.get(id);
    if (!existing || quantity <= 0 || existing.stockQty < quantity) return false;
    this.items.set(id, {
      ...existing,
      stockQty: existing.stockQty - quantity,
      updatedAt: new Date(),
    });
    return true;
  }
}
