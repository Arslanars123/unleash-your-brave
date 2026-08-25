import { randomUUID } from 'node:crypto';
import type { ListMembershipsQuery, Membership } from './membership.types.js';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface MembershipRepository {
  findById(id: string): Promise<Membership | null>;
  list(query: ListMembershipsQuery): Promise<PaginatedResult<Membership>>;
  listByIds(ids: string[]): Promise<Membership[]>;
  create(data: Omit<Membership, 'id' | 'createdAt' | 'updatedAt'>): Promise<Membership>;
  update(
    id: string,
    data: Partial<Omit<Membership, 'id' | 'createdAt'>>,
  ): Promise<Membership | null>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryMembershipRepository implements MembershipRepository {
  private readonly memberships = new Map<string, Membership>();

  async findById(id: string): Promise<Membership | null> {
    return this.memberships.get(id) ?? null;
  }

  async list(query: ListMembershipsQuery): Promise<PaginatedResult<Membership>> {
    const search = query.search?.toLowerCase();

    const filtered = [...this.memberships.values()]
      .filter((membership) => {
        if (query.eventId && membership.eventId !== query.eventId) return false;
        if (!search) return true;
        return (
          membership.name.toLowerCase().includes(search) ||
          membership.description.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const start = (query.page - 1) * query.perPage;
    return {
      items: filtered.slice(start, start + query.perPage),
      total: filtered.length,
    };
  }

  async listByIds(ids: string[]): Promise<Membership[]> {
    const set = new Set(ids);
    return [...this.memberships.values()]
      .filter((membership) => set.has(membership.id))
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.price - b.price ||
          a.name.localeCompare(b.name),
      );
  }

  async create(data: Omit<Membership, 'id' | 'createdAt' | 'updatedAt'>): Promise<Membership> {
    const now = new Date();
    const membership: Membership = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.memberships.set(membership.id, membership);
    return membership;
  }

  async update(
    id: string,
    data: Partial<Omit<Membership, 'id' | 'createdAt'>>,
  ): Promise<Membership | null> {
    const existing = this.memberships.get(id);
    if (!existing) return null;

    const updated: Membership = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.memberships.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.memberships.delete(id);
  }
}
