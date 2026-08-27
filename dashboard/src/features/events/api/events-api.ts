import { apiClient } from '@/shared/api/client';
import type {
  EventAssociations,
  EventOverviewStats,
  EventPayload,
  EventWorkspace,
  PaginationMeta,
  PublicEvent,
  ScheduleEventPayload,
  SuccessEnvelope,
} from '@/shared/types/api';

export interface ListEventsParams {
  page?: number;
  perPage?: number;
  search?: string;
}

export interface ListEventsResult {
  items: PublicEvent[];
  meta: PaginationMeta;
}

export const eventsApi = {
  async list(params: ListEventsParams = {}): Promise<ListEventsResult> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicEvent[]>>('/events', { params });
    return {
      items: data.data,
      meta: data.meta ?? { page: 1, perPage: 20, total: data.data.length, totalPages: 1 },
    };
  },

  async getWorkspace(): Promise<EventWorkspace> {
    const { data } = await apiClient.get<SuccessEnvelope<EventWorkspace>>('/events/workspace');
    return data.data;
  },

  async getCurrent(): Promise<PublicEvent> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicEvent>>('/events/current');
    return data.data;
  },

  async getById(id: string): Promise<PublicEvent> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicEvent>>(`/events/${id}`);
    return data.data;
  },

  async getOverview(id: string): Promise<EventOverviewStats> {
    const { data } = await apiClient.get<SuccessEnvelope<EventOverviewStats>>(
      `/events/${id}/overview`,
    );
    return data.data;
  },

  async create(payload: EventPayload): Promise<PublicEvent> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicEvent>>('/events', payload);
    return data.data;
  },

  async schedule(payload: ScheduleEventPayload): Promise<PublicEvent> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicEvent>>(
      '/events/schedule',
      payload,
    );
    return data.data;
  },

  async update(id: string, payload: Partial<EventPayload>): Promise<PublicEvent> {
    const { data } = await apiClient.patch<SuccessEnvelope<PublicEvent>>(`/events/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/events/${id}`);
  },

  async getAssociations(eventId: string): Promise<EventAssociations> {
    const { data } = await apiClient.get<SuccessEnvelope<EventAssociations>>(
      `/events/${eventId}/associations`,
    );
    return data.data;
  },

  async setAssociations(
    eventId: string,
    payload: Partial<Omit<EventAssociations, 'eventId'>>,
  ): Promise<EventAssociations> {
    const { data } = await apiClient.put<SuccessEnvelope<EventAssociations>>(
      `/events/${eventId}/associations`,
      payload,
    );
    return data.data;
  },
};
