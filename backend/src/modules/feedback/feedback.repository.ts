import type { FeedbackSubmission, ListFeedbackQuery } from './feedback.types.js';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface FeedbackRepository {
  list(query: ListFeedbackQuery): Promise<PaginatedResult<FeedbackSubmission>>;
  create(
    data: Omit<FeedbackSubmission, 'id' | 'createdAt'>,
  ): Promise<FeedbackSubmission>;
}
