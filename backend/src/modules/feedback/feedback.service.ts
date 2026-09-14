import { logger } from '../../core/logger.js';
import type { MailService } from '../mail/mail.service.js';
import type { FeedbackRepository, PaginatedResult } from './feedback.repository.js';
import { toPublicFeedback } from './feedback.mapper.js';
import type {
  CreateFeedbackInput,
  ListFeedbackQuery,
  PublicFeedbackSubmission,
} from './feedback.types.js';

export class FeedbackService {
  constructor(
    private readonly feedback: FeedbackRepository,
    private readonly mail: MailService,
  ) {}

  async list(query: ListFeedbackQuery): Promise<PaginatedResult<PublicFeedbackSubmission>> {
    const { items, total } = await this.feedback.list(query);
    return { items: items.map(toPublicFeedback), total };
  }

  async create(input: CreateFeedbackInput): Promise<PublicFeedbackSubmission> {
    const created = await this.feedback.create({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      feedback: input.feedback.trim(),
    });

    try {
      await this.mail.sendFeedbackSubmissionNotice({
        name: created.name,
        email: created.email,
        feedback: created.feedback,
      });
    } catch (error) {
      logger.error(
        { err: error, feedbackId: created.id, email: created.email },
        'Failed to email feedback submission notice',
      );
    }

    return toPublicFeedback(created);
  }
}
