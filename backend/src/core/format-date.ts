const US_DATE: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

/** Calendar date in US style, e.g. `Sep 10, 2026`. */
export function formatUsDate(date: Date, options?: { utc?: boolean }): string {
  return date.toLocaleDateString('en-US', {
    ...US_DATE,
    ...(options?.utc ? { timeZone: 'UTC' } : {}),
  });
}
