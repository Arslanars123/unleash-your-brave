import { randomUUID } from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { containsCi, getDb } from '../mongo.js';
import type {
  AnnouncementRepository,
  PaginatedResult,
} from '../../modules/announcements/announcement.repository.js';
import type {
  Announcement,
  ListAnnouncementsQuery,
} from '../../modules/announcements/announcement.types.js';

export class MongoAnnouncementRepository implements AnnouncementRepository {
  private get collection(): Collection<MongoDoc<Announcement>> {
    return getDb().collection<MongoDoc<Announcement>>('announcements');
  }

  async findById(id: string): Promise<Announcement | null> {
    return fromDoc<Announcement>(await this.collection.findOne({ _id: id }));
  }

  async list(query: ListAnnouncementsQuery): Promise<PaginatedResult<Announcement>> {
    const filter: Filter<MongoDoc<Announcement>> = {};
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [containsCi('title', search), containsCi('description', search)];
    }

    const total = await this.collection.countDocuments(filter);
    const docs = await this.collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .toArray();

    return { items: fromDocs<Announcement>(docs), total };
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
