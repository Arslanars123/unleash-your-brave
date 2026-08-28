import type {
  CheckInFormFieldType,
  PublicCheckInForm,
  UpsertCheckInFormPayload,
} from '@/shared/types/api';

export interface CheckInFormFieldRow {
  key: string;
  id?: string;
  label: string;
  type: CheckInFormFieldType;
  required: boolean;
}

export interface CheckInFormValues {
  title: string;
  description: string;
  requireSignature: boolean;
  isActive: boolean;
  fields: CheckInFormFieldRow[];
}

export type CheckInFormFieldErrors = Partial<Record<string, string>>;

export const CHECKIN_FIELD_TYPES: { value: CheckInFormFieldType; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'yes_no', label: 'Yes / No' },
];

function newKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyCheckInFormField(): CheckInFormFieldRow {
  return { key: newKey(), label: '', type: 'yes_no', required: true };
}

export const emptyCheckInFormValues: CheckInFormValues = {
  title: 'Check-in waiver',
  description: '',
  requireSignature: true,
  isActive: true,
  fields: [],
};

/** Defaults for the schedule wizard — one question row ready to edit. */
export const wizardCheckInFormDefaults: CheckInFormValues = {
  title: 'Check-in waiver',
  description: '',
  requireSignature: true,
  isActive: true,
  fields: [
    {
      key: 'wizard-default-1',
      label: 'I agree to the event terms and waiver',
      type: 'yes_no',
      required: true,
    },
  ],
};

export function freshWizardCheckInFormValues(): CheckInFormValues {
  return {
    ...wizardCheckInFormDefaults,
    fields: wizardCheckInFormDefaults.fields.map((field) => ({
      ...field,
      key: newKey(),
    })),
  };
}

export function publicCheckInFormToValues(form: PublicCheckInForm | null): CheckInFormValues {
  if (!form) return { ...emptyCheckInFormValues, fields: [] };
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

export function validateCheckInFormValues(
  values: CheckInFormValues,
  options?: { requireActive?: boolean; requireContent?: boolean },
): CheckInFormFieldErrors {
  const requireActive = options?.requireActive ?? false;
  const requireContent = options?.requireContent ?? false;
  const errors: CheckInFormFieldErrors = {};

  if (!values.title.trim()) {
    errors.title = 'Title is required';
  }

  if (requireActive && !values.isActive) {
    errors.isActive = 'The waiver must be active for check-in';
  }

  values.fields.forEach((field, index) => {
    if (!field.label.trim()) {
      errors[`field-${index}`] = 'Label is required';
    }
  });

  if (requireContent) {
    const hasValidField = values.fields.some((field) => field.label.trim().length > 0);
    if (!hasValidField && !values.requireSignature) {
      errors.fields =
        'Add at least one waiver question or enable “Require signature”';
    }
  }

  return errors;
}

export function toCheckInFormPayload(values: CheckInFormValues): UpsertCheckInFormPayload {
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
