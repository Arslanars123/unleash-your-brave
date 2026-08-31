import { CANONICAL_EVENT_NAME } from '@/features/events/constants';
import { formatUsDate } from '@/shared/lib/datetime';
import { isValidMediaRef } from '@/shared/lib/media';
import type { EventPayload, PublicEvent, ScheduleEventPayload } from '@/shared/types/api';

export type ScheduleMode = 'consecutive' | 'custom';
export type EventFormMode = 'edit' | 'schedule';

export interface DayRow {
  key: string;
  date: string;
  label: string;
}

export interface EventFormValues {
  name: string;
  tagline: string;
  description: string;
  scheduleMode: ScheduleMode;
  consecutiveStart: string;
  dayCount: number;
  days: DayRow[];
  venueName: string;
  venueAddress: string;
  venueCity: string;
  latitude: number | null;
  longitude: number | null;
  coverImage: string;
  copyDetailsFromPrevious: boolean;
  paused: boolean;
  published: boolean;
  notifyAttendees: boolean;
  speakerIds: string[];
  sponsorIds: string[];
  membershipIds: string[];
}

export type FieldErrors = Partial<Record<string, string>>;

export type EditionScheduleBounds = {
  previousEnd: string | null;
  nextStart: string | null;
  earliestStart: string | null;
  latestEnd: string | null;
};

function isoDateKeyFromInput(dateValue: string): string {
  return dateValue.slice(0, 10);
}

export function getEditionScheduleBounds(
  editingEventId: string | null,
  dayDates: string[],
  otherEditions: PublicEvent[],
): EditionScheduleBounds {
  const sorted = [...dayDates].filter(Boolean).sort();
  if (sorted.length === 0) {
    return {
      previousEnd: null,
      nextStart: null,
      earliestStart: null,
      latestEnd: null,
    };
  }

  const proposedStart = sorted[0]!;
  const proposedEnd = sorted[sorted.length - 1]!;
  const others = otherEditions.filter((edition) => edition.id !== editingEventId);

  const previous =
    others
      .filter((edition) => toDateInput(edition.endDate) < proposedStart)
      .sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null;

  const next =
    others
      .filter((edition) => toDateInput(edition.startDate) > proposedEnd)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;

  return {
    previousEnd: previous ? toDateInput(previous.endDate) : null,
    nextStart: next ? toDateInput(next.startDate) : null,
    earliestStart: previous ? dayAfterIso(previous.endDate) : null,
    latestEnd: next ? addUtcDays(toDateInput(next.startDate), -1) : null,
  };
}

function validateEditionSchedule(
  dayDates: string[],
  options: {
    editingEventId?: string | null;
    otherEditions?: PublicEvent[];
  },
): string | null {
  const others = options.otherEditions ?? [];
  const editingEventId = options.editingEventId ?? null;
  const sorted = [...dayDates].filter(Boolean).sort();
  if (sorted.length === 0) return null;

  const proposedStart = sorted[0]!;
  const proposedEnd = sorted[sorted.length - 1]!;
  const proposedKeys = new Set(sorted.map(isoDateKeyFromInput));

  for (const other of others) {
    if (other.id === editingEventId) continue;
    for (const day of other.days ?? []) {
      const key = toDateInput(day.date);
      if (proposedKeys.has(key)) {
        return `${formatUtcDateLabel(`${key}T00:00:00.000Z`)} is already used by another edition (${formatUtcDateLabel(other.startDate)} – ${formatUtcDateLabel(other.endDate)}).`;
      }
    }
  }

  const bounds = getEditionScheduleBounds(editingEventId, sorted, others);

  if (bounds.previousEnd && proposedStart <= bounds.previousEnd) {
    return `Must start after the previous edition ends (${formatUtcDateLabel(`${bounds.previousEnd}T00:00:00.000Z`)}). Earliest: ${formatUtcDateLabel(`${bounds.earliestStart}T00:00:00.000Z`)}.`;
  }

  if (bounds.nextStart && proposedEnd >= bounds.nextStart) {
    return `Must end before the next edition starts (${formatUtcDateLabel(`${bounds.nextStart}T00:00:00.000Z`)}). Latest: ${formatUtcDateLabel(`${bounds.latestEnd}T00:00:00.000Z`)}.`;
  }

  return null;
}

/** Minimum selectable date for a custom day row (strictly after the previous row). */
export function customDayMinDate(
  index: number,
  days: DayRow[],
  earliestEditionStart?: string | null,
): string | undefined {
  if (index > 0) {
    const previousDate = days[index - 1]?.date;
    if (previousDate) return dayAfterIso(`${previousDate}T00:00:00.000Z`);
  }
  return earliestEditionStart ?? undefined;
}

export function validateEventMemberships(membershipIds: string[]): string | null {
  if (membershipIds.length === 0) {
    return 'Select at least one membership tier for this edition.';
  }
  return null;
}

export function newDayKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function toDateInput(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function dayAfterIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + 1);
  return toDateInput(date.toISOString());
}

export function formatUtcDateLabel(iso: string): string {
  return formatUsDate(iso, { utc: true });
}

export function addUtcDays(dateValue: string, offset: number): string {
  const [y, m, d] = dateValue.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + offset));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function buildConsecutiveDays(start: string, count: number): DayRow[] {
  if (!start || count < 1) return [];
  return Array.from({ length: count }, (_, index) => ({
    key: newDayKey(),
    date: addUtcDays(start, index),
    label: `Day ${index + 1}`,
  }));
}

function areConsecutive(dates: string[]): boolean {
  if (dates.length <= 1) return true;
  const sorted = [...dates].sort();
  for (let i = 1; i < sorted.length; i += 1) {
    if (addUtcDays(sorted[i - 1]!, 1) !== sorted[i]) return false;
  }
  return true;
}

export const emptyForm: EventFormValues = {
  name: CANONICAL_EVENT_NAME,
  tagline: '',
  description: '',
  scheduleMode: 'consecutive',
  consecutiveStart: '',
  dayCount: 3,
  days: buildConsecutiveDays('', 3),
  venueName: '',
  venueAddress: '',
  venueCity: '',
  latitude: null,
  longitude: null,
  coverImage: '',
  copyDetailsFromPrevious: false,
  paused: false,
  published: true,
  notifyAttendees: true,
  speakerIds: [],
  sponsorIds: [],
  membershipIds: [],
};

export function eventToForm(event: PublicEvent): EventFormValues {
  const days: DayRow[] =
    event.days?.length > 0
      ? [...event.days]
          .sort((a, b) => a.dayNumber - b.dayNumber)
          .map((day) => ({
            key: newDayKey(),
            date: toDateInput(day.date),
            label: day.label || `Day ${day.dayNumber}`,
          }))
      : buildConsecutiveDays(toDateInput(event.startDate), 1);

  const dates = days.map((day) => day.date).filter(Boolean);
  const consecutive = areConsecutive(dates);

  return {
    name: event.name?.trim() || CANONICAL_EVENT_NAME,
    tagline: event.tagline,
    description: event.description,
    scheduleMode: consecutive ? 'consecutive' : 'custom',
    consecutiveStart: dates[0] ?? '',
    dayCount: days.length || 1,
    days,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    venueCity: event.venueCity,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    coverImage: event.coverImage,
    copyDetailsFromPrevious: false,
    paused: Boolean(event.paused) || event.status === 'paused',
    published: event.published !== false,
    notifyAttendees: true,
    speakerIds: [],
    sponsorIds: [],
    membershipIds: [],
  };
}

export function scheduleBlankForm(previous: PublicEvent | null): EventFormValues {
  if (!previous) return { ...emptyForm, days: buildConsecutiveDays('', 3) };

  const earliestStart = dayAfterIso(previous.endDate);
  const dayCount = previous.dayCount || 3;

  return {
    ...emptyForm,
    name: previous.name?.trim() || CANONICAL_EVENT_NAME,
    tagline: previous.tagline,
    description: previous.description,
    venueName: previous.venueName,
    venueAddress: previous.venueAddress,
    venueCity: previous.venueCity,
    latitude: previous.latitude ?? null,
    longitude: previous.longitude ?? null,
    coverImage: previous.coverImage,
    copyDetailsFromPrevious: false,
    consecutiveStart: earliestStart,
    dayCount,
    days: buildConsecutiveDays(earliestStart, dayCount),
    speakerIds: [],
    sponsorIds: [],
    membershipIds: [],
  };
}

export function resolvedDays(values: EventFormValues): DayRow[] {
  if (values.scheduleMode === 'consecutive') {
    return buildConsecutiveDays(values.consecutiveStart, values.dayCount);
  }
  return values.days;
}

export function validateEventForm(
  values: EventFormValues,
  options?: {
    mode?: EventFormMode;
    previousEvent?: PublicEvent | null;
    editingEventId?: string | null;
    otherEditions?: PublicEvent[];
  },
): FieldErrors {
  const errors: FieldErrors = {};
  const dayDates = resolvedDays(values)
    .map((day) => day.date)
    .filter(Boolean);

  if (!values.name.trim()) errors.name = 'Name is required';
  else if (values.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';

  if (values.scheduleMode === 'consecutive') {
    if (!values.consecutiveStart) errors.consecutiveStart = 'Start date is required';
    if (!values.dayCount || values.dayCount < 1) errors.dayCount = 'Day count must be at least 1';
    if (values.dayCount > 60) errors.dayCount = 'Day count cannot exceed 60';
  } else {
    if (values.days.length === 0) errors.days = 'Add at least one event day';

    const editingEventId =
      options?.mode === 'edit'
        ? options.editingEventId ?? options.previousEvent?.id ?? null
        : null;
    const otherEditions =
      options?.otherEditions ??
      (options?.mode === 'schedule' && options.previousEvent ? [options.previousEvent] : []);
    const bounds = getEditionScheduleBounds(
      editingEventId,
      dayDates,
      otherEditions,
    );
    const earliestStart =
      options?.mode === 'schedule' && options.previousEvent
        ? dayAfterIso(options.previousEvent.endDate)
        : bounds.earliestStart;

    values.days.forEach((day, index) => {
      if (!day.date) {
        errors[`day-${index}`] = 'Date is required';
        return;
      }

      if (index > 0) {
        const previousDate = values.days[index - 1]?.date;
        if (previousDate && day.date <= previousDate) {
          errors[`day-${index}`] =
            errors[`day-${index}`] ||
            `Must be after Day ${index} (${formatUtcDateLabel(`${previousDate}T00:00:00.000Z`)}).`;
        }
      } else if (earliestStart && day.date < earliestStart) {
        errors[`day-${index}`] =
          errors[`day-${index}`] ||
          `Must start on or after ${formatUtcDateLabel(`${earliestStart}T00:00:00.000Z`)}.`;
      }

      if (bounds.latestEnd && day.date > bounds.latestEnd) {
        errors[`day-${index}`] =
          errors[`day-${index}`] ||
          `Must be on or before ${formatUtcDateLabel(`${bounds.latestEnd}T00:00:00.000Z`)} (before the next edition).`;
      }
    });
  }

  const scheduleError = validateEditionSchedule(dayDates, {
    editingEventId:
      options?.mode === 'edit'
        ? options.editingEventId ?? options.previousEvent?.id ?? null
        : null,
    otherEditions:
      options?.otherEditions ??
      (options?.mode === 'schedule' && options.previousEvent ? [options.previousEvent] : []),
  });

  if (scheduleError) {
    if (values.scheduleMode === 'consecutive') {
      errors.consecutiveStart = errors.consecutiveStart || scheduleError;
      if (values.consecutiveStart && values.dayCount > 0) {
        const lastDay = addUtcDays(values.consecutiveStart, values.dayCount - 1);
        const bounds = getEditionScheduleBounds(
          options?.mode === 'edit'
            ? options.editingEventId ?? options.previousEvent?.id ?? null
            : null,
          dayDates,
          options?.otherEditions ??
            (options?.mode === 'schedule' && options.previousEvent
              ? [options.previousEvent]
              : []),
        );
        if (bounds.latestEnd && lastDay > bounds.latestEnd) {
          errors.dayCount =
            errors.dayCount ||
            `Too many days — latest allowed end is ${formatUtcDateLabel(`${bounds.latestEnd}T00:00:00.000Z`)}.`;
        }
      }
    } else {
      errors.days = errors.days || scheduleError;
    }
  }

  if (
    options?.mode === 'schedule' &&
    options.previousEvent &&
    values.scheduleMode === 'consecutive' &&
    values.consecutiveStart
  ) {
    const earliestStart = dayAfterIso(options.previousEvent.endDate);
    if (earliestStart && values.consecutiveStart < earliestStart) {
      errors.consecutiveStart =
        errors.consecutiveStart ||
        `Must start on or after ${formatUtcDateLabel(`${earliestStart}T00:00:00.000Z`)}.`;
    }
  }

  const skipCopiedMediaCheck =
    options?.mode === 'schedule' && values.copyDetailsFromPrevious && options.previousEvent;

  if (
    !skipCopiedMediaCheck &&
    values.coverImage.trim() &&
    !isValidMediaRef(values.coverImage.trim())
  ) {
    errors.coverImage = 'Use a valid URL or upload an image file';
  }

  return errors;
}

function toDaysPayload(values: EventFormValues) {
  return resolvedDays(values)
    .filter((day) => day.date)
    .map((day, index) => ({
      dayNumber: index + 1,
      date: `${day.date}T00:00:00.000Z`,
      label: day.label.trim() || `Day ${index + 1}`,
    }));
}

export function toEventPayload(values: EventFormValues): EventPayload {
  return {
    name: values.name.trim(),
    tagline: values.tagline.trim(),
    description: values.description.trim(),
    days: toDaysPayload(values),
    venueName: values.venueName.trim(),
    venueAddress: values.venueAddress.trim(),
    venueCity: values.venueCity.trim(),
    latitude: values.latitude,
    longitude: values.longitude,
    coverImage: values.coverImage.trim(),
    paused: values.paused,
    published: values.published,
    notifyAttendees: values.notifyAttendees,
    speakerIds: values.speakerIds,
    sponsorIds: values.sponsorIds,
    membershipIds: values.membershipIds,
  };
}

export function toSchedulePayload(values: EventFormValues): ScheduleEventPayload {
  return {
    name: values.name.trim(),
    days: toDaysPayload(values),
    copyDetailsFromPrevious: false,
    tagline: values.tagline.trim(),
    description: values.description.trim(),
    venueName: values.venueName.trim(),
    venueAddress: values.venueAddress.trim(),
    venueCity: values.venueCity.trim(),
    latitude: values.latitude,
    longitude: values.longitude,
    coverImage: values.coverImage.trim(),
    published: values.published,
    notifyAttendees: values.notifyAttendees,
    speakerIds: values.speakerIds,
    sponsorIds: values.sponsorIds,
    membershipIds: values.membershipIds,
  };
}

export function eventDaysFromValues(values: EventFormValues) {
  return toDaysPayload(values);
}
