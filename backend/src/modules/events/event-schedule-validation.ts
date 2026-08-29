import { formatUsDate } from '../../core/format-date.js';
import { BadRequestError } from '../../core/errors/app-error.js';
import { startOfUtcDay, utcDayAfter } from './event.mapper.js';
import type { EventDay } from './event.types.js';

type EditionLike = {
  id: string;
  startDate: Date;
  endDate: Date;
  days: EventDay[];
};

export type EditionScheduleBounds = {
  /** YYYY-MM-DD — day before the earliest allowed start. */
  previousEnd: string | null;
  /** YYYY-MM-DD — day the next edition starts. */
  nextStart: string | null;
  /** YYYY-MM-DD — earliest allowed first day. */
  earliestStart: string | null;
  /** YYYY-MM-DD — latest allowed last day. */
  latestEnd: string | null;
};

function utcDayBefore(date: Date): Date {
  const day = startOfUtcDay(date);
  day.setUTCDate(day.getUTCDate() - 1);
  return day;
}

function isoDateKey(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function formatDay(date: Date): string {
  return formatUsDate(date, { utc: true });
}

export function getEditionScheduleBounds(
  eventId: string | null,
  days: EventDay[],
  allEvents: EditionLike[],
): EditionScheduleBounds {
  if (days.length === 0) {
    return {
      previousEnd: null,
      nextStart: null,
      earliestStart: null,
      latestEnd: null,
    };
  }

  const sortedDays = [...days].sort((a, b) => a.date.getTime() - b.date.getTime());
  const proposedStart = startOfUtcDay(sortedDays[0]!.date).getTime();
  const proposedEnd = startOfUtcDay(sortedDays[sortedDays.length - 1]!.date).getTime();
  const others = allEvents.filter((event) => event.id !== eventId);

  const previous =
    others
      .filter((event) => startOfUtcDay(event.endDate).getTime() < proposedStart)
      .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())[0] ?? null;

  const next =
    others
      .filter((event) => startOfUtcDay(event.startDate).getTime() > proposedEnd)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0] ?? null;

  return {
    previousEnd: previous ? isoDateKey(previous.endDate) : null,
    nextStart: next ? isoDateKey(next.startDate) : null,
    earliestStart: previous ? isoDateKey(utcDayAfter(previous.endDate)) : null,
    latestEnd: next ? isoDateKey(utcDayBefore(next.startDate)) : null,
  };
}

/**
 * Ensures edition dates do not overlap or touch another edition.
 * Editions must be separated by at least one calendar day.
 */
export function assertEditionScheduleAllowed(
  eventId: string | null,
  days: EventDay[],
  allEvents: EditionLike[],
): void {
  if (days.length === 0) return;

  const sortedDays = [...days].sort((a, b) => a.date.getTime() - b.date.getTime());
  const proposedStart = startOfUtcDay(sortedDays[0]!.date);
  const proposedEnd = startOfUtcDay(sortedDays[sortedDays.length - 1]!.date);
  const proposedKeys = new Set(sortedDays.map((day) => isoDateKey(day.date)));

  for (const other of allEvents) {
    if (other.id === eventId) continue;
    for (const otherDay of other.days) {
      const key = isoDateKey(otherDay.date);
      if (proposedKeys.has(key)) {
        throw new BadRequestError(
          `${key} is already used by another edition (${formatDay(other.startDate)} – ${formatDay(other.endDate)}). Choose different dates.`,
        );
      }
    }
  }

  const bounds = getEditionScheduleBounds(eventId, days, allEvents);

  if (bounds.previousEnd && proposedStart.getTime() <= startOfUtcDay(new Date(`${bounds.previousEnd}T00:00:00.000Z`)).getTime()) {
    throw new BadRequestError(
      `Edition must start after the previous one ends (${formatDay(new Date(`${bounds.previousEnd}T00:00:00.000Z`))}). Earliest allowed start is ${formatDay(new Date(`${bounds.earliestStart}T00:00:00.000Z`))}.`,
    );
  }

  if (bounds.nextStart && proposedEnd.getTime() >= startOfUtcDay(new Date(`${bounds.nextStart}T00:00:00.000Z`)).getTime()) {
    throw new BadRequestError(
      `Edition must end before the next one starts (${formatDay(new Date(`${bounds.nextStart}T00:00:00.000Z`))}). Latest allowed end is ${formatDay(new Date(`${bounds.latestEnd}T00:00:00.000Z`))}.`,
    );
  }
}
