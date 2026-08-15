const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

/** API origin without the `/api/v1` suffix — used for legacy local `/uploads`. */
export const apiOrigin = apiBase.replace(/\/api\/v1\/?$/, '');

/**
 * Optional public media origin (S3 / CDN). New uploads return absolute URLs;
 * this rewrites legacy `/uploads/...` paths to object storage keys.
 */
const mediaBase = (import.meta.env.VITE_MEDIA_BASE_URL as string | undefined)?.replace(
  /\/+$/,
  '',
);

/**
 * Resolves a stored media path (absolute URL or `/uploads/...`) into a browser-loadable URL.
 */
export function resolveMediaUrl(value: string | null | undefined): string {
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('blob:')) return value;
  if (value.startsWith('/')) {
    if (mediaBase) {
      const key = value.startsWith('/uploads/') ? value.slice('/uploads'.length) : value;
      return `${mediaBase}${key}`;
    }
    return `${apiOrigin}${value}`;
  }
  return value;
}

export function isValidMediaRef(value: string): boolean {
  if (!value.trim()) return true;
  if (/^https?:\/\//i.test(value.trim())) return true;
  if (/^\/uploads\/[A-Za-z0-9._/-]+$/.test(value.trim())) return true;
  return false;
}
