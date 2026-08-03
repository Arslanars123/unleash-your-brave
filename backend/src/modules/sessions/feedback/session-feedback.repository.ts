import { randomUUID } from 'node:crypto';
import type {
  ListSessionFeedbackQuery,
  SessionFeedback,
} from './session-feedback.types.js';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface SessionFeedbackRepository {
  findById(id: string): Promise<SessionFeedback | null>;
  findBySessionAndUser(sessionId: string, userId: string): Promise<SessionFeedback | null>;
  listBySession(
    sessionId: string,
    query: ListSessionFeedbackQuery,
  ): Promise<PaginatedResult<SessionFeedback>>;
  listAllBySession(sessionId: string): Promise<SessionFeedback[]>;
  create(
    data: Omit<SessionFeedback, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SessionFeedback>;
  update(
    id: string,
    data: Partial<Pick<SessionFeedback, 'rating' | 'comment'>>,
  ): Promise<SessionFeedback | null>;
  delete(id: string): Promise<boolean>;
  deleteBySession(sessionId: string): Promise<number>;
}

export class InMemorySessionFeedbackRepository implements SessionFeedbackRepository {
  private readonly feedback = new Map<string, SessionFeedback>();

  async findById(id: string): Promise<SessionFeedback | null> {
    return this.feedback.get(id) ?? null;
  }

  async findBySessionAndUser(
    sessionId: string,
    userId: string,
  ): Promise<SessionFeedback | null> {
    for (const item of this.feedback.values()) {
      if (item.sessionId === sessionId && item.userId === userId) return item;
    }
    return null;
  }

  async listBySession(
    sessionId: string,
    query: ListSessionFeedbackQuery,
  ): Promise<PaginatedResult<SessionFeedback>> {
    const filtered = [...this.feedback.values()]
      .filter((item) => item.sessionId === sessionId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const start = (query.page - 1) * query.perPage;
    return {
      items: filtered.slice(start, start + query.perPage),
      total: filtered.length,
    };
  }

  async listAllBySession(sessionId: string): Promise<SessionFeedback[]> {
    return [...this.feedback.values()].filter((item) => item.sessionId === sessionId);
  }

  async create(
    data: Omit<SessionFeedback, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SessionFeedback> {
    const now = new Date();
    const item: SessionFeedback = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.feedback.set(item.id, item);
    return item;
  }

  async update(
    id: string,
    data: Partial<Pick<SessionFeedback, 'rating' | 'comment'>>,
  ): Promise<SessionFeedback | null> {
    const existing = this.feedback.get(id);
    if (!existing) return null;

    const updated: SessionFeedback = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.feedback.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.feedback.delete(id);
  }

  async deleteBySession(sessionId: string): Promise<number> {
    let removed = 0;
    for (const [id, item] of this.feedback.entries()) {
      if (item.sessionId === sessionId) {
        this.feedback.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}
