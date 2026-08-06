import { randomUUID } from 'node:crypto';
import type {
  Announcement,
  AnnouncementKind,
  AnnouncementStatus,
  ListAnnouncementsQuery,
} from './announcement.types.js';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface AnnouncementRepository {
  findById(id: string): Promise<Announcement | null>;
  findBySystemKey(systemKey: string): Promise<Announcement | null>;
  list(query: ListAnnouncementsQuery): Promise<PaginatedResult<Announcement>>;
  listPublishedForUser(input: {
    userId: string;
    roles: string[];
    page: number;
    perPage: number;
  }): Promise<PaginatedResult<Announcement>>;
  listDueScheduled(now: Date): Promise<Announcement[]>;
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

  async findBySystemKey(systemKey: string): Promise<Announcement | null> {
    return [...this.announcements.values()].find((a) => a.systemKey === systemKey) ?? null;
  }

  async list(query: ListAnnouncementsQuery): Promise<PaginatedResult<Announcement>> {
    const search = query.search?.toLowerCase();
    const filtered = [...this.announcements.values()]
      .filter((item) => {
        if (query.status && item.status !== query.status) return false;
        if (query.kind && item.kind !== query.kind) return false;
        if (!search) return true;
        return (
          item.title.toLowerCase().includes(search) ||
          item.description.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => {
        const aTime = (a.publishedAt ?? a.createdAt).getTime();
        const bTime = (b.publishedAt ?? b.createdAt).getTime();
        return bTime - aTime;
      });

    const start = (query.page - 1) * query.perPage;
    return {
      items: filtered.slice(start, start + query.perPage),
      total: filtered.length,
    };
  }

  async listPublishedForUser(input: {
    userId: string;
    roles: string[];
    page: number;
    perPage: number;
  }): Promise<PaginatedResult<Announcement>> {
    const filtered = [...this.announcements.values()]
      .filter((item) => item.status === 'published')
      .filter((item) => isVisibleToUser(item, input.userId, input.roles))
      .sort((a, b) => {
        const aTime = (a.publishedAt ?? a.createdAt).getTime();
        const bTime = (b.publishedAt ?? b.createdAt).getTime();
        return bTime - aTime;
      });
    const start = (input.page - 1) * input.perPage;
    return {
      items: filtered.slice(start, start + input.perPage),
      total: filtered.length,
    };
  }

  async listDueScheduled(now: Date): Promise<Announcement[]> {
    return [...this.announcements.values()].filter(
      (item) =>
        item.status === 'scheduled' &&
        item.scheduledAt != null &&
        item.scheduledAt.getTime() <= now.getTime(),
    );
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

export function isVisibleToUser(
  item: Pick<Announcement, 'audienceType' | 'audienceRoles' | 'audienceUserIds'>,
  userId: string,
  roles: string[],
): boolean {
  if (item.audienceType === 'all') return true;
  if (item.audienceType === 'users') return item.audienceUserIds.includes(userId);
  if (item.audienceType === 'roles') {
    return item.audienceRoles.some((role) => roles.includes(role));
  }
  return false;
}

export type { AnnouncementKind, AnnouncementStatus };
