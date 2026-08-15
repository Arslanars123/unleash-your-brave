import { apiClient } from '@/shared/api/client';
import type { AuthResult, PublicUser, SuccessEnvelope, TokenPair } from '@/shared/types/api';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword?: string;
  newPassword: string;
}

export interface ForgotPasswordResult {
  message: string;
}

export interface VerifyResetOtpPayload {
  email: string;
  otp: string;
}

export interface VerifyResetOtpResult {
  resetToken: string;
}

export interface ResetPasswordPayload {
  resetToken: string;
  newPassword: string;
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

  async changePassword(payload: ChangePasswordPayload): Promise<PublicUser> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicUser>>(
      '/auth/change-password',
      payload,
    );
    return data.data;
  },

  async forgotPassword(email: string): Promise<ForgotPasswordResult> {
    const { data } = await apiClient.post<SuccessEnvelope<ForgotPasswordResult>>(
      '/auth/forgot-password',
      { email },
    );
    return data.data;
  },

  async verifyResetOtp(payload: VerifyResetOtpPayload): Promise<VerifyResetOtpResult> {
    const { data } = await apiClient.post<SuccessEnvelope<VerifyResetOtpResult>>(
      '/auth/verify-reset-otp',
      payload,
    );
    return data.data;
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<PublicUser> {
    const { data } = await apiClient.post<SuccessEnvelope<PublicUser>>(
      '/auth/reset-password',
      payload,
    );
    return data.data;
  },
};
