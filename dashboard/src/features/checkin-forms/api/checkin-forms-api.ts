import { apiClient } from '@/shared/api/client';
import type {
  PublicCheckInForm,
  SuccessEnvelope,
  UpsertCheckInFormPayload,
} from '@/shared/types/api';

export const checkInFormsApi = {
  async getByEvent(eventId: string): Promise<PublicCheckInForm | null> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicCheckInForm | null>>(
      '/checkin-forms',
      { params: { eventId } },
    );
    return data.data;
  },

  async upsertByEvent(
    eventId: string,
    payload: UpsertCheckInFormPayload,
  ): Promise<PublicCheckInForm> {
    const { data } = await apiClient.put<SuccessEnvelope<PublicCheckInForm>>(
      `/checkin-forms/by-event/${eventId}`,
      payload,
    );
    return data.data;
  },

  async deleteByEvent(eventId: string): Promise<void> {
    await apiClient.delete(`/checkin-forms/by-event/${eventId}`);
  },
};
