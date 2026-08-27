import { apiClient } from '@/shared/api/client';
import type { SuccessEnvelope } from '@/shared/types/api';

/** CLIENT_TESTING_MODE — remove this file when deleting the feature. */
export interface ClientTestingSettings {
  enabled: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

export const clientTestingApi = {
  async get(): Promise<ClientTestingSettings> {
    const { data } = await apiClient.get<SuccessEnvelope<ClientTestingSettings>>(
      '/client-testing',
    );
    return data.data;
  },

  async update(payload: { enabled: boolean }): Promise<ClientTestingSettings> {
    const { data } = await apiClient.patch<SuccessEnvelope<ClientTestingSettings>>(
      '/client-testing',
      payload,
    );
    return data.data;
  },
};
