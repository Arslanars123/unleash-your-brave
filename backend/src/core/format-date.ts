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

/** e.g. `Sep 10, 2026 – Sep 12, 2026` (single day omits the range). */
export function formatEditionRange(
  start: Date | string,
  end: Date | string,
): string {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  const startLabel = formatUsDate(startDate, { utc: true });
  const endLabel = formatUsDate(endDate, { utc: true });
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
}
