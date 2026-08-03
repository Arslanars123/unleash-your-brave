import { BadRequestError, ForbiddenError, NotFoundError } from '../../../core/errors/app-error.js';
import type { UserRepository } from '../../users/user.repository.js';
import type { SessionRepository } from '../session.repository.js';
import {
  buildFeedbackSummary,
  toPublicSessionFeedback,
} from './session-feedback.mapper.js';
import type { PaginatedResult, SessionFeedbackRepository } from './session-feedback.repository.js';
import type {
  ListSessionFeedbackQuery,
  PublicSessionFeedback,
  SessionFeedbackSummary,
  UpdateSessionFeedbackInput,
  UpsertSessionFeedbackInput,
} from './session-feedback.types.js';

export class SessionFeedbackService {
  constructor(
    private readonly feedback: SessionFeedbackRepository,
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository,
  ) {}

  async getSummary(sessionId: string): Promise<SessionFeedbackSummary> {
    await this.requireSession(sessionId);
    const items = await this.feedback.listAllBySession(sessionId);
    return buildFeedbackSummary(sessionId, items);
  }

  async getMine(sessionId: string, userId: string): Promise<PublicSessionFeedback> {
    await this.requireSession(sessionId);
    const existing = await this.feedback.findBySessionAndUser(sessionId, userId);
    if (!existing) throw new NotFoundError('Feedback');
    return this.toPublic(existing);
  }

  async list(
    sessionId: string,
    query: ListSessionFeedbackQuery,
  ): Promise<PaginatedResult<PublicSessionFeedback>> {
    await this.requireSession(sessionId);
    const { items, total } = await this.feedback.listBySession(sessionId, query);
    const mapped = await Promise.all(items.map((item) => this.toPublic(item)));
    return { items: mapped, total };
  }

  async assertSpeakerOwnsSession(
    sessionId: string,
    speakerId: string | null | undefined,
  ): Promise<void> {
    const session = await this.requireSession(sessionId);
    if (!speakerId || session.speakerId !== speakerId) {
      throw new ForbiddenError('You can only view reviews for your own sessions');
    }
  }

  async upsert(
    sessionId: string,
    userId: string,
    input: UpsertSessionFeedbackInput,
  ): Promise<PublicSessionFeedback> {
    const session = await this.requireSession(sessionId);
    if (!session.feedbackEnabled) {
      throw new ForbiddenError('Feedback is disabled for this session');
    }

    const rating = input.rating;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestError('Rating must be an integer from 1 to 5');
    }

    const comment = input.comment?.trim() ?? '';
    const existing = await this.feedback.findBySessionAndUser(sessionId, userId);

    if (existing) {
      const updated = await this.feedback.update(existing.id, { rating, comment });
      if (!updated) throw new NotFoundError('Feedback');
      return this.toPublic(updated);
    }

    const created = await this.feedback.create({
      sessionId,
      userId,
      rating,
      comment,
    });
    return this.toPublic(created);
  }

  async deleteMine(sessionId: string, userId: string): Promise<void> {
    await this.requireSession(sessionId);
    const existing = await this.feedback.findBySessionAndUser(sessionId, userId);
    if (!existing) throw new NotFoundError('Feedback');
    await this.feedback.delete(existing.id);
  }

  /** Admin moderation: update any review on a session. */
  async updateById(
    sessionId: string,
    feedbackId: string,
    input: UpdateSessionFeedbackInput,
  ): Promise<PublicSessionFeedback> {
    await this.requireSession(sessionId);
    const existing = await this.requireFeedbackOnSession(sessionId, feedbackId);

    const rating = input.rating ?? existing.rating;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestError('Rating must be an integer from 1 to 5');
    }

    const updated = await this.feedback.update(feedbackId, {
      rating,
      ...(input.comment !== undefined ? { comment: input.comment.trim() } : {}),
    });
    if (!updated) throw new NotFoundError('Feedback');
    return this.toPublic(updated);
  }

  /** Admin moderation: delete any review on a session. */
  async deleteById(sessionId: string, feedbackId: string): Promise<void> {
    await this.requireSession(sessionId);
    await this.requireFeedbackOnSession(sessionId, feedbackId);
    await this.feedback.delete(feedbackId);
  }

  async deleteBySession(sessionId: string): Promise<void> {
    await this.feedback.deleteBySession(sessionId);
  }

  private async requireFeedbackOnSession(sessionId: string, feedbackId: string) {
    const existing = await this.feedback.findById(feedbackId);
    if (!existing || existing.sessionId !== sessionId) {
      throw new NotFoundError('Feedback');
    }
    return existing;
  }

  private async requireSession(sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundError('Session');
    return session;
  }

  private async toPublic(
    feedback: Awaited<ReturnType<SessionFeedbackRepository['findById']>>,
  ): Promise<PublicSessionFeedback> {
    if (!feedback) throw new NotFoundError('Feedback');
    const user = await this.users.findById(feedback.userId);
    return toPublicSessionFeedback(
      feedback,
      user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
          }
        : null,
    );
  }
}
