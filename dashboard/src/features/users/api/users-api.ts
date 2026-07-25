import { apiClient } from '@/shared/api/client';
import type {
  PaginationMeta,
  PublicUser,
  SuccessEnvelope,
  UserRole,
  UserStats,
  UserStatus,
} from '@/shared/types/api';

export interface ListUsersParams {
  page?: number;
  perPage?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface ListUsersResult {
  items: PublicUser[];
  meta: PaginationMeta;
}

export const usersApi = {
  async list(params: ListUsersParams = {}): Promise<ListUsersResult> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicUser[]>>('/users', { params });
    return {
      items: data.data,
      meta: data.meta ?? { page: 1, perPage: 20, total: data.data.length, totalPages: 1 },
    };
  },

  async stats(): Promise<UserStats> {
    const { data } = await apiClient.get<SuccessEnvelope<UserStats>>('/users/stats');
    return data.data;
  },

  async updateStatus(id: string, status: UserStatus): Promise<PublicUser> {
    const { data } = await apiClient.patch<SuccessEnvelope<PublicUser>>(`/users/${id}`, { status });
    return data.data;
  },
};
