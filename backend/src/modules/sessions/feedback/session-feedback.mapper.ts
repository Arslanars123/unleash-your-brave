import type {
  PublicSessionFeedback,
  PublicSessionFeedbackUser,
  SessionFeedback,
  SessionFeedbackSummary,
} from './session-feedback.types.js';

export function toPublicSessionFeedback(
  feedback: SessionFeedback,
  user: PublicSessionFeedbackUser | null,
): PublicSessionFeedback {
  return {
    id: feedback.id,
    sessionId: feedback.sessionId,
    userId: feedback.userId,
    user,
    rating: feedback.rating,
    comment: feedback.comment,
    createdAt: feedback.createdAt.toISOString(),
    updatedAt: feedback.updatedAt.toISOString(),
  };
}

export function buildFeedbackSummary(
  sessionId: string,
  items: SessionFeedback[],
): SessionFeedbackSummary {
  const ratingDistribution: SessionFeedbackSummary['ratingDistribution'] = {
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
  };

  let sum = 0;
  for (const item of items) {
    const key = String(item.rating) as keyof typeof ratingDistribution;
    if (key in ratingDistribution) {
      ratingDistribution[key] += 1;
    }
    sum += item.rating;
  }

  const ratingsCount = items.length;
  const averageRating =
    ratingsCount === 0 ? 0 : Math.round((sum / ratingsCount) * 10) / 10;

  return {
    sessionId,
    averageRating,
    ratingsCount,
    ratingDistribution,
  };
}
