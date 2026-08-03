import { apiClient } from '@/shared/api/client';
import type {
  CreateUserPayload,
  PaginationMeta,
  PublicUser,
  SuccessEnvelope,
  UpdateUserPayload,
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

  async getById(id: string): Promise<PublicUser> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicUser>>(`/users/${id}`);
    return data.data;
  },

  async stats(): Promise<UserStats> {
    const { data } = await apiClient.get<SuccessEnvelope<UserStats>>('/users/stats');
    return data.data;
  },

  async create(payload: CreateUserPayload): Promise<PublicUser> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicUser>>('/users', payload);
    return data.data;
  },

  async update(id: string, payload: UpdateUserPayload): Promise<PublicUser> {
    const { data } = await apiClient.patch<SuccessEnvelope<PublicUser>>(`/users/${id}`, payload);
    return data.data;
  },

  async updateStatus(id: string, status: UserStatus): Promise<PublicUser> {
    return this.update(id, { status });
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  },
};
