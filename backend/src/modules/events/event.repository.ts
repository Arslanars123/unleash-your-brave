import { randomUUID } from 'node:crypto';
import type { Event, ListEventsQuery } from './event.types.js';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface EventRepository {
  findById(id: string): Promise<Event | null>;
  list(query: ListEventsQuery): Promise<PaginatedResult<Event>>;
  create(data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event>;
  update(id: string, data: Partial<Omit<Event, 'id' | 'createdAt'>>): Promise<Event | null>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryEventRepository implements EventRepository {
  private readonly events = new Map<string, Event>();

  async findById(id: string): Promise<Event | null> {
    return this.events.get(id) ?? null;
  }

  async list(query: ListEventsQuery): Promise<PaginatedResult<Event>> {
    const search = query.search?.toLowerCase();

    const filtered = [...this.events.values()]
      .filter((event) => {
        if (!search) return true;
        return (
          event.name.toLowerCase().includes(search) ||
          event.tagline.toLowerCase().includes(search) ||
          event.venueCity.toLowerCase().includes(search) ||
          event.venueName.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

    const start = (query.page - 1) * query.perPage;
    return {
      items: filtered.slice(start, start + query.perPage),
      total: filtered.length,
    };
  }

  async create(data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> {
    const now = new Date();
    const event: Event = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.events.set(event.id, event);
    return event;
  }

  async update(
    id: string,
    data: Partial<Omit<Event, 'id' | 'createdAt'>>,
  ): Promise<Event | null> {
    const existing = this.events.get(id);
    if (!existing) return null;

    const updated: Event = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.events.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.events.delete(id);
  }
}
