import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { checkInFormsApi } from '@/features/checkin-forms/api/checkin-forms-api';
import {
  emptyCheckInFormValues,
  publicCheckInFormToValues,
  toCheckInFormPayload,
  validateCheckInFormValues,
  type CheckInFormFieldErrors,
  type CheckInFormValues,
} from '@/features/checkin-forms/checkin-form-utils';
import { CheckInFormEditorFields } from '@/features/checkin-forms/components/CheckInFormEditorFields';
import { getApiErrorMessage } from '@/shared/api/client';
import type { PublicCheckInForm } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/toast';

interface CheckInFormEditorModalProps {
  open: boolean;
  eventId: string;
  loading?: boolean;
  onClose: () => void;
  onSaved?: (form: PublicCheckInForm) => void;
}

export function CheckInFormEditorModal({
  open,
  eventId,
  loading = false,
  onClose,
  onSaved,
}: CheckInFormEditorModalProps) {
  const toast = useToast();
  const [values, setValues] = useState<CheckInFormValues>(emptyCheckInFormValues);
  const [errors, setErrors] = useState<CheckInFormFieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !eventId) return;
    let cancelled = false;
    setSubmitted(false);
    setErrors({});
    setFetching(true);
    void checkInFormsApi
      .getByEvent(eventId)
      .then((form) => {
        if (!cancelled) setValues(publicCheckInFormToValues(form));
      })
      .catch((error) => {
        if (!cancelled) {
          setValues(emptyCheckInFormValues);
          toast.error(getApiErrorMessage(error, 'Unable to load check-in form'));
        }
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, eventId]);

  if (!open) return null;

  function setForm(next: CheckInFormValues) {
    setValues(next);
    if (submitted) setErrors(validateCheckInFormValues(next));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const nextErrors = validateCheckInFormValues(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const saved = await checkInFormsApi.upsertByEvent(eventId, toCheckInFormPayload(values));
      toast.success('Check-in form saved');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to save check-in form'));
    } finally {
      setSaving(false);
    }
  }

  const busy = loading || fetching || saving;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-form-editor-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="checkin-form-editor-title">Check-in form</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form className="modal-body event-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          <p className="hint" style={{ marginTop: 0 }}>
            When active, scanners must complete this form (and signature, if required) before
            check-in is recorded for this edition.
          </p>

          {fetching ? <p className="muted">Loading form…</p> : null}

          <CheckInFormEditorFields
            values={values}
            errors={errors}
            disabled={busy}
            onChange={setForm}
          />

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={busy}>
              Save form
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
