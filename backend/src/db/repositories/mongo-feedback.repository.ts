import { randomUUID } from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { fromDocs, toDoc, type MongoDoc } from '../map.js';
import { containsCi, getDb } from '../mongo.js';
import type {
  FeedbackRepository,
  PaginatedResult,
} from '../../modules/feedback/feedback.repository.js';
import type { FeedbackSubmission, ListFeedbackQuery } from '../../modules/feedback/feedback.types.js';

export class MongoFeedbackRepository implements FeedbackRepository {
  private get collection(): Collection<MongoDoc<FeedbackSubmission>> {
    return getDb().collection<MongoDoc<FeedbackSubmission>>('feedback_submissions');
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ createdAt: -1 }, { name: 'feedback_createdAt' });
    await this.collection.createIndex({ email: 1 }, { name: 'feedback_email' });
  }

  async list(query: ListFeedbackQuery): Promise<PaginatedResult<FeedbackSubmission>> {
    const filter: Filter<MongoDoc<FeedbackSubmission>> = {};
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [
        containsCi('name', search),
        containsCi('email', search),
        containsCi('feedback', search),
      ];
    }

    const total = await this.collection.countDocuments(filter);
    const docs = await this.collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .toArray();

    return { items: fromDocs<FeedbackSubmission>(docs), total };
  }

  async create(
    data: Omit<FeedbackSubmission, 'id' | 'createdAt'>,
  ): Promise<FeedbackSubmission> {
    const item: FeedbackSubmission = {
      id: randomUUID(),
      ...data,
      createdAt: new Date(),
    };
    await this.collection.insertOne(toDoc(item));
    return item;
  }
}
