import { randomUUID } from 'node:crypto';
import type { ListSponsorsQuery, Sponsor } from './sponsor.types.js';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface SponsorRepository {
  findById(id: string): Promise<Sponsor | null>;
  list(query: ListSponsorsQuery): Promise<PaginatedResult<Sponsor>>;
  create(data: Omit<Sponsor, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sponsor>;
  update(id: string, data: Partial<Omit<Sponsor, 'id' | 'createdAt'>>): Promise<Sponsor | null>;
  delete(id: string): Promise<boolean>;
}

export class InMemorySponsorRepository implements SponsorRepository {
  private readonly sponsors = new Map<string, Sponsor>();

  async findById(id: string): Promise<Sponsor | null> {
    return this.sponsors.get(id) ?? null;
  }

  async list(query: ListSponsorsQuery): Promise<PaginatedResult<Sponsor>> {
    const search = query.search?.toLowerCase();

    const filtered = [...this.sponsors.values()]
      .filter((sponsor) => {
        if (query.eventId && sponsor.eventId !== query.eventId) return false;
        if (!search) return true;
        return (
          sponsor.name.toLowerCase().includes(search) ||
          sponsor.description.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const start = (query.page - 1) * query.perPage;
    return {
      items: filtered.slice(start, start + query.perPage),
      total: filtered.length,
    };
  }

  async create(data: Omit<Sponsor, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sponsor> {
    const now = new Date();
    const sponsor: Sponsor = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.sponsors.set(sponsor.id, sponsor);
    return sponsor;
  }

  async update(
    id: string,
    data: Partial<Omit<Sponsor, 'id' | 'createdAt'>>,
  ): Promise<Sponsor | null> {
    const existing = this.sponsors.get(id);
    if (!existing) return null;

    const updated: Sponsor = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.sponsors.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.sponsors.delete(id);
  }
}
