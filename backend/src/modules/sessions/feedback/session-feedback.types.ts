export interface SessionFeedback {
  id: string;
  sessionId: string;
  userId: string;
  /** Integer rating from 1 (poor) to 5 (excellent). */
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicSessionFeedbackUser {
  id: string;
  name: string;
  email: string;
}

export interface PublicSessionFeedback {
  id: string;
  sessionId: string;
  userId: string;
  user: PublicSessionFeedbackUser | null;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionFeedbackSummary {
  sessionId: string;
  averageRating: number;
  ratingsCount: number;
  ratingDistribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface UpsertSessionFeedbackInput {
  rating: number;
  comment?: string;
}

export interface UpdateSessionFeedbackInput {
  rating?: number;
  comment?: string;
}

export interface ListSessionFeedbackQuery {
  page: number;
  perPage: number;
}
