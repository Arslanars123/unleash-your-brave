import { randomUUID } from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { containsCi, getDb } from '../mongo.js';
import type {
  PaginatedResult,
  SpeakerRepository,
} from '../../modules/speakers/speaker.repository.js';
import type { ListSpeakersQuery, Speaker } from '../../modules/speakers/speaker.types.js';

export class MongoSpeakerRepository implements SpeakerRepository {
  private get collection(): Collection<MongoDoc<Speaker>> {
    return getDb().collection<MongoDoc<Speaker>>('speakers');
  }

  async findById(id: string): Promise<Speaker | null> {
    return fromDoc<Speaker>(await this.collection.findOne({ _id: id }));
  }

  async list(query: ListSpeakersQuery): Promise<PaginatedResult<Speaker>> {
    const filter: Filter<MongoDoc<Speaker>> = {};
    if (query.eventId) filter.eventId = query.eventId;
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [
        containsCi('name', search),
        containsCi('title', search),
        containsCi('description', search),
      ];
    }

    const total = await this.collection.countDocuments(filter);
    const docs = await this.collection
      .find(filter)
      .sort({ name: 1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .toArray();

    return { items: fromDocs<Speaker>(docs), total };
  }

  async create(data: Omit<Speaker, 'id' | 'createdAt' | 'updatedAt'>): Promise<Speaker> {
    const now = new Date();
    const speaker: Speaker = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    await this.collection.insertOne(toDoc(speaker));
    return speaker;
  }

  async update(
    id: string,
    data: Partial<Omit<Speaker, 'id' | 'createdAt'>>,
  ): Promise<Speaker | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated: Speaker = {
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
