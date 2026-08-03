import { randomUUID } from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { containsCi, getDb } from '../mongo.js';
import type { EventRepository, PaginatedResult } from '../../modules/events/event.repository.js';
import type { Event, ListEventsQuery } from '../../modules/events/event.types.js';

export class MongoEventRepository implements EventRepository {
  private get collection(): Collection<MongoDoc<Event>> {
    return getDb().collection<MongoDoc<Event>>('events');
  }

  async findById(id: string): Promise<Event | null> {
    return fromDoc<Event>(await this.collection.findOne({ _id: id }));
  }

  async list(query: ListEventsQuery): Promise<PaginatedResult<Event>> {
    const filter: Filter<MongoDoc<Event>> = {};
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [
        containsCi('name', search),
        containsCi('tagline', search),
        containsCi('venueCity', search),
        containsCi('venueName', search),
      ];
    }

    const total = await this.collection.countDocuments(filter);
    const docs = await this.collection
      .find(filter)
      .sort({ startDate: -1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .toArray();

    return { items: fromDocs<Event>(docs), total };
  }

  async create(data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> {
    const now = new Date();
    const event: Event = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    await this.collection.insertOne(toDoc(event));
    return event;
  }

  async update(
    id: string,
    data: Partial<Omit<Event, 'id' | 'createdAt'>>,
  ): Promise<Event | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated: Event = {
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
