import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { getDb } from '../mongo.js';
import type { AnnouncementRead } from '../../modules/announcements/announcement.types.js';

export interface AnnouncementReadRepository {
  markRead(announcementId: string, userId: string): Promise<AnnouncementRead>;
  listReadIds(userId: string, announcementIds: string[]): Promise<Set<string>>;
  countUnread(userId: string, publishedIds: string[]): Promise<number>;
}

export class MongoAnnouncementReadRepository implements AnnouncementReadRepository {
  private get collection(): Collection<MongoDoc<AnnouncementRead>> {
    return getDb().collection<MongoDoc<AnnouncementRead>>('announcement_reads');
  }

  async markRead(announcementId: string, userId: string): Promise<AnnouncementRead> {
    const existing = fromDoc<AnnouncementRead>(
      await this.collection.findOne({ announcementId, userId } as never),
    );
    if (existing) return existing;

    const read: AnnouncementRead = {
      id: randomUUID(),
      announcementId,
      userId,
      readAt: new Date(),
    };
    try {
      await this.collection.insertOne(toDoc(read));
    } catch {
      const raced = fromDoc<AnnouncementRead>(
        await this.collection.findOne({ announcementId, userId } as never),
      );
      if (raced) return raced;
      throw new Error('Failed to mark announcement read');
    }
    return read;
  }

  async listReadIds(userId: string, announcementIds: string[]): Promise<Set<string>> {
    if (announcementIds.length === 0) return new Set();
    const docs = await this.collection
      .find({
        userId,
        announcementId: { $in: announcementIds },
      } as never)
      .toArray();
    return new Set(fromDocs<AnnouncementRead>(docs).map((d) => d.announcementId));
  }

  async countUnread(userId: string, publishedIds: string[]): Promise<number> {
    if (publishedIds.length === 0) return 0;
    const read = await this.listReadIds(userId, publishedIds);
    return publishedIds.filter((id) => !read.has(id)).length;
  }
}
