import { apiClient } from '@/shared/api/client';
import type {
  MembershipPayload,
  PaginationMeta,
  PublicMembership,
  SuccessEnvelope,
} from '@/shared/types/api';

export interface ListMembershipsParams {
  page?: number;
  perPage?: number;
  search?: string;
  eventId?: string;
}

export interface ListMembershipsResult {
  items: PublicMembership[];
  meta: PaginationMeta;
}

export const membershipsApi = {
  async list(params: ListMembershipsParams = {}): Promise<ListMembershipsResult> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicMembership[]>>('/memberships', {
      params,
    });
    return {
      items: data.data,
      meta: data.meta ?? { page: 1, perPage: 20, total: data.data.length, totalPages: 1 },
    };
  },

  async getById(id: string): Promise<PublicMembership> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicMembership>>(`/memberships/${id}`);
    return data.data;
  },

  async create(payload: MembershipPayload): Promise<PublicMembership> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicMembership>>(
      '/memberships',
      payload,
    );
    return data.data;
  },

  async update(id: string, payload: Partial<MembershipPayload>): Promise<PublicMembership> {
    const { data } = await apiClient.patch<SuccessEnvelope<PublicMembership>>(
      `/memberships/${id}`,
      payload,
    );
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/memberships/${id}`);
  },
};
