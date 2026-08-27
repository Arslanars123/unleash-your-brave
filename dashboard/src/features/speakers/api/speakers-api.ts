import { apiClient } from '@/shared/api/client';
import type {
  PaginationMeta,
  PublicSpeaker,
  SpeakerLinkedEvent,
  SpeakerPayload,
  SuccessEnvelope,
} from '@/shared/types/api';

export interface ListSpeakersParams {
  page?: number;
  perPage?: number;
  search?: string;
  eventId?: string;
}

export interface ListSpeakersResult {
  items: PublicSpeaker[];
  meta: PaginationMeta;
}

export const speakersApi = {
  async list(params: ListSpeakersParams = {}): Promise<ListSpeakersResult> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicSpeaker[]>>('/speakers', {
      params,
    });
    return {
      items: data.data,
      meta: data.meta ?? { page: 1, perPage: 20, total: data.data.length, totalPages: 1 },
    };
  },

  async getById(id: string): Promise<PublicSpeaker> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicSpeaker>>(`/speakers/${id}`);
    return data.data;
  },

  async getMe(): Promise<PublicSpeaker> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicSpeaker>>('/speakers/me');
    return data.data;
  },

  async listMyEvents(): Promise<SpeakerLinkedEvent[]> {
    const { data } = await apiClient.get<SuccessEnvelope<SpeakerLinkedEvent[]>>(
      '/speakers/me/events',
    );
    return data.data;
  },

  async create(payload: SpeakerPayload): Promise<PublicSpeaker> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicSpeaker>>('/speakers', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<SpeakerPayload>): Promise<PublicSpeaker> {
    const { data } = await apiClient.patch<SuccessEnvelope<PublicSpeaker>>(
      `/speakers/${id}`,
      payload,
    );
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/speakers/${id}`);
  },
};
