import { randomUUID } from 'node:crypto';
import type { ListSessionsQuery, Session } from './session.types.js';

function isSessionAccessible(session: Session, membershipId: string | null): boolean {
  const membershipIds = session.membershipIds ?? [];
  if (membershipIds.length === 0) return true;
  if (!membershipId) return false;
  return membershipIds.includes(membershipId);
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface SessionRepository {
  findById(id: string): Promise<Session | null>;
  list(query: ListSessionsQuery): Promise<PaginatedResult<Session>>;
  create(data: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<Session>;
  update(id: string, data: Partial<Omit<Session, 'id' | 'createdAt'>>): Promise<Session | null>;
  delete(id: string): Promise<boolean>;
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>();

  async findById(id: string): Promise<Session | null> {
    return this.sessions.get(id) ?? null;
  }

  async list(query: ListSessionsQuery): Promise<PaginatedResult<Session>> {
    const search = query.search?.toLowerCase();

    const filtered = [...this.sessions.values()]
      .filter((session) => {
        if (query.eventId && session.eventId !== query.eventId) return false;
        if (query.speakerId && session.speakerId !== query.speakerId) return false;
        if (query.eventDayNumber && session.eventDayNumber !== query.eventDayNumber) return false;
        if (query.accessibleToMembershipId !== undefined) {
          if (!isSessionAccessible(session, query.accessibleToMembershipId)) {
            return false;
          }
        }
        if (!search) return true;
        return (
          session.name.toLowerCase().includes(search) ||
          session.description.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => {
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
      items: filtered.slice(start, start + query.perPage),
      total: filtered.length,
    };
  }

  async create(data: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<Session> {
    const now = new Date();
    const session: Session = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async update(
    id: string,
    data: Partial<Omit<Session, 'id' | 'createdAt'>>,
  ): Promise<Session | null> {
    const existing = this.sessions.get(id);
    if (!existing) return null;

    const updated: Session = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.sessions.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }
}
