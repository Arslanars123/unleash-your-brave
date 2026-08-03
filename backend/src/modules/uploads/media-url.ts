/** Shared validation helpers for media URL fields. */
export function isValidMediaUrl(value: string): boolean {
  if (!value) return true;
  if (/^https?:\/\//i.test(value)) return true;
  // Local uploads served by this API, e.g. /uploads/events/abc.jpg
  if (/^\/uploads\/[A-Za-z0-9._/-]+$/.test(value)) return true;
  return false;
}
