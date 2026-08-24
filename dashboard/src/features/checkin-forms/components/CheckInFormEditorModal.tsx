import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { checkInFormsApi } from '@/features/checkin-forms/api/checkin-forms-api';
import { getApiErrorMessage } from '@/shared/api/client';
import type {
  CheckInFormFieldType,
  PublicCheckInForm,
  UpsertCheckInFormPayload,
} from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';
import { useToast } from '@/shared/ui/toast';

interface FieldRow {
  key: string;
  id?: string;
  label: string;
  type: CheckInFormFieldType;
  required: boolean;
}

interface FormValues {
  title: string;
  description: string;
  requireSignature: boolean;
  isActive: boolean;
  fields: FieldRow[];
}

type FieldErrors = Partial<Record<string, string>>;

const FIELD_TYPES: { value: CheckInFormFieldType; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'yes_no', label: 'Yes / No' },
];

function newKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyField(): FieldRow {
  return { key: newKey(), label: '', type: 'text', required: false };
}

const emptyForm: FormValues = {
  title: 'Check-in form',
  description: '',
  requireSignature: true,
  isActive: true,
  fields: [],
};

function formToValues(form: PublicCheckInForm | null): FormValues {
  if (!form) return { ...emptyForm, fields: [] };
  return {
    title: form.title,
    description: form.description ?? '',
    requireSignature: form.requireSignature,
    isActive: form.isActive,
    fields: [...(form.fields ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((field) => ({
        key: field.id || newKey(),
        id: field.id,
        label: field.label,
        type: field.type,
        required: field.required,
      })),
  };
}

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.title.trim()) errors.title = 'Title is required';
  values.fields.forEach((field, index) => {
    if (!field.label.trim()) {
      errors[`field-${index}`] = 'Label is required';
    }
  });
  return errors;
}

function toPayload(values: FormValues): UpsertCheckInFormPayload {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    requireSignature: values.requireSignature,
    isActive: values.isActive,
    fields: values.fields.map((field, index) => ({
      ...(field.id ? { id: field.id } : {}),
      label: field.label.trim(),
      type: field.type,
      required: field.required,
      sortOrder: index,
    })),
  };
}

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
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
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
        if (!cancelled) setValues(formToValues(form));
      })
      .catch((error) => {
        if (!cancelled) {
          setValues(emptyForm);
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

  function setForm(next: FormValues) {
    setValues(next);
    if (submitted) setErrors(validate(next));
  }

  function updateField(index: number, patch: Partial<FieldRow>) {
    setForm({
      ...values,
      fields: values.fields.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    });
  }

  function moveField(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= values.fields.length) return;
    const fields = [...values.fields];
    const [item] = fields.splice(index, 1);
    fields.splice(target, 0, item!);
    setForm({ ...values, fields });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const saved = await checkInFormsApi.upsertByEvent(eventId, toPayload(values));
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

          <Input
            label="Title"
            name="title"
            requiredMark
            value={values.title}
            error={errors.title}
            disabled={busy}
            onChange={(e) => setForm({ ...values, title: e.target.value })}
          />
          <TextArea
            label="Description"
            name="description"
            value={values.description}
            disabled={busy}
            onChange={(e) => setForm({ ...values, description: e.target.value })}
            placeholder="Optional instructions shown at the door"
          />

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={values.isActive}
              disabled={busy}
              onChange={(e) => setForm({ ...values, isActive: e.target.checked })}
            />
            <span>
              <strong>Active</strong> — require this form before check-in
            </span>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={values.requireSignature}
              disabled={busy}
              onChange={(e) => setForm({ ...values, requireSignature: e.target.checked })}
            />
            <span>
              <strong>Require signature</strong> — collect a drawn signature and signed name
            </span>
          </label>

          <fieldset className="schedule-fieldset">
            <legend>Fields</legend>
            <p className="hint">Add questions attendees answer at check-in. Reorder with the arrows.</p>

            {values.fields.length === 0 ? (
              <p className="muted">No fields yet — signature-only forms are allowed.</p>
            ) : null}

            <div className="day-list">
              {values.fields.map((field, index) => (
                <div className="day-row" key={field.key} style={{ alignItems: 'flex-start' }}>
                  <div className="day-row-index">{index + 1}</div>
                  <Input
                    label="Label"
                    name={`field-label-${index}`}
                    requiredMark
                    value={field.label}
                    error={errors[`field-${index}`]}
                    disabled={busy}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                  />
                  <label className="field">
                    <span className="field-label">Type</span>
                    <select
                      className="field-input"
                      value={field.type}
                      disabled={busy}
                      onChange={(e) =>
                        updateField(index, { type: e.target.value as CheckInFormFieldType })
                      }
                    >
                      {FIELD_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="checkbox-row" style={{ marginTop: 22 }}>
                    <input
                      type="checkbox"
                      checked={field.required}
                      disabled={busy}
                      onChange={(e) => updateField(index, { required: e.target.checked })}
                    />
                    <span>Required</span>
                  </label>
                  <div style={{ display: 'flex', gap: 4, marginTop: 18 }}>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy || index === 0}
                      onClick={() => moveField(index, -1)}
                      aria-label="Move up"
                    >
                      <ArrowUp size={16} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy || index === values.fields.length - 1}
                      onClick={() => moveField(index, 1)}
                      aria-label="Move down"
                    >
                      <ArrowDown size={16} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        setForm({
                          ...values,
                          fields: values.fields.filter((_, i) => i !== index),
                        })
                      }
                      aria-label="Remove field"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setForm({ ...values, fields: [...values.fields, emptyField()] })}
              >
                <Plus size={16} />
                Add field
              </Button>
            </div>
          </fieldset>

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
