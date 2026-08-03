import { apiClient } from '@/shared/api/client';
import type {
  PaginationMeta,
  PublicSession,
  PublicSessionFeedback,
  SessionFeedbackSummaryDetail,
  SessionPayload,
  SuccessEnvelope,
  UpsertSessionFeedbackPayload,
} from '@/shared/types/api';

export interface ListSessionsParams {
  page?: number;
  perPage?: number;
  search?: string;
  speakerId?: string;
  eventDayNumber?: number;
  eventId?: string;
}

export interface ListSessionsResult {
  items: PublicSession[];
  meta: PaginationMeta;
}

export interface ListSessionFeedbackResult {
  items: PublicSessionFeedback[];
  meta: PaginationMeta;
}

export const sessionsApi = {
  async list(params: ListSessionsParams = {}): Promise<ListSessionsResult> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicSession[]>>('/sessions', {
      params,
    });
    return {
      items: data.data,
      meta: data.meta ?? { page: 1, perPage: 20, total: data.data.length, totalPages: 1 },
    };
  },

  async getById(id: string): Promise<PublicSession> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicSession>>(`/sessions/${id}`);
    return data.data;
  },

  async create(payload: SessionPayload): Promise<PublicSession> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicSession>>('/sessions', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<SessionPayload>): Promise<PublicSession> {
    const { data } = await apiClient.patch<SuccessEnvelope<PublicSession>>(
      `/sessions/${id}`,
      payload,
    );
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/sessions/${id}`);
  },

  async getFeedbackSummary(sessionId: string): Promise<SessionFeedbackSummaryDetail> {
    const { data } = await apiClient.get<SuccessEnvelope<SessionFeedbackSummaryDetail>>(
      `/sessions/${sessionId}/feedback/summary`,
    );
    return data.data;
  },

  async listFeedback(
    sessionId: string,
    params: { page?: number; perPage?: number } = {},
  ): Promise<ListSessionFeedbackResult> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicSessionFeedback[]>>(
      `/sessions/${sessionId}/feedback`,
      { params },
    );
    return {
      items: data.data,
      meta: data.meta ?? { page: 1, perPage: 20, total: data.data.length, totalPages: 1 },
    };
  },

  async upsertFeedback(
    sessionId: string,
    payload: UpsertSessionFeedbackPayload,
  ): Promise<PublicSessionFeedback> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicSessionFeedback>>(
      `/sessions/${sessionId}/feedback`,
      payload,
    );
    return data.data;
  },

  async updateFeedback(
    sessionId: string,
    feedbackId: string,
    payload: UpsertSessionFeedbackPayload,
  ): Promise<PublicSessionFeedback> {
    const { data } = await apiClient.patch<SuccessEnvelope<PublicSessionFeedback>>(
      `/sessions/${sessionId}/feedback/${feedbackId}`,
      payload,
    );
    return data.data;
  },

  async removeFeedback(sessionId: string, feedbackId: string): Promise<void> {
    await apiClient.delete(`/sessions/${sessionId}/feedback/${feedbackId}`);
  },
};
