import { apiClient } from '@/shared/api/client';
import type {
  AnnouncementKind,
  AnnouncementPayload,
  AnnouncementStatus,
  CountdownSettings,
  PaginationMeta,
  PublicAnnouncement,
  SuccessEnvelope,
  UpdateCountdownSettingsPayload,
} from '@/shared/types/api';

export interface ListAnnouncementsParams {
  page?: number;
  perPage?: number;
  search?: string;
  status?: AnnouncementStatus;
  kind?: AnnouncementKind;
}

export interface ListAnnouncementsResult {
  items: PublicAnnouncement[];
  meta: PaginationMeta;
}

export interface ListFeedParams {
  page?: number;
  perPage?: number;
  filter?: 'all' | 'unread' | 'read';
}

export interface ListFeedResult {
  items: PublicAnnouncement[];
  meta: PaginationMeta & { unreadCount?: number };
  unreadCount: number;
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

  async feed(params: ListFeedParams = {}): Promise<ListFeedResult> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicAnnouncement[]>>(
      '/announcements/feed',
      { params },
    );
    const unreadCount =
      typeof data.meta?.unreadCount === 'number'
        ? data.meta.unreadCount
        : data.data.filter((item) => !item.isRead).length;
    return {
      items: data.data,
      meta: data.meta ?? { page: 1, perPage: 50, total: data.data.length, totalPages: 1 },
      unreadCount,
    };
  },

  async unreadCount(): Promise<number> {
    const { data } = await apiClient.get<SuccessEnvelope<{ count: number }>>(
      '/announcements/unread-count',
    );
    return data.data.count ?? 0;
  },

  async markRead(id: string): Promise<PublicAnnouncement> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicAnnouncement>>(
      `/announcements/${id}/read`,
    );
    return data.data;
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

  async getCountdownSettings(): Promise<CountdownSettings> {
    const { data } = await apiClient.get<SuccessEnvelope<CountdownSettings>>(
      '/announcements/countdown-settings',
    );
    return data.data;
  },

  async updateCountdownSettings(
    payload: UpdateCountdownSettingsPayload,
  ): Promise<CountdownSettings> {
    const { data } = await apiClient.patch<SuccessEnvelope<CountdownSettings>>(
      '/announcements/countdown-settings',
      payload,
    );
    return data.data;
  },
};
