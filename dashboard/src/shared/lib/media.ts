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
  const normalized = normalizeWebsiteUrl(value);
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith('blob:')) return normalized;
  if (normalized.startsWith('/')) {
    if (mediaBase) {
      const key = normalized.startsWith('/uploads/')
        ? normalized.slice('/uploads'.length)
        : normalized;
      return `${mediaBase}${key}`;
    }
    return `${apiOrigin}${normalized}`;
  }
  return normalized;
}

/**
 * Accept common “paste from browser” forms: `www.example.com` / `example.com/path`
 * → `https://…`. Leaves uploads and already-absolute URLs alone.
 */
export function normalizeWebsiteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('blob:')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;

  // Bare domain or www.domain… (optional path/query/hash)
  if (
    /^(www\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+([/:?#].*)?$/i.test(
      trimmed,
    )
  ) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function isValidMediaRef(value: string): boolean {
  if (!value.trim()) return true;
  const normalized = normalizeWebsiteUrl(value);
  if (/^https?:\/\//i.test(normalized)) return true;
  if (/^\/uploads\/[A-Za-z0-9._/-]+$/.test(normalized)) return true;
  return false;
}
