import { apiClient } from '@/shared/api/client';
import type {
  PaginationMeta,
  PublicFeedbackSubmission,
  SuccessEnvelope,
} from '@/shared/types/api';

export interface ListFeedbackParams {
  page?: number;
  perPage?: number;
  search?: string;
}

export interface ListFeedbackResult {
  items: PublicFeedbackSubmission[];
  meta: PaginationMeta;
}

export interface SubmitFeedbackPayload {
  name: string;
  email: string;
  feedback: string;
}

export const feedbackApi = {
  async list(params: ListFeedbackParams = {}): Promise<ListFeedbackResult> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicFeedbackSubmission[]>>(
      '/feedback',
      { params },
    );
    return {
      items: data.data,
      meta: data.meta ?? { page: 1, perPage: 20, total: data.data.length, totalPages: 1 },
    };
  },

  async submit(payload: SubmitFeedbackPayload): Promise<PublicFeedbackSubmission> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicFeedbackSubmission>>(
      '/feedback',
      payload,
    );
    return data.data;
  },
};
