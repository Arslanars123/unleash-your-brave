import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { EventAssociationPicker } from '@/features/events/components/EventAssociationPicker';
import { EventFormDetailsStep } from '@/features/events/components/EventFormDetailsStep';
import {
  emptyForm,
  eventDaysFromValues,
  eventToForm,
  toEventPayload,
  validateEventForm,
  type EventFormMode,
  type EventFormValues,
  type FieldErrors,
} from '@/features/events/components/event-form-utils';
import { EventWizardCheckInFormStep } from '@/features/events/components/EventWizardCheckInFormStep';
import {
  freshWizardCheckInFormValues,
  publicCheckInFormToValues,
  toCheckInFormPayload,
  validateCheckInFormValues,
  type CheckInFormFieldErrors,
  type CheckInFormValues,
} from '@/features/checkin-forms/checkin-form-utils';
import { checkInFormsApi } from '@/features/checkin-forms/api/checkin-forms-api';
import { eventsApi } from '@/features/events/api/events-api';
import { sessionsApi } from '@/features/sessions/api/sessions-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { uploadImageFile } from '@/shared/lib/upload-image';
import {
  EventWizardSessionsStep,
  publicSessionToDraft,
  type DraftSession,
} from '@/features/events/components/EventWizardSessionsStep';
import type { EventPayload, PublicEvent, UpsertCheckInFormPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

export type { EventFormMode, EventFormValues } from '@/features/events/components/event-form-utils';
export { toEventPayload, toSchedulePayload } from '@/features/events/components/event-form-utils';

const STEPS = [
  { id: 'details', label: 'Details', description: 'Dates, venue, and cover' },
  { id: 'sponsors', label: 'Sponsors', description: 'Link sponsors to this edition' },
  { id: 'memberships', label: 'Memberships', description: 'Choose tiers for this event' },
  { id: 'sessions', label: 'Sessions', description: 'Build the agenda' },
  { id: 'checkin', label: 'Check-in waiver', description: 'Required waiver form' },
] as const;

export interface EventEditResult {
  payload: EventPayload;
  sessions: DraftSession[];
  initialSessionIds: string[];
  checkInForm: UpsertCheckInFormPayload;
}

interface EventFormModalProps {
  open: boolean;
  mode: EventFormMode;
  initialEvent: PublicEvent | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (result: EventEditResult) => Promise<void> | void;
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
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<EventFormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const [pendingCoverPreview, setPendingCoverPreview] = useState<string | null>(null);
  const [draftSessions, setDraftSessions] = useState<DraftSession[]>([]);
  const [initialSessionIds, setInitialSessionIds] = useState<string[]>([]);
  const [checkInFormValues, setCheckInFormValues] = useState<CheckInFormValues>(
    freshWizardCheckInFormValues,
  );
  const [checkInFormErrors, setCheckInFormErrors] = useState<CheckInFormFieldErrors>({});

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSubmitted(false);
    setErrors({});
    setCheckInFormErrors({});
    setUploading(false);
    setPendingCover(null);
    setPendingCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setDraftSessions([]);
    setInitialSessionIds([]);
    setCheckInFormValues(freshWizardCheckInFormValues());
    if (mode === 'edit' && initialEvent) {
      setValues(eventToForm(initialEvent));
    }
  }, [open, mode, initialEvent]);

  const associationsQuery = useQuery({
    queryKey: ['events', initialEvent?.id, 'associations'],
    queryFn: () => eventsApi.getAssociations(initialEvent!.id),
    enabled: open && mode === 'edit' && Boolean(initialEvent?.id),
  });

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'edit', initialEvent?.id],
    queryFn: () => sessionsApi.list({ eventId: initialEvent!.id, perPage: 100 }),
    enabled: open && mode === 'edit' && Boolean(initialEvent?.id),
  });

  const checkInFormQuery = useQuery({
    queryKey: ['checkin-forms', 'edit', initialEvent?.id],
    queryFn: () => checkInFormsApi.getByEvent(initialEvent!.id),
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

  useEffect(() => {
    if (!open || mode !== 'edit' || !sessionsQuery.data) return;
    const drafts = sessionsQuery.data.items.map(publicSessionToDraft);
    setDraftSessions(drafts);
    setInitialSessionIds(sessionsQuery.data.items.map((session) => session.id));
  }, [open, mode, sessionsQuery.data]);

  useEffect(() => {
    if (!open || mode !== 'edit' || checkInFormQuery.isLoading) return;
    setCheckInFormValues(
      checkInFormQuery.data
        ? publicCheckInFormToValues(checkInFormQuery.data)
        : freshWizardCheckInFormValues(),
    );
  }, [open, mode, checkInFormQuery.data, checkInFormQuery.isLoading]);

  if (!open) return null;

  const busy = loading || uploading;
  const currentStep = STEPS[step]!;
  const isLastStep = step === STEPS.length - 1;
  const eventDays = eventDaysFromValues(values);
  const loadingStepData =
    associationsQuery.isLoading ||
    (step === 3 && sessionsQuery.isLoading) ||
    (step === 4 && checkInFormQuery.isLoading);

  function validateCheckInStep(): CheckInFormFieldErrors {
    return validateCheckInFormValues(checkInFormValues, {
      requireActive: true,
      requireContent: true,
    });
  }

  function handlePendingCoverChange(file: File | null, preview: string | null) {
    setPendingCoverPreview((prev) => {
      if (prev && prev !== preview) URL.revokeObjectURL(prev);
      return preview;
    });
    setPendingCover(file);
  }

  function validateCurrentStep(): FieldErrors {
    if (step === 0) {
      return validateEventForm(values, { mode, previousEvent: initialEvent });
    }
    return {};
  }

  function goNext() {
    setSubmitted(true);
    const nextErrors = validateCurrentStep();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitted(false);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
    setSubmitted(false);
    setErrors({});
    setCheckInFormErrors({});
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleFinish() {
    setSubmitted(true);
    const nextErrors = validateEventForm(values, { mode, previousEvent: initialEvent });
    const waiverErrors = validateCheckInStep();
    setErrors(nextErrors);
    setCheckInFormErrors(waiverErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStep(0);
      return;
    }
    if (Object.keys(waiverErrors).length > 0) {
      setStep(STEPS.length - 1);
      return;
    }

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

    const finalValues = { ...values, coverImage };
    await onSubmit({
      payload: toEventPayload(finalValues),
      sessions: draftSessions,
      initialSessionIds,
      checkInForm: toCheckInFormPayload(checkInFormValues),
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide event-wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="event-form-title">Edit edition</h2>
            <p className="muted wizard-step-caption">
              Step {step + 1} of {STEPS.length}: {currentStep.label}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <ol className="wizard-steps" aria-label="Event edit progress">
          {STEPS.map((item, index) => (
            <li
              key={item.id}
              className={index === step ? 'active' : index < step ? 'done' : ''}
              aria-current={index === step ? 'step' : undefined}
            >
              <span className="wizard-step-index">{index + 1}</span>
              <span className="wizard-step-copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </li>
          ))}
        </ol>

        <div className="modal-body event-form wizard-step-body">
          {loadingStepData ? (
            <Spinner />
          ) : null}

          {!loadingStepData && step === 0 ? (
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
          ) : null}

          {!loadingStepData && step === 1 ? (
            <EventAssociationPicker
              value={{
                sponsorIds: values.sponsorIds,
                membershipIds: values.membershipIds,
              }}
              showMemberships={false}
              allowCreateSponsor
              disabled={busy}
              hint="Select sponsors for this edition, or create a new sponsor here."
              onChange={(next) =>
                setValues((current) => ({
                  ...current,
                  sponsorIds: next.sponsorIds,
                }))
              }
            />
          ) : null}

          {!loadingStepData && step === 2 ? (
            <EventAssociationPicker
              value={{
                sponsorIds: values.sponsorIds,
                membershipIds: values.membershipIds,
              }}
              showSponsors={false}
              disabled={busy}
              hint="Link membership tiers to this edition. These tiers can be assigned to sessions in the next step."
              onChange={(next) =>
                setValues((current) => ({
                  ...current,
                  membershipIds: next.membershipIds,
                }))
              }
            />
          ) : null}

          {!loadingStepData && step === 3 ? (
            <EventWizardSessionsStep
              eventDays={eventDays}
              linkedMembershipIds={values.membershipIds}
              sessions={draftSessions}
              disabled={busy}
              onChange={setDraftSessions}
            />
          ) : null}

          {!loadingStepData && step === 4 ? (
            <EventWizardCheckInFormStep
              values={checkInFormValues}
              errors={checkInFormErrors}
              disabled={busy}
              onChange={(next) => {
                setCheckInFormValues(next);
                if (submitted) {
                  setCheckInFormErrors(
                    validateCheckInFormValues(next, {
                      requireActive: true,
                      requireContent: true,
                    }),
                  );
                }
              }}
            />
          ) : null}
        </div>

        <div className="modal-actions wizard-footer">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <div className="wizard-footer-nav">
            {step > 0 ? (
              <Button type="button" variant="secondary" onClick={goBack} disabled={busy}>
                Back
              </Button>
            ) : null}
            {isLastStep ? (
              <Button type="button" loading={busy} onClick={() => void handleFinish()}>
                Save changes
              </Button>
            ) : (
              <Button type="button" onClick={goNext} disabled={busy || loadingStepData}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
