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
