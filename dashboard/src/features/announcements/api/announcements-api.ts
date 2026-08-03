import { apiClient } from '@/shared/api/client';
import type {
  AnnouncementPayload,
  PaginationMeta,
  PublicAnnouncement,
  SuccessEnvelope,
} from '@/shared/types/api';

export interface ListAnnouncementsParams {
  page?: number;
  perPage?: number;
  search?: string;
}

export interface ListAnnouncementsResult {
  items: PublicAnnouncement[];
  meta: PaginationMeta;
}

export const announcementsApi = {
  async list(params: ListAnnouncementsParams = {}): Promise<ListAnnouncementsResult> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicAnnouncement[]>>(
      '/announcements',
      { params },
    );
    return {
      items: data.data,
      meta: data.meta ?? { page: 1, perPage: 20, total: data.data.length, totalPages: 1 },
    };
  },

  async create(payload: AnnouncementPayload): Promise<PublicAnnouncement> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicAnnouncement>>(
      '/announcements',
      payload,
    );
    return data.data;
  },

  async update(id: string, payload: Partial<AnnouncementPayload>): Promise<PublicAnnouncement> {
    const { data } = await apiClient.patch<SuccessEnvelope<PublicAnnouncement>>(
      `/announcements/${id}`,
      payload,
    );
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/announcements/${id}`);
  },
};
