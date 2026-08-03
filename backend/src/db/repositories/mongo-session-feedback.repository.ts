import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { getDb } from '../mongo.js';
import type {
  PaginatedResult,
  SessionFeedbackRepository,
} from '../../modules/sessions/feedback/session-feedback.repository.js';
import type {
  ListSessionFeedbackQuery,
  SessionFeedback,
} from '../../modules/sessions/feedback/session-feedback.types.js';

export class MongoSessionFeedbackRepository implements SessionFeedbackRepository {
  private get collection(): Collection<MongoDoc<SessionFeedback>> {
    return getDb().collection<MongoDoc<SessionFeedback>>('session_feedback');
  }

  async findById(id: string): Promise<SessionFeedback | null> {
    return fromDoc<SessionFeedback>(await this.collection.findOne({ _id: id }));
  }

  async findBySessionAndUser(
    sessionId: string,
    userId: string,
  ): Promise<SessionFeedback | null> {
    return fromDoc<SessionFeedback>(await this.collection.findOne({ sessionId, userId }));
  }

  async listBySession(
    sessionId: string,
    query: ListSessionFeedbackQuery,
  ): Promise<PaginatedResult<SessionFeedback>> {
    const filter = { sessionId };
    const total = await this.collection.countDocuments(filter);
    const docs = await this.collection
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .toArray();
    return { items: fromDocs<SessionFeedback>(docs), total };
  }

  async listAllBySession(sessionId: string): Promise<SessionFeedback[]> {
    const docs = await this.collection.find({ sessionId }).toArray();
    return fromDocs<SessionFeedback>(docs);
  }

  async create(
    data: Omit<SessionFeedback, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SessionFeedback> {
    const now = new Date();
    const item: SessionFeedback = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    await this.collection.insertOne(toDoc(item));
    return item;
  }

  async update(
    id: string,
    data: Partial<Pick<SessionFeedback, 'rating' | 'comment'>>,
  ): Promise<SessionFeedback | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated: SessionFeedback = {
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

  async deleteBySession(sessionId: string): Promise<number> {
    const result = await this.collection.deleteMany({ sessionId });
    return result.deletedCount;
  }
}
