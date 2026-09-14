import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ErrorEnvelope, SuccessEnvelope, TokenPair } from '@/shared/types/api';
import {
  isPublicAuthPath,
  portalFromPath,
  tokenStorage,
  type AuthPortal,
} from '@/shared/lib/token-storage';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const portal = portalFromPath();
  const token = tokenStorage.getAccess(portal);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(portal: AuthPortal): Promise<string | null> {
  const refreshToken = tokenStorage.getRefresh(portal);
  if (!refreshToken) return null;

  try {
    const { data } = await axios.post<SuccessEnvelope<TokenPair>>(`${baseURL}/auth/refresh`, {
      refreshToken,
    });
    tokenStorage.setTokens(data.data.accessToken, data.data.refreshToken, portal);
    return data.data.accessToken;
  } catch {
    tokenStorage.clear(portal);
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorEnvelope>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const portal = portalFromPath();

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshPromise ??= refreshAccessToken(portal).finally(() => {
        refreshPromise = null;
      });
      const nextToken = await refreshPromise;
      if (nextToken) {
        original.headers.Authorization = `Bearer ${nextToken}`;
        return apiClient(original);
      }
      // Never kick people off public pages (e.g. /feedback) into login.
      if (!isPublicAuthPath(window.location.pathname)) {
        window.location.assign(portal === 'team' ? '/team/login' : '/login');
      }
    }

    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError<ErrorEnvelope>(error)) {
    const apiError = error.response?.data?.error;
    if (Array.isArray(apiError?.details)) {
      const lines = apiError.details
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
      if (lines.length > 0) {
        const summary = lines.slice(0, 8).join(' · ');
        return lines.length > 8 ? `${summary} · (+${lines.length - 8} more)` : summary;
      }
    }
    if (apiError?.details && typeof apiError.details === 'object') {
      const details = apiError.details as {
        fieldErrors?: Record<string, string[] | undefined>;
        formErrors?: string[];
      };
      const fieldMessages = Object.entries(details.fieldErrors ?? {})
        .flatMap(([field, messages]) =>
          (messages ?? []).map((message) => `${field}: ${message}`),
        );
      const formMessages = details.formErrors ?? [];
      const combined = [...fieldMessages, ...formMessages].filter(Boolean);
      if (combined.length > 0) return combined.join(' · ');
    }
    return apiError?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
