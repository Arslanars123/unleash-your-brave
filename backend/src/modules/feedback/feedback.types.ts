export interface FeedbackSubmission {
  id: string;
  name: string;
  email: string;
  feedback: string;
  createdAt: Date;
}

export interface PublicFeedbackSubmission {
  id: string;
  name: string;
  email: string;
  feedback: string;
  createdAt: string;
}

export interface CreateFeedbackInput {
  name: string;
  email: string;
  feedback: string;
}

export interface ListFeedbackQuery {
  page: number;
  perPage: number;
  search?: string;
}
