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
  copyDetailsFromPrevious: true,
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
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((day) => ({
            key: newDayKey(),
            date: toDateInput(day.date),
            label: day.label || `Day ${day.dayNumber}`,
          }))
      : buildConsecutiveDays(toDateInput(event.startDate), 1);

  const dates = days.map((day) => day.date).filter(Boolean);
  const consecutive = areConsecutive(dates);

  return {
    name: CANONICAL_EVENT_NAME,
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
    copyDetailsFromPrevious: true,
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
    tagline: previous.tagline,
    description: previous.description,
    venueName: previous.venueName,
    venueAddress: previous.venueAddress,
    venueCity: previous.venueCity,
    latitude: previous.latitude ?? null,
    longitude: previous.longitude ?? null,
    coverImage: previous.coverImage,
    copyDetailsFromPrevious: true,
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
  options?: { mode?: EventFormMode; previousEvent?: PublicEvent | null },
): FieldErrors {
  const errors: FieldErrors = {};

  if (values.scheduleMode === 'consecutive') {
    if (!values.consecutiveStart) errors.consecutiveStart = 'Start date is required';
    if (!values.dayCount || values.dayCount < 1) errors.dayCount = 'Day count must be at least 1';
    if (values.dayCount > 60) errors.dayCount = 'Day count cannot exceed 60';
  } else {
    if (values.days.length === 0) errors.days = 'Add at least one event day';
    const seen = new Set<string>();
    values.days.forEach((day, index) => {
      if (!day.date) {
        errors[`day-${index}`] = 'Date is required';
        return;
      }
      if (seen.has(day.date)) {
        errors[`day-${index}`] = 'Duplicate date';
      }
      seen.add(day.date);
    });
  }

  if (options?.mode === 'schedule' && options.previousEvent) {
    const earliest = dayAfterIso(options.previousEvent.endDate);
    const firstDay = resolvedDays(values)
      .map((day) => day.date)
      .filter(Boolean)
      .sort()[0];
    if (earliest && firstDay && firstDay <= toDateInput(options.previousEvent.endDate)) {
      errors.consecutiveStart =
        errors.consecutiveStart ||
        `Must start after the previous edition ends (${formatUtcDateLabel(options.previousEvent.endDate)}). Earliest: ${formatUtcDateLabel(`${earliest}T00:00:00.000Z`)}.`;
      if (values.scheduleMode === 'custom') {
        errors.days =
          errors.days ||
          `All dates must be after ${formatUtcDateLabel(options.previousEvent.endDate)}.`;
      }
    }
  }

  if (values.coverImage.trim() && !isValidMediaRef(values.coverImage.trim())) {
    errors.coverImage = 'Use a valid URL or upload an image file';
  }

  return errors;
}

function toDaysPayload(values: EventFormValues) {
  return resolvedDays(values)
    .filter((day) => day.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day, index) => ({
      dayNumber: index + 1,
      date: `${day.date}T00:00:00.000Z`,
      label: day.label.trim() || `Day ${index + 1}`,
    }));
}

export function toEventPayload(values: EventFormValues): EventPayload {
  return {
    name: CANONICAL_EVENT_NAME,
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
  const copy = values.copyDetailsFromPrevious;
  return {
    days: toDaysPayload(values),
    copyDetailsFromPrevious: copy,
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
