import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  CHECKIN_FIELD_TYPES,
  emptyCheckInFormField,
  type CheckInFormFieldErrors,
  type CheckInFormValues,
} from '@/features/checkin-forms/checkin-form-utils';
import type { CheckInFormFieldType } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';

interface CheckInFormEditorFieldsProps {
  values: CheckInFormValues;
  errors: CheckInFormFieldErrors;
  disabled?: boolean;
  /** When true, waiver must stay active (event setup). */
  lockActive?: boolean;
  onChange: (values: CheckInFormValues) => void;
}

export function CheckInFormEditorFields({
  values,
  errors,
  disabled = false,
  lockActive = false,
  onChange,
}: CheckInFormEditorFieldsProps) {
  function setForm(next: CheckInFormValues) {
    onChange(next);
  }

  function updateField(index: number, patch: Partial<CheckInFormValues['fields'][number]>) {
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

  return (
    <>
      <Input
        label="Title"
        name="title"
        requiredMark
        value={values.title}
        error={errors.title}
        disabled={disabled}
        onChange={(e) => setForm({ ...values, title: e.target.value })}
      />
      <TextArea
        label="Description"
        name="description"
        value={values.description}
        disabled={disabled}
        onChange={(e) => setForm({ ...values, description: e.target.value })}
        placeholder="Optional instructions shown at the door"
      />

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={values.isActive}
          disabled={disabled || lockActive}
          onChange={(e) => setForm({ ...values, isActive: e.target.checked })}
        />
        <span>
          <strong>Active</strong> — require this form before check-in
          {lockActive ? ' (required for new events)' : ''}
        </span>
      </label>
      {errors.isActive ? <p className="form-error">{errors.isActive}</p> : null}

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={values.requireSignature}
          disabled={disabled}
          onChange={(e) => setForm({ ...values, requireSignature: e.target.checked })}
        />
        <span>
          <strong>Require signature</strong> — collect a drawn signature and signed name
        </span>
      </label>

      <fieldset className="schedule-fieldset">
        <legend>Waiver questions</legend>
        <p className="hint">
          Add questions attendees answer at check-in. Reorder with the arrows.
        </p>
        {errors.fields ? <p className="form-error">{errors.fields}</p> : null}

        {values.fields.length === 0 ? (
          <p className="muted">No questions yet — enable signature above or add a field.</p>
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
                disabled={disabled}
                onChange={(e) => updateField(index, { label: e.target.value })}
              />
              <label className="field">
                <span className="field-label">Type</span>
                <select
                  className="field-input"
                  value={field.type}
                  disabled={disabled}
                  onChange={(e) =>
                    updateField(index, { type: e.target.value as CheckInFormFieldType })
                  }
                >
                  {CHECKIN_FIELD_TYPES.map((option) => (
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
                  disabled={disabled}
                  onChange={(e) => updateField(index, { required: e.target.checked })}
                />
                <span>Required</span>
              </label>
              <div style={{ display: 'flex', gap: 4, marginTop: 18 }}>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled || index === 0}
                  onClick={() => moveField(index, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled || index === values.fields.length - 1}
                  onClick={() => moveField(index, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled}
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
            disabled={disabled}
            onClick={() =>
              setForm({ ...values, fields: [...values.fields, emptyCheckInFormField()] })
            }
          >
            <Plus size={16} />
            Add field
          </Button>
        </div>
      </fieldset>
    </>
  );
}
