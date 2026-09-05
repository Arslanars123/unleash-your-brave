import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { eventsApi } from '@/features/events/api/events-api';
import { formatEditionRange } from '@/features/events/hooks/useEditionScope';
import type { PublicSpeaker, SpeakerPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import {
  MediaImageField,
  isValidMediaRef,
  type MediaImageFieldHandle,
} from '@/shared/ui/MediaImageField';
import { TextArea } from '@/shared/ui/TextArea';

export interface SpeakerFormValues {
  eventIds: string[];
  name: string;
  email: string;
  title: string;
  description: string;
  photo: string;
}

type FieldErrors = Partial<Record<keyof SpeakerFormValues, string>>;

const emptyForm: SpeakerFormValues = {
  eventIds: [],
  name: '',
  email: '',
  title: '',
  description: '',
  photo: '',
};

function speakerToForm(speaker: PublicSpeaker): SpeakerFormValues {
  const eventIds =
    speaker.eventIds && speaker.eventIds.length > 0
      ? speaker.eventIds
      : speaker.eventId
        ? [speaker.eventId]
        : [];
  return {
    eventIds,
    name: speaker.name,
    email: speaker.email,
    title: speaker.title,
    description: speaker.description,
    photo: speaker.photo,
  };
}

function validate(values: SpeakerFormValues, requireEvent: boolean): FieldErrors {
  const errors: FieldErrors = {};

  if (requireEvent && values.eventIds.length === 0) {
    errors.eventIds = 'Select at least one event';
  }

  if (!values.name.trim()) errors.name = 'Name is required';
  else if (values.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';

  if (values.photo.trim() && !isValidMediaRef(values.photo.trim())) {
    errors.photo = 'Use a valid URL or upload an image';
  }

  const email = values.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address';
  }

  return errors;
}

export function toSpeakerPayload(values: SpeakerFormValues): SpeakerPayload {
  return {
    eventIds: values.eventIds,
    name: values.name.trim(),
    email: values.email.trim() || undefined,
    title: values.title.trim(),
    description: values.description.trim(),
    photo: values.photo.trim(),
  };
}

interface SpeakerFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialSpeaker?: PublicSpeaker | null;
  /** Prefill / lock event when creating from an edition context. */
  eventId?: string;
  hideEventSelect?: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: SpeakerPayload) => Promise<void> | void;
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

export function SpeakerFormModal({
  open,
  mode,
  initialSpeaker,
  eventId,
  hideEventSelect = false,
  loading = false,
  onClose,
  onSubmit,
}: SpeakerFormModalProps) {
  const [values, setValues] = useState<SpeakerFormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [committingPhoto, setCommittingPhoto] = useState(false);
  const photoRef = useRef<MediaImageFieldHandle>(null);

  const eventsQuery = useQuery({
    queryKey: ['events', 'speaker-form'],
    queryFn: () => eventsApi.list({ perPage: 100 }),
    enabled: open && !hideEventSelect,
  });

  const editions = eventsQuery.data?.items ?? [];
  const requireEvent = !hideEventSelect || Boolean(eventId);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setErrors({});
    if (initialSpeaker) {
      setValues(speakerToForm(initialSpeaker));
    } else {
      setValues({
        ...emptyForm,
        eventIds: eventId ? [eventId] : [],
      });
    }
  }, [open, initialSpeaker, eventId]);

  if (!open) return null;

  function update<K extends keyof SpeakerFormValues>(key: K, value: SpeakerFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (submitted) setErrors(validate(next, requireEvent));
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);

    let photo = values.photo;
    if (photoRef.current?.hasPendingFile()) {
      setCommittingPhoto(true);
      try {
        photo = await photoRef.current.commit();
      } catch {
        setCommittingPhoto(false);
        return;
      }
      setCommittingPhoto(false);
    }

    const nextValues: SpeakerFormValues = {
      ...values,
      photo,
      eventIds: hideEventSelect
        ? eventId
          ? [eventId]
          : values.eventIds
        : values.eventIds,
    };
    setValues(nextValues);
    const nextErrors = validate(nextValues, requireEvent);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(toSpeakerPayload(nextValues));
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="speaker-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="speaker-form-title">{mode === 'create' ? 'Create Speaker' : 'Edit Speaker'}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form className="modal-body event-form" onSubmit={handleSubmit} noValidate>
          {!hideEventSelect ? (
            <fieldset className="schedule-fieldset">
              <legend>
                Events <span className="required-mark">*</span>
              </legend>
              <p className="hint">
                One speaker profile can be linked to multiple event editions. The same email cannot
                be added twice to the same event.
              </p>
              {eventsQuery.isLoading ? (
                <p className="muted">Loading events…</p>
              ) : editions.length === 0 ? (
                <p className="muted">No events yet. Create an event first.</p>
              ) : (
                <ul className="day-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {editions.map((edition) => (
                    <li key={edition.id} style={{ marginBottom: 6 }}>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={values.eventIds.includes(edition.id)}
                          onChange={() => update('eventIds', toggleId(values.eventIds, edition.id))}
                        />
                        <span>
                          {edition.name} ({formatEditionRange(edition)})
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {errors.eventIds ? <span className="field-error">{errors.eventIds}</span> : null}
            </fieldset>
          ) : null}

          <Input
            label="Name"
            requiredMark
            name="name"
            value={values.name}
            error={errors.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Maya Chen"
          />
          <Input
            label="Portal email"
            name="email"
            type="email"
            value={values.email}
            error={errors.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="speaker@example.com"
          />
          <p className="hint">
            Optional. Sends a login invite (or “use your existing password” if they already have an
            account). Event add/remove also emails the speaker.
          </p>
          <Input
            label="Title"
            name="title"
            value={values.title}
            error={errors.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Founder & Keynote Speaker"
          />
          <TextArea
            label="Description"
            name="description"
            value={values.description}
            error={errors.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="A short bio for the speaker..."
          />
          <MediaImageField
            ref={photoRef}
            label="Photo"
            value={values.photo}
            error={errors.photo}
            disabled={loading || committingPhoto}
            onChange={(url) => update('photo', url)}
          />

          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading || committingPhoto}
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading || committingPhoto}>
              {mode === 'create' ? 'Create speaker' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
