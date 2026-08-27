import { apiClient } from '@/shared/api/client';
import type { AppBranding, SuccessEnvelope, UpdateAppBrandingPayload } from '@/shared/types/api';

export const appBrandingApi = {
  async get(): Promise<AppBranding> {
    const { data } = await apiClient.get<SuccessEnvelope<AppBranding>>('/app-branding');
    return data.data;
  },

  async update(payload: UpdateAppBrandingPayload): Promise<AppBranding> {
    const { data } = await apiClient.patch<SuccessEnvelope<AppBranding>>(
      '/app-branding',
      payload,
    );
    return data.data;
  },
};
