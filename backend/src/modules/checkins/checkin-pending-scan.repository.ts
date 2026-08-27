import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { fromDoc, toDoc, type MongoDoc } from '../../db/map.js';
import { getDb } from '../../db/mongo.js';

export interface CheckInPendingScan {
  id: string;
  eventId: string;
  userId: string;
  formId: string;
  /** Admin who scanned the QR. */
  scannedBy: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckInPendingScanRepository {
  upsert(data: {
    eventId: string;
    userId: string;
    formId: string;
    scannedBy: string;
    expiresAt: Date;
  }): Promise<CheckInPendingScan>;
  findActiveByUser(
    userId: string,
    eventId?: string,
  ): Promise<CheckInPendingScan | null>;
  findActiveByEventAndUser(
    eventId: string,
    userId: string,
  ): Promise<CheckInPendingScan | null>;
  deleteByEventAndUser(eventId: string, userId: string): Promise<void>;
  deleteById(id: string): Promise<void>;
}

export class MongoCheckInPendingScanRepository
  implements CheckInPendingScanRepository
{
  private get collection(): Collection<MongoDoc<CheckInPendingScan>> {
    return getDb().collection<MongoDoc<CheckInPendingScan>>('checkin_pending_scans');
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex(
      { eventId: 1, userId: 1 },
      { unique: true, name: 'event_user_unique' },
    );
    await this.collection.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: 'expires_ttl' },
    );
    await this.collection.createIndex({ userId: 1, expiresAt: -1 });
  }

  async upsert(data: {
    eventId: string;
    userId: string;
    formId: string;
    scannedBy: string;
    expiresAt: Date;
  }): Promise<CheckInPendingScan> {
    const now = new Date();
    const existing = await this.collection.findOne({
      eventId: data.eventId,
      userId: data.userId,
    });

    if (existing) {
      await this.collection.updateOne(
        { _id: existing._id },
        {
          $set: {
            formId: data.formId,
            scannedBy: data.scannedBy,
            expiresAt: data.expiresAt,
            updatedAt: now,
          },
        },
      );
      return fromDoc<CheckInPendingScan>({
        ...existing,
        formId: data.formId,
        scannedBy: data.scannedBy,
        expiresAt: data.expiresAt,
        updatedAt: now,
      })!;
    }

    const pending: CheckInPendingScan = {
      id: randomUUID(),
      eventId: data.eventId,
      userId: data.userId,
      formId: data.formId,
      scannedBy: data.scannedBy,
      expiresAt: data.expiresAt,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(toDoc(pending));
    return pending;
  }

  async findActiveByUser(
    userId: string,
    eventId?: string,
  ): Promise<CheckInPendingScan | null> {
    const now = new Date();
    const filter: Record<string, unknown> = {
      userId,
      expiresAt: { $gt: now },
    };
    if (eventId) filter.eventId = eventId;
    return fromDoc<CheckInPendingScan>(
      await this.collection.findOne(filter, { sort: { updatedAt: -1 } }),
    );
  }

  async findActiveByEventAndUser(
    eventId: string,
    userId: string,
  ): Promise<CheckInPendingScan | null> {
    return this.findActiveByUser(userId, eventId);
  }

  async deleteByEventAndUser(eventId: string, userId: string): Promise<void> {
    await this.collection.deleteOne({ eventId, userId });
  }

  async deleteById(id: string): Promise<void> {
    await this.collection.deleteOne({ _id: id });
  }
}
