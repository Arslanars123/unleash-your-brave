import { apiClient } from '@/shared/api/client';
import type { AuthResult, PublicUser, SuccessEnvelope, TokenPair } from '@/shared/types/api';

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResult> {
    const { data } = await apiClient.post<SuccessEnvelope<AuthResult>>('/auth/login', payload);
    return data.data;
  },

  async me(): Promise<PublicUser> {
    const { data } = await apiClient.get<SuccessEnvelope<PublicUser>>('/auth/me');
    return data.data;
  },

  async refresh(refreshToken: string): Promise<TokenPair> {
    const { data } = await apiClient.post<SuccessEnvelope<TokenPair>>('/auth/refresh', {
      refreshToken,
    });
    return data.data;
  },
};
