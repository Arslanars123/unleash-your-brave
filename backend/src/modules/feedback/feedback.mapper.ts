import type { FeedbackSubmission, PublicFeedbackSubmission } from './feedback.types.js';

export function toPublicFeedback(item: FeedbackSubmission): PublicFeedbackSubmission {
  return {
    id: item.id,
    name: item.name,
    email: item.email,
    feedback: item.feedback,
    createdAt: item.createdAt.toISOString(),
  };
}
