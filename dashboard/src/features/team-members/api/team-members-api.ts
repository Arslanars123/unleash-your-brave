import { apiClient } from '@/shared/api/client';
import type { PaginationMeta, SuccessEnvelope, UserStatus } from '@/shared/types/api';

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ListTeamMembersResult {
  items: TeamMember[];
  meta: PaginationMeta;
}

export const teamMembersApi = {
  async list(params: {
    page?: number;
    perPage?: number;
    search?: string;
  } = {}): Promise<ListTeamMembersResult> {
    const { data } = await apiClient.get<SuccessEnvelope<TeamMember[]>>('/team-members', {
      params,
    });
    return {
      items: data.data,
      meta: data.meta ?? { page: 1, perPage: 20, total: data.data.length, totalPages: 1 },
    };
  },

  async create(payload: { name: string; email: string }): Promise<TeamMember> {
    const { data } = await apiClient.post<SuccessEnvelope<TeamMember>>('/team-members', payload);
    return data.data;
  },

  async update(
    id: string,
    payload: { name?: string; email?: string; status?: UserStatus },
  ): Promise<TeamMember> {
    const { data } = await apiClient.patch<SuccessEnvelope<TeamMember>>(
      `/team-members/${id}`,
      payload,
    );
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/team-members/${id}`);
  },

  async reinvite(id: string): Promise<TeamMember> {
    const { data } = await apiClient.post<SuccessEnvelope<TeamMember>>(
      `/team-members/${id}/reinvite`,
    );
    return data.data;
  },
};
