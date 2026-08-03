import { randomUUID } from 'node:crypto';
import type { ListSpeakersQuery, Speaker } from './speaker.types.js';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface SpeakerRepository {
  findById(id: string): Promise<Speaker | null>;
  list(query: ListSpeakersQuery): Promise<PaginatedResult<Speaker>>;
  create(data: Omit<Speaker, 'id' | 'createdAt' | 'updatedAt'>): Promise<Speaker>;
  update(id: string, data: Partial<Omit<Speaker, 'id' | 'createdAt'>>): Promise<Speaker | null>;
  delete(id: string): Promise<boolean>;
}

export class InMemorySpeakerRepository implements SpeakerRepository {
  private readonly speakers = new Map<string, Speaker>();

  async findById(id: string): Promise<Speaker | null> {
    return this.speakers.get(id) ?? null;
  }

  async list(query: ListSpeakersQuery): Promise<PaginatedResult<Speaker>> {
    const search = query.search?.toLowerCase();

    const filtered = [...this.speakers.values()]
      .filter((speaker) => {
        if (query.eventId && speaker.eventId !== query.eventId) return false;
        if (!search) return true;
        return (
          speaker.name.toLowerCase().includes(search) ||
          speaker.title.toLowerCase().includes(search) ||
          speaker.description.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const start = (query.page - 1) * query.perPage;
    return {
      items: filtered.slice(start, start + query.perPage),
      total: filtered.length,
    };
  }

  async create(data: Omit<Speaker, 'id' | 'createdAt' | 'updatedAt'>): Promise<Speaker> {
    const now = new Date();
    const speaker: Speaker = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.speakers.set(speaker.id, speaker);
    return speaker;
  }

  async update(
    id: string,
    data: Partial<Omit<Speaker, 'id' | 'createdAt'>>,
  ): Promise<Speaker | null> {
    const existing = this.speakers.get(id);
    if (!existing) return null;

    const updated: Speaker = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.speakers.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.speakers.delete(id);
  }
}
