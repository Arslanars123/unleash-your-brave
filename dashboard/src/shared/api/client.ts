import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ErrorEnvelope, SuccessEnvelope, TokenPair } from '@/shared/types/api';
import { tokenStorage } from '@/shared/lib/token-storage';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) return null;

  try {
    const { data } = await axios.post<SuccessEnvelope<TokenPair>>(`${baseURL}/auth/refresh`, {
      refreshToken,
    });
    tokenStorage.setTokens(data.data.accessToken, data.data.refreshToken);
    return data.data.accessToken;
  } catch {
    tokenStorage.clear();
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorEnvelope>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const nextToken = await refreshPromise;
      if (nextToken) {
        original.headers.Authorization = `Bearer ${nextToken}`;
        return apiClient(original);
      }
      window.location.assign('/login');
    }

    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError<ErrorEnvelope>(error)) {
    return error.response?.data?.error?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
