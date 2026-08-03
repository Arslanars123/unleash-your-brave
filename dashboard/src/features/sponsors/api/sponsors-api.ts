import { apiClient } from '@/shared/api/client';
import type {
  PaginationMeta,
  PublicSponsor,
  SponsorPayload,
  SuccessEnvelope,
} from '@/shared/types/api';

export interface ListSponsorsParams {
  page?: number;
  perPage?: number;
  search?: string;
  eventId?: string;
}

export interface ListSponsorsResult {
  items: PublicSponsor[];
  meta: PaginationMeta;
}

export const sponsorsApi = {
  async list(params: ListSponsorsParams = {}): Promise<ListSponsorsResult> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicSponsor[]>>('/sponsors', {
      params,
    });
    return {
      items: data.data,
      meta: data.meta ?? { page: 1, perPage: 20, total: data.data.length, totalPages: 1 },
    };
  },

  async getById(id: string): Promise<PublicSponsor> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicSponsor>>(`/sponsors/${id}`);
    return data.data;
  },

  async getMe(): Promise<PublicSponsor> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicSponsor>>('/sponsors/me');
    return data.data;
  },

  async create(payload: SponsorPayload): Promise<PublicSponsor> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicSponsor>>('/sponsors', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<SponsorPayload>): Promise<PublicSponsor> {
    const { data } = await apiClient.patch<SuccessEnvelope<PublicSponsor>>(
      `/sponsors/${id}`,
      payload,
    );
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/sponsors/${id}`);
  },
};
