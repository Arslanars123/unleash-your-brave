import { randomUUID } from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { containsCi, getDb } from '../mongo.js';
import {
  isVisibleToUser,
  type AnnouncementRepository,
  type PaginatedResult,
} from '../../modules/announcements/announcement.repository.js';
import { normalizeAnnouncement } from '../../modules/announcements/announcement.mapper.js';
import type {
  Announcement,
  ListAnnouncementsQuery,
} from '../../modules/announcements/announcement.types.js';

export class MongoAnnouncementRepository implements AnnouncementRepository {
  private get collection(): Collection<MongoDoc<Announcement>> {
    return getDb().collection<MongoDoc<Announcement>>('announcements');
  }

  async findById(id: string): Promise<Announcement | null> {
    const doc = fromDoc<Announcement>(await this.collection.findOne({ _id: id }));
    return doc ? normalizeAnnouncement(doc) : null;
  }

  async findBySystemKey(systemKey: string): Promise<Announcement | null> {
    const doc = fromDoc<Announcement>(
      await this.collection.findOne({ systemKey } as Filter<MongoDoc<Announcement>>),
    );
    return doc ? normalizeAnnouncement(doc) : null;
  }

  async list(query: ListAnnouncementsQuery): Promise<PaginatedResult<Announcement>> {
    const filter: Filter<MongoDoc<Announcement>> = {};
    if (query.status) filter.status = query.status;
    if (query.kind) filter.kind = query.kind;
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [containsCi('title', search), containsCi('description', search)];
    }

    const total = await this.collection.countDocuments(filter);
    const docs = await this.collection
      .find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .toArray();

    return {
      items: fromDocs<Announcement>(docs).map(normalizeAnnouncement),
      total,
    };
  }

  async listPublishedForUser(input: {
    userId: string;
    roles: string[];
    page: number;
    perPage: number;
  }): Promise<PaginatedResult<Announcement>> {
    // Fetch a larger window then filter in memory for audience rules.
    // Fine for event-scale attendee counts; keeps query simple across legacy docs.
    const docs = await this.collection
      .find({
        $or: [{ status: 'published' }, { status: { $exists: false } }],
      } as Filter<MongoDoc<Announcement>>)
      .sort({ publishedAt: -1, createdAt: -1 })
      .toArray();

    const filtered = fromDocs<Announcement>(docs)
      .map(normalizeAnnouncement)
      .filter((item) => item.status === 'published')
      .filter((item) => isVisibleToUser(item, input.userId, input.roles));

    const start = (input.page - 1) * input.perPage;
    return {
      items: filtered.slice(start, start + input.perPage),
      total: filtered.length,
    };
  }

  async listDueScheduled(now: Date): Promise<Announcement[]> {
    const docs = await this.collection
      .find({
        status: 'scheduled',
        scheduledAt: { $lte: now },
      } as Filter<MongoDoc<Announcement>>)
      .toArray();
    return fromDocs<Announcement>(docs).map(normalizeAnnouncement);
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
    await this.collection.insertOne(toDoc(announcement));
    return announcement;
  }

  async update(
    id: string,
    data: Partial<Omit<Announcement, 'id' | 'createdAt'>>,
  ): Promise<Announcement | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated: Announcement = {
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
