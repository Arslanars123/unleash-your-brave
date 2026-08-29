import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { EventAssociationPicker } from '@/features/events/components/EventAssociationPicker';
import { EventFormDetailsStep } from '@/features/events/components/EventFormDetailsStep';
import {
  emptyForm,
  eventDaysFromValues,
  scheduleBlankForm,
  toSchedulePayload,
  validateEventForm,
  validateEventMemberships,
  type EventFormValues,
  type FieldErrors,
} from '@/features/events/components/event-form-utils';
import { EventWizardCheckInFormStep } from '@/features/events/components/EventWizardCheckInFormStep';
import {
  freshWizardCheckInFormValues,
  toCheckInFormPayload,
  validateCheckInFormValues,
  type CheckInFormFieldErrors,
  type CheckInFormValues,
} from '@/features/checkin-forms/checkin-form-utils';
import {
  draftSessionsToPayloads,
  EventWizardSessionsStep,
  type DraftSession,
} from '@/features/events/components/EventWizardSessionsStep';
import { getApiErrorMessage } from '@/shared/api/client';
import { uploadImageFile } from '@/shared/lib/upload-image';
import type {
  PublicEvent,
  ScheduleEventPayload,
  SessionPayload,
  UpsertCheckInFormPayload,
} from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/toast';

const STEPS = [
  { id: 'details', label: 'Details', description: 'Dates, venue, and cover' },
  { id: 'sponsors', label: 'Sponsors', description: 'Link sponsors to this edition' },
  { id: 'memberships', label: 'Memberships', description: 'Choose tiers for this event' },
  { id: 'sessions', label: 'Sessions', description: 'Build the agenda' },
  { id: 'checkin', label: 'Check-in waiver', description: 'Required waiver form' },
] as const;

export interface EventWizardResult {
  payload: ScheduleEventPayload;
  sessions: SessionPayload[];
  checkInForm: UpsertCheckInFormPayload;
}

interface EventWizardModalProps {
  open: boolean;
  previousEvent: PublicEvent | null;
  otherEditions?: PublicEvent[];
  loading?: boolean;
  onClose: () => void;
  onComplete: (result: EventWizardResult) => Promise<void> | void;
}

export function EventWizardModal({
  open,
  previousEvent,
  otherEditions = [],
  loading = false,
  onClose,
  onComplete,
}: EventWizardModalProps) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<EventFormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const [pendingCoverPreview, setPendingCoverPreview] = useState<string | null>(null);
  const [draftSessions, setDraftSessions] = useState<DraftSession[]>([]);
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
    setCheckInFormValues(freshWizardCheckInFormValues());
    setValues(scheduleBlankForm(previousEvent));
  }, [open, previousEvent]);

  if (!open) return null;

  const busy = loading || uploading;
  const currentStep = STEPS[step]!;
  const isLastStep = step === STEPS.length - 1;
  const eventDays = eventDaysFromValues(values);

  function handlePendingCoverChange(file: File | null, preview: string | null) {
    setPendingCoverPreview((prev) => {
      if (prev && prev !== preview) URL.revokeObjectURL(prev);
      return preview;
    });
    setPendingCover(file);
  }

  function validateCheckInStep(): CheckInFormFieldErrors {
    return validateCheckInFormValues(checkInFormValues, {
      requireActive: true,
      requireContent: true,
    });
  }

  function validateCurrentStep(): FieldErrors {
    if (step === 0) {
      return validateEventForm(values, {
        mode: 'schedule',
        previousEvent,
        otherEditions,
      });
    }
    if (step === 2) {
      const membershipError = validateEventMemberships(values.membershipIds);
      return membershipError ? { membershipIds: membershipError } : {};
    }
    return {};
  }

  function goNext() {
    setSubmitted(true);
    const nextErrors = validateCurrentStep();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error('Fix the highlighted fields below to continue.');
      return;
    }
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
    const nextErrors = validateEventForm(values, {
      mode: 'schedule',
      previousEvent,
      otherEditions,
    });
    const membershipError = validateEventMemberships(values.membershipIds);
    if (membershipError) nextErrors.membershipIds = membershipError;
    const waiverErrors = validateCheckInStep();
    setErrors(nextErrors);
    setCheckInFormErrors(waiverErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStep(nextErrors.membershipIds ? 2 : 0);
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
    await onComplete({
      payload: toSchedulePayload(finalValues),
      sessions: draftSessionsToPayloads(draftSessions),
      checkInForm: toCheckInFormPayload(checkInFormValues),
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide event-wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-wizard-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="event-wizard-title">Schedule new event</h2>
            <p className="muted wizard-step-caption">
              Step {step + 1} of {STEPS.length}: {currentStep.label}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <ol className="wizard-steps" aria-label="Event setup progress">
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
          {step === 0 ? (
            <EventFormDetailsStep
              mode="schedule"
              initialEvent={previousEvent}
              otherEditions={otherEditions}
              values={values}
              errors={errors}
              loading={busy}
              uploading={uploading}
              pendingCover={pendingCover}
              pendingCoverPreview={pendingCoverPreview}
              onChange={(next) => {
                setValues(next);
                if (submitted) {
                  setErrors(
                    validateEventForm(next, {
                      mode: 'schedule',
                      previousEvent,
                      otherEditions,
                    }),
                  );
                }
              }}
              onPendingCoverChange={handlePendingCoverChange}
              onCoverUploadError={(message) => toast.error(message)}
            />
          ) : null}

          {step === 1 ? (
            <EventAssociationPicker
              value={{
                sponsorIds: values.sponsorIds,
                membershipIds: values.membershipIds,
              }}
              showMemberships={false}
              allowCreateSponsor
              disabled={busy}
              hint="Select sponsors for this edition, or create a new sponsor here. You can skip this step and add sponsors later."
              onChange={(next) =>
                setValues((current) => ({
                  ...current,
                  sponsorIds: next.sponsorIds,
                }))
              }
            />
          ) : null}

          {step === 2 ? (
            <>
              <EventAssociationPicker
                value={{
                  sponsorIds: values.sponsorIds,
                  membershipIds: values.membershipIds,
                }}
                showSponsors={false}
                disabled={busy}
                hint="Link membership tiers to this edition. These tiers can be assigned to sessions in the next step."
                membershipError={submitted ? errors.membershipIds : undefined}
                onChange={(next) => {
                  setValues((current) => ({
                    ...current,
                    membershipIds: next.membershipIds,
                  }));
                  if (submitted) {
                    const membershipError = validateEventMemberships(next.membershipIds);
                    setErrors((current) => {
                      const updated = { ...current };
                      if (membershipError) updated.membershipIds = membershipError;
                      else delete updated.membershipIds;
                      return updated;
                    });
                  }
                }}
              />
            </>
          ) : null}

          {step === 3 ? (
            <EventWizardSessionsStep
              eventDays={eventDays}
              linkedMembershipIds={values.membershipIds}
              sessions={draftSessions}
              disabled={busy}
              onChange={setDraftSessions}
            />
          ) : null}

          {step === 4 ? (
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
                Schedule event
              </Button>
            ) : (
              <Button type="button" onClick={goNext} disabled={busy}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
