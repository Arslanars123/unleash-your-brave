import { randomBytes } from 'node:crypto';
import type { Collection } from 'mongodb';
import { getDb } from '../../db/mongo.js';

export interface CheckInQrTokenRecord {
  code: string;
  eventId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

function collection(): Collection<CheckInQrTokenRecord & { _id: string }> {
  return getDb().collection('checkin_qr_tokens');
}

function newCode(): string {
  return randomBytes(12).toString('base64url');
}

export class CheckInQrTokenRepository {
  async ensureIndexes(): Promise<void> {
    await collection().createIndexes([
      { key: { eventId: 1, userId: 1 }, unique: true, name: 'checkin_qr_tokens_event_user' },
    ]);
  }

  /** Stable short code per event + attendee (refreshed on each issue). */
  async issue(eventId: string, userId: string): Promise<string> {
    const now = new Date();
    const existing = await collection().findOne({ eventId, userId });
    const code = existing?._id ?? newCode();
    const doc: CheckInQrTokenRecord & { _id: string } = {
      _id: code,
      code,
      eventId,
      userId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await collection().replaceOne({ _id: code }, doc, { upsert: true });
    return code;
  }

  async resolve(code: string): Promise<{ eventId: string; userId: string } | null> {
    const doc = await collection().findOne({ _id: code.trim() });
    if (!doc) return null;
    return { eventId: doc.eventId, userId: doc.userId };
  }
}
