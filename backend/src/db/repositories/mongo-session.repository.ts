import { randomUUID } from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { containsCi, getDb } from '../mongo.js';
import type {
  PaginatedResult,
  SessionRepository,
} from '../../modules/sessions/session.repository.js';
import type { ListSessionsQuery, Session } from '../../modules/sessions/session.types.js';

export class MongoSessionRepository implements SessionRepository {
  private get collection(): Collection<MongoDoc<Session>> {
    return getDb().collection<MongoDoc<Session>>('sessions');
  }

  async findById(id: string): Promise<Session | null> {
    return fromDoc<Session>(await this.collection.findOne({ _id: id }));
  }

  async list(query: ListSessionsQuery): Promise<PaginatedResult<Session>> {
    const filter: Filter<MongoDoc<Session>> = {};
    if (query.eventId) filter.eventId = query.eventId;
    if (query.speakerId) filter.speakerId = query.speakerId;
    if (query.eventDayNumber) filter.eventDayNumber = query.eventDayNumber;
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [containsCi('name', search), containsCi('description', search)];
    }

    const docs = await this.collection.find(filter).toArray();
    const sorted = fromDocs<Session>(docs).sort((a, b) => {
      if (a.eventDayNumber !== b.eventDayNumber) {
        return a.eventDayNumber - b.eventDayNumber;
      }
      const aTime = a.startTime || '99:99';
      const bTime = b.startTime || '99:99';
      if (aTime !== bTime) return aTime.localeCompare(bTime);
      return a.name.localeCompare(b.name);
    });

    const start = (query.page - 1) * query.perPage;
    return {
      items: sorted.slice(start, start + query.perPage),
      total: sorted.length,
    };
  }

  async create(data: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<Session> {
    const now = new Date();
    const session: Session = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    await this.collection.insertOne(toDoc(session));
    return session;
  }

  async update(
    id: string,
    data: Partial<Omit<Session, 'id' | 'createdAt'>>,
  ): Promise<Session | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated: Session = {
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
