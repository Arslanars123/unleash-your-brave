import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../../db/map.js';
import { getDb } from '../../db/mongo.js';
import type { CheckIn } from '../../modules/checkins/checkin.types.js';

export interface CheckInRepository {
  findByEventAndUser(eventId: string, userId: string): Promise<CheckIn | null>;
  listByEvent(eventId: string): Promise<CheckIn[]>;
  countByEvent(eventId: string): Promise<number>;
  create(data: Omit<CheckIn, 'id' | 'createdAt' | 'updatedAt'>): Promise<CheckIn>;
}

export class MongoCheckInRepository implements CheckInRepository {
  private get collection(): Collection<MongoDoc<CheckIn>> {
    return getDb().collection<MongoDoc<CheckIn>>('checkins');
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex(
      { eventId: 1, userId: 1 },
      { unique: true, name: 'event_user_unique' },
    );
    await this.collection.createIndex({ eventId: 1, checkedInAt: -1 });
  }

  async findByEventAndUser(eventId: string, userId: string): Promise<CheckIn | null> {
    return fromDoc<CheckIn>(await this.collection.findOne({ eventId, userId }));
  }

  async listByEvent(eventId: string): Promise<CheckIn[]> {
    const docs = await this.collection
      .find({ eventId })
      .sort({ checkedInAt: -1 })
      .toArray();
    return fromDocs<CheckIn>(docs);
  }

  async countByEvent(eventId: string): Promise<number> {
    return this.collection.countDocuments({ eventId });
  }

  async create(
    data: Omit<CheckIn, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CheckIn> {
    const now = new Date();
    const checkIn: CheckIn = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(toDoc(checkIn));
    return checkIn;
  }
}
