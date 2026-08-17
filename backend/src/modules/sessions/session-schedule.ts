import type { Session, SessionKind } from './session.types.js';

/** True when both wall-clock bounds are set (`HH:mm`, 24h). */
export function hasTimeWindow(startTime: string, endTime: string): boolean {
  return startTime.trim() !== '' && endTime.trim() !== '';
}

/** Half-open overlap test for same-day `HH:mm` intervals. */
export function timeRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA < endB && startB < endA;
}

function kindLabel(kind: SessionKind): string {
  return kind === 'event' ? 'extra activity' : 'session';
}

function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime}–${endTime}`;
}

/**
 * Sessions and extra activities must not share a time slot on the same event day.
 * Only items with both start and end times participate in conflict detection.
 */
export function findScheduleConflict(
  candidate: {
    eventDayNumber: number;
    startTime: string;
    endTime: string;
    kind: SessionKind;
  },
  others: Session[],
  excludeId?: string,
): Session | null {
  if (!hasTimeWindow(candidate.startTime, candidate.endTime)) {
    return null;
  }

  for (const other of others) {
    if (excludeId && other.id === excludeId) continue;
    if (other.eventDayNumber !== candidate.eventDayNumber) continue;
    if (!hasTimeWindow(other.startTime, other.endTime)) continue;

    const otherKind = other.kind ?? 'session';
    if (otherKind === candidate.kind) continue;

    if (
      timeRangesOverlap(
        candidate.startTime,
        candidate.endTime,
        other.startTime,
        other.endTime,
      )
    ) {
      return other;
    }
  }

  return null;
}

export function scheduleConflictMessage(conflict: Session): string {
  const label = kindLabel(conflict.kind ?? 'session');
  const range = formatTimeRange(conflict.startTime, conflict.endTime);
  return `This time overlaps with ${label} “${conflict.name}” (${range}) on the same day`;
}
