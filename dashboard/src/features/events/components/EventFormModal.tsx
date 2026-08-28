import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { EventAssociationPicker } from '@/features/events/components/EventAssociationPicker';
import { EventFormDetailsStep } from '@/features/events/components/EventFormDetailsStep';
import {
  emptyForm,
  eventToForm,
  toEventPayload,
  validateEventForm,
  type EventFormMode,
  type EventFormValues,
  type FieldErrors,
} from '@/features/events/components/event-form-utils';
import { eventsApi } from '@/features/events/api/events-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { uploadImageFile } from '@/shared/lib/upload-image';
import type { EventPayload, PublicEvent, ScheduleEventPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/toast';

export type { EventFormMode, EventFormValues } from '@/features/events/components/event-form-utils';
export { toEventPayload, toSchedulePayload } from '@/features/events/components/event-form-utils';

interface EventFormModalProps {
  open: boolean;
  mode: EventFormMode;
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
    }
  }, [open, mode, initialEvent]);

  const associationsQuery = useQuery({
    queryKey: ['events', initialEvent?.id, 'associations'],
    queryFn: () => eventsApi.getAssociations(initialEvent!.id),
    enabled: open && mode === 'edit' && Boolean(initialEvent?.id),
  });

  useEffect(() => {
    if (!open || mode !== 'edit' || !associationsQuery.data) return;
    setValues((current) => ({
      ...current,
      speakerIds: [],
      sponsorIds: associationsQuery.data.sponsorIds,
      membershipIds: associationsQuery.data.membershipIds,
    }));
  }, [open, mode, associationsQuery.data]);

  if (!open) return null;

  function handlePendingCoverChange(file: File | null, preview: string | null) {
    setPendingCoverPreview((prev) => {
      if (prev && prev !== preview) URL.revokeObjectURL(prev);
      return preview;
    });
    setPendingCover(file);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);

    let coverImage = values.coverImage;
    if (pendingCover) {
      setUploading(true);
      try {
        coverImage = await uploadImageFile(pendingCover);
        handlePendingCoverChange(null, null);
        setValues((current) => ({ ...current, coverImage }));
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
    const nextErrors = validateEventForm(nextValues, { mode, previousEvent: initialEvent });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(toEventPayload(nextValues));
  }

  const busy = loading || uploading;

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
          <h2 id="event-form-title">Edit edition</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form className="modal-body event-form" onSubmit={handleSubmit} noValidate>
          <EventFormDetailsStep
            mode={mode}
            initialEvent={initialEvent}
            values={values}
            errors={errors}
            loading={busy}
            uploading={uploading}
            pendingCover={pendingCover}
            pendingCoverPreview={pendingCoverPreview}
            onChange={(next) => {
              setValues(next);
              if (submitted) {
                setErrors(validateEventForm(next, { mode, previousEvent: initialEvent }));
              }
            }}
            onPendingCoverChange={handlePendingCoverChange}
            onCoverUploadError={(message) => toast.error(message)}
          />

          <EventAssociationPicker
            value={{
              sponsorIds: values.sponsorIds,
              membershipIds: values.membershipIds,
            }}
            disabled={busy || associationsQuery.isLoading}
            onChange={(next) =>
              setValues((current) => ({
                ...current,
                sponsorIds: next.sponsorIds,
                membershipIds: next.membershipIds,
              }))
            }
            hint="Link shared memberships and sponsors to this event. Speakers are assigned when you create sessions."
          />

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
