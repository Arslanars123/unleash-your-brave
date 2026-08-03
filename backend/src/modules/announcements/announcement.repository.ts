import { randomUUID } from 'node:crypto';
import type { Announcement, ListAnnouncementsQuery } from './announcement.types.js';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface AnnouncementRepository {
  findById(id: string): Promise<Announcement | null>;
  list(query: ListAnnouncementsQuery): Promise<PaginatedResult<Announcement>>;
  create(data: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>): Promise<Announcement>;
  update(
    id: string,
    data: Partial<Omit<Announcement, 'id' | 'createdAt'>>,
  ): Promise<Announcement | null>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryAnnouncementRepository implements AnnouncementRepository {
  private readonly announcements = new Map<string, Announcement>();

  async findById(id: string): Promise<Announcement | null> {
    return this.announcements.get(id) ?? null;
  }

  async list(query: ListAnnouncementsQuery): Promise<PaginatedResult<Announcement>> {
    const search = query.search?.toLowerCase();

    const filtered = [...this.announcements.values()]
      .filter((item) => {
        if (!search) return true;
        return (
          item.title.toLowerCase().includes(search) ||
          item.description.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = (query.page - 1) * query.perPage;
    return {
      items: filtered.slice(start, start + query.perPage),
      total: filtered.length,
    };
  }

  async create(
    data: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Announcement> {
    const now = new Date();
    const announcement: Announcement = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.announcements.set(announcement.id, announcement);
    return announcement;
  }

  async update(
    id: string,
    data: Partial<Omit<Announcement, 'id' | 'createdAt'>>,
  ): Promise<Announcement | null> {
    const existing = this.announcements.get(id);
    if (!existing) return null;

    const updated: Announcement = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.announcements.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.announcements.delete(id);
  }
}
