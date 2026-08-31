import { useRef } from 'react';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { VenuePlacesField } from '@/features/events/components/VenuePlacesField';
import { formatUsDateInputValue } from '@/shared/lib/datetime';
import { isValidMediaRef, resolveMediaUrl } from '@/shared/lib/media';
import type { PublicEvent } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';
import {
  addUtcDays,
  buildConsecutiveDays,
  customDayMinDate,
  dayAfterIso,
  formatUtcDateLabel,
  getEditionScheduleBounds,
  newDayKey,
  resolvedDays,
  type EventFormMode,
  type EventFormValues,
  type FieldErrors,
  type ScheduleMode,
} from './event-form-utils';

interface EventFormDetailsStepProps {
  mode: EventFormMode;
  initialEvent: PublicEvent | null;
  otherEditions?: PublicEvent[];
  values: EventFormValues;
  errors: FieldErrors;
  loading?: boolean;
  uploading?: boolean;
  pendingCover: File | null;
  pendingCoverPreview: string | null;
  onChange: (next: EventFormValues) => void;
  onPendingCoverChange: (file: File | null, preview: string | null) => void;
  onCoverUploadError: (message: string) => void;
}

export function EventFormDetailsStep({
  mode,
  initialEvent,
  otherEditions = [],
  values,
  errors,
  loading = false,
  uploading = false,
  pendingCover,
  pendingCoverPreview,
  onChange,
  onPendingCoverChange,
  onCoverUploadError,
}: EventFormDetailsStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSchedule = mode === 'schedule';
  const showDetails = true;
  const editingEventId = !isSchedule ? initialEvent?.id ?? null : null;
  const dayDates = resolvedDays(values)
    .map((day) => day.date)
    .filter(Boolean);
  const bounds = getEditionScheduleBounds(editingEventId, dayDates, otherEditions);
  const minStart =
    isSchedule && initialEvent
      ? dayAfterIso(initialEvent.endDate)
      : bounds.earliestStart ?? undefined;
  const maxStart =
    bounds.latestEnd && values.dayCount > 0
      ? addUtcDays(bounds.latestEnd, -(values.dayCount - 1))
      : undefined;

  function update<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  function setScheduleMode(scheduleMode: ScheduleMode) {
    if (scheduleMode === 'consecutive') {
      const start =
        values.consecutiveStart || values.days.find((day) => day.date)?.date || '';
      const dayCount = Math.max(values.days.length || values.dayCount || 1, 1);
      onChange({
        ...values,
        scheduleMode,
        consecutiveStart: start,
        dayCount,
        days: buildConsecutiveDays(start, dayCount),
      });
      return;
    }

    onChange({
      ...values,
      scheduleMode,
      days:
        values.days.length > 0
          ? values.days
          : buildConsecutiveDays(values.consecutiveStart, values.dayCount),
    });
  }

  function updateConsecutiveStart(consecutiveStart: string) {
    onChange({
      ...values,
      consecutiveStart,
      days: buildConsecutiveDays(consecutiveStart, values.dayCount),
    });
  }

  function updateDayCount(dayCount: number) {
    const safeCount = Number.isFinite(dayCount) ? Math.min(Math.max(dayCount, 1), 60) : 1;
    onChange({
      ...values,
      dayCount: safeCount,
      days: buildConsecutiveDays(values.consecutiveStart, safeCount),
    });
  }

  function updateDay(index: number, patch: Partial<EventFormValues['days'][number]>) {
    const days = values.days.map((day, i) => (i === index ? { ...day, ...patch } : day));
    onChange({ ...values, days });
  }

  function addDay() {
    const nextIndex = values.days.length + 1;
    onChange({
      ...values,
      days: [
        ...values.days,
        { key: newDayKey(), date: '', label: `Day ${nextIndex}` },
      ],
    });
  }

  function removeDay(index: number) {
    if (values.days.length <= 1) return;
    onChange({
      ...values,
      days: values.days.filter((_, i) => i !== index),
    });
  }

  function handleCoverSelect(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onCoverUploadError('Please choose an image file');
      return;
    }
    onPendingCoverChange(file, URL.createObjectURL(file));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function clearCoverImage() {
    onPendingCoverChange(null, null);
    update('coverImage', '');
  }

  const previewDays =
    values.scheduleMode === 'consecutive'
      ? buildConsecutiveDays(values.consecutiveStart, values.dayCount)
      : values.days;

  return (
    <>
      <Input
        label="Name"
        requiredMark
        name="name"
        value={values.name}
        error={errors.name}
        onChange={(e) => update('name', e.target.value)}
        placeholder="Unleash Your Brave"
      />
      <p className="hint" style={{ marginTop: '-0.35rem' }}>
        {isSchedule
          ? 'Creates a separate edition with its own sessions, sponsors, and store.'
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
          <strong>Published</strong> — visible in the app and public catalog. Uncheck for a draft.
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
            ? `Start on or after ${formatUtcDateLabel(`${dayAfterIso(initialEvent.endDate)}T00:00:00.000Z`)} (the day after the previous edition ends on ${formatUtcDateLabel(initialEvent.endDate)}).`
            : isSchedule
              ? 'Choose the dates for this new edition.'
              : bounds.earliestStart || bounds.latestEnd
                ? [
                    'Each day must be after the previous day.',
                    bounds.earliestStart
                      ? `Earliest start: ${formatUtcDateLabel(`${bounds.earliestStart}T00:00:00.000Z`)}.`
                      : null,
                    bounds.latestEnd
                      ? `Latest end: ${formatUtcDateLabel(`${bounds.latestEnd}T00:00:00.000Z`)}.`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' ')
                : 'Each day must be after the previous day and must not overlap another edition.'}
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
              min={minStart}
              max={maxStart}
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
                  min={customDayMinDate(index, values.days, minStart)}
                  max={bounds.latestEnd ?? undefined}
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
                    <span>{formatUsDateInputValue(day.date)}</span>
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
              onChange({
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
                onPendingCoverChange(null, null);
                update('coverImage', e.target.value);
              }}
              placeholder="https://… or /uploads/…"
            />
            {pendingCoverPreview ||
            (values.coverImage && isValidMediaRef(values.coverImage)) ? (
              <div className="cover-preview">
                <img
                  src={pendingCoverPreview || resolveMediaUrl(values.coverImage)}
                  alt="Event cover preview"
                />
              </div>
            ) : null}
            <p className="hint">
              {pendingCover
                ? 'Photo selected — it will upload when you finish.'
                : 'Photo uploads when you save the event'}
            </p>
          </div>
        </>
      ) : null}
    </>
  );
}
