import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { CANONICAL_EVENT_NAME } from '@/features/events/constants';
import { EventAssociationPicker } from '@/features/events/components/EventAssociationPicker';
import { VenuePlacesField } from '@/features/events/components/VenuePlacesField';
import { getApiErrorMessage } from '@/shared/api/client';
import { uploadImageFile } from '@/shared/lib/upload-image';
import { isValidMediaRef, resolveMediaUrl } from '@/shared/lib/media';
import type { EventPayload, PublicEvent, ScheduleEventPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';
import { useToast } from '@/shared/ui/toast';

type ScheduleMode = 'consecutive' | 'custom';
export type EventFormMode = 'edit' | 'schedule';

interface DayRow {
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

type FieldErrors = Partial<Record<string, string>>;

function newDayKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDateInput(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** UTC calendar day after an ISO date (exclusive of that day). */
function dayAfterIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + 1);
  return toDateInput(date.toISOString());
}

function formatUtcDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function addUtcDays(dateValue: string, offset: number): string {
  const [y, m, d] = dateValue.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + offset));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function buildConsecutiveDays(start: string, count: number): DayRow[] {
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

const emptyForm: EventFormValues = {
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

function eventToForm(event: PublicEvent): EventFormValues {
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

function scheduleBlankForm(previous: PublicEvent | null): EventFormValues {
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

function resolvedDays(values: EventFormValues): DayRow[] {
  if (values.scheduleMode === 'consecutive') {
    return buildConsecutiveDays(values.consecutiveStart, values.dayCount);
  }
  return values.days;
}

function validate(
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

interface EventFormModalProps {
  open: boolean;
  mode: EventFormMode;
  /** Current edition for edit, or previous edition for schedule prefill. */
  initialEvent: PublicEvent | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: EventPayload | ScheduleEventPayload) => Promise<void> | void;
}

export function EventFormModal({
  open,
  mode,
  initialEvent,
  loading = false,
  onClose,
  onSubmit,
}: EventFormModalProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<EventFormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const [pendingCoverPreview, setPendingCoverPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setErrors({});
    setUploading(false);
    setPendingCover(null);
    setPendingCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (mode === 'edit' && initialEvent) {
      setValues(eventToForm(initialEvent));
    } else {
      setValues(scheduleBlankForm(initialEvent));
    }
  }, [open, mode, initialEvent]);

  if (!open) return null;

  function setForm(next: EventFormValues) {
    setValues(next);
    if (submitted) setErrors(validate(next, { mode, previousEvent: initialEvent }));
  }

  function update<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setForm({ ...values, [key]: value });
  }

  function handleCoverSelect(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setPendingCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPendingCover(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function clearCoverImage() {
    setPendingCover(null);
    setPendingCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    update('coverImage', '');
  }

  function setScheduleMode(scheduleMode: ScheduleMode) {
    if (scheduleMode === 'consecutive') {
      const start =
        values.consecutiveStart || values.days.find((day) => day.date)?.date || '';
      const dayCount = Math.max(values.days.length || values.dayCount || 1, 1);
      setForm({
        ...values,
        scheduleMode,
        consecutiveStart: start,
        dayCount,
        days: buildConsecutiveDays(start, dayCount),
      });
      return;
    }

    setForm({
      ...values,
      scheduleMode,
      days:
        values.days.length > 0
          ? values.days
          : buildConsecutiveDays(values.consecutiveStart, values.dayCount),
    });
  }

  function updateConsecutiveStart(consecutiveStart: string) {
    setForm({
      ...values,
      consecutiveStart,
      days: buildConsecutiveDays(consecutiveStart, values.dayCount),
    });
  }

  function updateDayCount(dayCount: number) {
    const safeCount = Number.isFinite(dayCount) ? Math.min(Math.max(dayCount, 1), 60) : 1;
    setForm({
      ...values,
      dayCount: safeCount,
      days: buildConsecutiveDays(values.consecutiveStart, safeCount),
    });
  }

  function updateDay(index: number, patch: Partial<DayRow>) {
    const days = values.days.map((day, i) => (i === index ? { ...day, ...patch } : day));
    setForm({ ...values, days });
  }

  function addDay() {
    const nextIndex = values.days.length + 1;
    setForm({
      ...values,
      days: [...values.days, { key: newDayKey(), date: '', label: `Day ${nextIndex}` }],
    });
  }

  function removeDay(index: number) {
    if (values.days.length <= 1) return;
    setForm({
      ...values,
      days: values.days.filter((_, i) => i !== index),
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);

    let coverImage = values.coverImage;
    if (pendingCover) {
      setUploading(true);
      try {
        coverImage = await uploadImageFile(pendingCover);
        setPendingCover(null);
        setPendingCoverPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        update('coverImage', coverImage);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : getApiErrorMessage(error, 'Unable to upload image'),
        );
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const nextValues = { ...values, coverImage };
    const nextErrors = validate(nextValues, { mode, previousEvent: initialEvent });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(
      mode === 'schedule' ? toSchedulePayload(nextValues) : toEventPayload(nextValues),
    );
  }

  const previewDays =
    values.scheduleMode === 'consecutive'
      ? buildConsecutiveDays(values.consecutiveStart, values.dayCount)
      : values.days;

  const isSchedule = mode === 'schedule';
  const showDetails = !isSchedule || !values.copyDetailsFromPrevious || !initialEvent;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="event-form-title">
            {isSchedule ? 'Schedule new event' : 'Edit edition'}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form className="modal-body event-form" onSubmit={handleSubmit} noValidate>
          <Input label="Name" name="name" value={CANONICAL_EVENT_NAME} readOnly disabled />
          <p className="hint" style={{ marginTop: '-0.35rem' }}>
            {isSchedule
              ? 'Creates a separate edition with its own speakers, sessions, and store. Dates must start after the previous edition ends (not before or on the same day).'
              : 'Updates this edition only. Use Schedule new event to create another gathering after this one ends.'}
          </p>

          {!isSchedule ? (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={values.paused}
                onChange={(e) => update('paused', e.target.checked)}
              />
              <span>
                <strong>Pause this event</strong> — attendees get a push notification; countdown
                notices pause too
              </span>
            </label>
          ) : null}

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={values.published}
              onChange={(e) => update('published', e.target.checked)}
            />
            <span>
              <strong>Published</strong> — visible in the app and public catalog. Uncheck for a
              draft.
            </span>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={values.notifyAttendees}
              onChange={(e) => update('notifyAttendees', e.target.checked)}
            />
            <span>
              Notify attendees by push when dates change
              {!isSchedule ? ' or pause/resume' : ' (new edition announced)'}
            </span>
          </label>

          {isSchedule && initialEvent ? (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={values.copyDetailsFromPrevious}
                onChange={(e) => update('copyDetailsFromPrevious', e.target.checked)}
              />
              <span>Copy tagline, venue, and cover from the previous edition</span>
            </label>
          ) : null}

          {showDetails ? (
            <>
              <Input
                label="Tagline"
                name="tagline"
                value={values.tagline}
                error={errors.tagline}
                onChange={(e) => update('tagline', e.target.value)}
                placeholder="Three days. One transformation."
              />
              <TextArea
                label="Description"
                name="description"
                value={values.description}
                error={errors.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="A 3-day luxury personal development and leadership conference..."
              />
            </>
          ) : null}

          <fieldset className="schedule-fieldset">
            <legend>{isSchedule ? 'New event dates' : 'Event schedule'}</legend>
            <p className="hint">
              {isSchedule && initialEvent
                ? `This is a separate edition. Start on or after ${formatUtcDateLabel(`${dayAfterIso(initialEvent.endDate)}T00:00:00.000Z`)} (the day after the previous edition ends on ${formatUtcDateLabel(initialEvent.endDate)}).`
                : isSchedule
                  ? 'Choose the dates for this new edition.'
                  : 'Adjust dates for this edition if needed. Do not use this to start a new gathering.'}
            </p>

            <div className="schedule-mode-toggle" role="group" aria-label="Schedule mode">
              <button
                type="button"
                className={values.scheduleMode === 'consecutive' ? 'active' : ''}
                onClick={() => setScheduleMode('consecutive')}
              >
                Consecutive days
              </button>
              <button
                type="button"
                className={values.scheduleMode === 'custom' ? 'active' : ''}
                onClick={() => setScheduleMode('custom')}
              >
                Custom days
              </button>
            </div>

            {values.scheduleMode === 'consecutive' ? (
              <div className="schedule-grid">
                <Input
                  label="First day"
                  type="date"
                  name="consecutiveStart"
                  requiredMark
                  min={
                    isSchedule && initialEvent
                      ? dayAfterIso(initialEvent.endDate)
                      : undefined
                  }
                  value={values.consecutiveStart}
                  error={errors.consecutiveStart}
                  onChange={(e) => updateConsecutiveStart(e.target.value)}
                />
                <Input
                  label="Number of days"
                  type="number"
                  name="dayCount"
                  requiredMark
                  min={1}
                  max={60}
                  value={String(values.dayCount)}
                  error={errors.dayCount}
                  onChange={(e) => updateDayCount(Number(e.target.value))}
                />
              </div>
            ) : (
              <div className="day-list">
                {errors.days ? <p className="field-error">{errors.days}</p> : null}
                {values.days.map((day, index) => (
                  <div className="day-row" key={day.key}>
                    <div className="day-row-index">Day {index + 1}</div>
                    <Input
                      label="Date"
                      type="date"
                      name={`day-date-${index}`}
                      requiredMark
                      min={
                        isSchedule && initialEvent
                          ? dayAfterIso(initialEvent.endDate)
                          : undefined
                      }
                      value={day.date}
                      error={errors[`day-${index}`]}
                      onChange={(e) => updateDay(index, { date: e.target.value })}
                    />
                    <Input
                      label="Label"
                      name={`day-label-${index}`}
                      value={day.label}
                      onChange={(e) => updateDay(index, { label: e.target.value })}
                      placeholder={`Day ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="day-remove"
                      disabled={values.days.length <= 1}
                      onClick={() => removeDay(index)}
                      aria-label={`Remove day ${index + 1}`}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="secondary" onClick={addDay}>
                  <Plus size={16} />
                  Add day
                </Button>
              </div>
            )}

            {previewDays.some((day) => day.date) ? (
              <div className="day-preview">
                <p className="field-label">
                  {previewDays.filter((day) => day.date).length}-day schedule
                </p>
                <ul>
                  {previewDays
                    .filter((day) => day.date)
                    .map((day, index) => (
                      <li key={`${day.date}-${index}`}>
                        <strong>Day {index + 1}</strong>
                        <span>{day.date}</span>
                        {day.label ? <span className="muted">{day.label}</span> : null}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </fieldset>

          {showDetails ? (
            <>
              <VenuePlacesField
                venueName={values.venueName}
                venueAddress={values.venueAddress}
                venueCity={values.venueCity}
                latitude={values.latitude}
                longitude={values.longitude}
                errors={{
                  venueName: errors.venueName,
                  venueAddress: errors.venueAddress,
                  venueCity: errors.venueCity,
                }}
                onChange={(next) =>
                  setForm({
                    ...values,
                    venueName: next.venueName,
                    venueAddress: next.venueAddress,
                    venueCity: next.venueCity,
                    latitude: next.latitude,
                    longitude: next.longitude,
                  })
                }
              />
              <div className="cover-field">
                <span className="field-label">Cover image</span>
                <div className="cover-actions">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    hidden
                    onChange={(e) => handleCoverSelect(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    loading={uploading}
                    disabled={loading || uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus size={16} />
                    {pendingCover ? 'Change photo' : 'Choose from device'}
                  </Button>
                  {values.coverImage || pendingCover ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={clearCoverImage}
                      disabled={uploading}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <Input
                  label="Or paste image URL"
                  name="coverImage"
                  value={pendingCover ? '' : values.coverImage}
                  error={errors.coverImage}
                  disabled={Boolean(pendingCover)}
                  onChange={(e) => {
                    setPendingCover(null);
                    setPendingCoverPreview((prev) => {
                      if (prev) URL.revokeObjectURL(prev);
                      return null;
                    });
                    update('coverImage', e.target.value);
                  }}
                  placeholder="https://… or /uploads/…"
                />
                {pendingCoverPreview ||
                (values.coverImage && isValidMediaRef(values.coverImage)) ? (
                  <div className="cover-preview">
                    <img
                      src={
                        pendingCoverPreview || resolveMediaUrl(values.coverImage)
                      }
                      alt="Event cover preview"
                    />
                  </div>
                ) : null}
                <p className="hint">
                  {pendingCover
                    ? 'Photo selected — it will upload when you save.'
                    : 'Photo uploads when you save the form'}
                </p>
              </div>
            </>
          ) : null}

          {isSchedule ? (
            <EventAssociationPicker
              value={{
                speakerIds: values.speakerIds,
                sponsorIds: values.sponsorIds,
                membershipIds: values.membershipIds,
              }}
              disabled={loading || uploading}
              onChange={(next) =>
                setForm({
                  ...values,
                  speakerIds: next.speakerIds,
                  sponsorIds: next.sponsorIds,
                  membershipIds: next.membershipIds,
                })
              }
            />
          ) : null}

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading || uploading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading || uploading}>
              {isSchedule ? 'Schedule event' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
