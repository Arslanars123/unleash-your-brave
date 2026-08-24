import { randomUUID } from 'node:crypto';
import type {
  CreateStoreOrderInput,
  ListStoreOrdersQuery,
  StoreOrder,
} from './store-order.types.js';
import type { PaginatedResult } from './store.repository.js';

export interface StoreOrderRepository {
  findById(id: string): Promise<StoreOrder | null>;
  findByStripeCheckoutSessionId(stripeCheckoutSessionId: string): Promise<StoreOrder | null>;
  list(query: ListStoreOrdersQuery): Promise<PaginatedResult<StoreOrder>>;
  listByUserId(userId: string): Promise<StoreOrder[]>;
  create(data: CreateStoreOrderInput): Promise<StoreOrder>;
  update(
    id: string,
    data: Partial<Omit<StoreOrder, 'id' | 'createdAt'>>,
  ): Promise<StoreOrder | null>;
}

export class InMemoryStoreOrderRepository implements StoreOrderRepository {
  private readonly items = new Map<string, StoreOrder>();

  async findById(id: string): Promise<StoreOrder | null> {
    return this.items.get(id) ?? null;
  }

  async findByStripeCheckoutSessionId(
    stripeCheckoutSessionId: string,
  ): Promise<StoreOrder | null> {
    for (const item of this.items.values()) {
      if (item.stripeCheckoutSessionId === stripeCheckoutSessionId) return item;
    }
    return null;
  }

  async list(query: ListStoreOrdersQuery): Promise<PaginatedResult<StoreOrder>> {
    const search = query.search?.toLowerCase();
    const filtered = [...this.items.values()]
      .filter((item) => {
        if (query.eventId && item.eventId !== query.eventId) return false;
        if (!search) return true;
        return (
          item.productName.toLowerCase().includes(search) ||
          item.email.toLowerCase().includes(search) ||
          item.sku.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
    const start = (query.page - 1) * query.perPage;
    return { items: filtered.slice(start, start + query.perPage), total: filtered.length };
  }

  async listByUserId(userId: string): Promise<StoreOrder[]> {
    return [...this.items.values()]
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
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
    this.items.set(order.id, order);
    return order;
  }

  async update(
    id: string,
    data: Partial<Omit<StoreOrder, 'id' | 'createdAt'>>,
  ): Promise<StoreOrder | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated: StoreOrder = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.items.set(id, updated);
    return updated;
  }
}
