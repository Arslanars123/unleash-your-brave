/** Default gathering name when none is provided. */
export const CANONICAL_EVENT_NAME = 'Unleash Your Brave';

export function resolveEventName(name?: string | null): string {
  const trimmed = name?.trim() ?? '';
  if (trimmed.length >= 2) return trimmed.slice(0, 160);
  return CANONICAL_EVENT_NAME;
}
