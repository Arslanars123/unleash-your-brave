import axios from 'axios';
import { apiClient } from '@/shared/api/client';
import type {
  PaginationMeta,
  PublicFeedbackSubmission,
  SuccessEnvelope,
} from '@/shared/types/api';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

/** No auth headers / no login redirect — public form submissions. */
const publicFeedbackClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

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
    const { data } = await publicFeedbackClient.post<SuccessEnvelope<PublicFeedbackSubmission>>(
      '/feedback',
      payload,
    );
    return data.data;
  },
};
