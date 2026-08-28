import type { PublicEvent } from '@/shared/types/api';

const US_DATE: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

const US_DATE_TIME: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

function parseDate(value: string | Date): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/** Calendar date in US style, e.g. `Sep 10, 2026`. */
export function formatUsDate(
  value: string | Date,
  options?: { utc?: boolean },
): string {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    ...US_DATE,
    ...(options?.utc ? { timeZone: 'UTC' } : {}),
  });
}

/** Date + time in US style, e.g. `Sep 10, 2026, 9:00 AM`. */
export function formatUsDateTime(value: string | Date): string {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', US_DATE_TIME);
}

/** Formats an HTML date input value (`YYYY-MM-DD`) as a UTC calendar date. */
export function formatUsDateInputValue(value: string): string {
  if (!value.trim()) return '';
  return formatUsDate(`${value}T00:00:00.000Z`, { utc: true });
}

export function formatEditionRange(
  event: Pick<PublicEvent, 'startDate' | 'endDate'>,
): string {
  const start = formatUsDate(event.startDate, { utc: true });
  const end = formatUsDate(event.endDate, { utc: true });
  return start === end ? start : `${start} – ${end}`;
}

/** Formats a 24h `HH:mm` string as `9:00 AM`. Returns '' for empty/invalid. */
export function formatTimeHm(value: string | null | undefined): string {
  if (!value) return '';
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return value.trim();

  let hours = Number(match[1]);
  const minutes = match[2]!;
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${period}`;
}

/** e.g. `9:00 AM – 10:00 AM`, or '' if times are missing. */
export function formatSessionTimeRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): string {
  const start = formatTimeHm(startTime);
  const end = formatTimeHm(endTime);
  if (!start && !end) return '';
  if (start && end) return `${start} – ${end}`;
  return start || end;
}
