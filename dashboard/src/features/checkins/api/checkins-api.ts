import { apiClient } from '@/shared/api/client';
import type {
  CheckInScanResult,
  CheckInStats,
  PaginationMeta,
  PublicCheckInRow,
  SuccessEnvelope,
} from '@/shared/types/api';

export interface ListCheckInsParams {
  eventId: string;
  page?: number;
  perPage?: number;
  search?: string;
  status?: 'checked_in' | 'not_checked_in' | 'all';
}

export interface ListCheckInsResult {
  items: PublicCheckInRow[];
  meta: PaginationMeta;
  stats: CheckInStats;
}

export const checkInsApi = {
  async list(params: ListCheckInsParams): Promise<ListCheckInsResult> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicCheckInRow[]>>('/checkins', {
      params,
    });
    const stats = data.meta?.stats ?? {
      eventId: params.eventId,
      checkedInCount: 0,
      attendeeCount: data.meta?.total ?? data.data.length,
    };
    return {
      items: data.data,
      meta: data.meta ?? { page: 1, perPage: 50, total: data.data.length, totalPages: 1 },
      stats,
    };
  },

  async stats(eventId: string): Promise<CheckInStats> {
    const { data } = await apiClient.get<SuccessEnvelope<CheckInStats>>('/checkins/stats', {
      params: { eventId },
    });
    return data.data;
  },

  async scan(payload: {
    token?: string;
    eventId?: string;
    userId?: string;
    expectedEventId?: string;
    source?: 'qr' | 'manual';
    poll?: boolean;
  }): Promise<CheckInScanResult> {
    const { data } = await apiClient.post<SuccessEnvelope<CheckInScanResult>>(
      '/checkins/scan',
      payload,
    );
    return data.data;
  },

  async completeWithForm(payload: {
    token?: string;
    eventId?: string;
    userId?: string;
    expectedEventId?: string;
    answers: Record<string, string | boolean>;
    signatureDataUrl?: string;
    signedName: string;
  }): Promise<CheckInScanResult> {
    const { data } = await apiClient.post<SuccessEnvelope<CheckInScanResult>>(
      '/checkins/complete-with-form',
      payload,
    );
    return data.data;
  },
};
