import type {
  CheckInForm,
  CheckInFormSubmission,
  PublicCheckInForm,
  PublicCheckInFormSubmission,
} from './checkin-form.types.js';

export function toPublicCheckInForm(form: CheckInForm): PublicCheckInForm {
  return {
    id: form.id,
    eventId: form.eventId,
    title: form.title,
    description: form.description ?? '',
    fields: [...(form.fields ?? [])]
      .map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type,
        required: Boolean(field.required),
        sortOrder: field.sortOrder ?? 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
    requireSignature: form.requireSignature !== false,
    isActive: Boolean(form.isActive),
    createdAt: form.createdAt.toISOString(),
    updatedAt: form.updatedAt.toISOString(),
  };
}

export function toPublicCheckInFormSubmission(
  submission: CheckInFormSubmission,
): PublicCheckInFormSubmission {
  return {
    id: submission.id,
    formId: submission.formId,
    eventId: submission.eventId,
    userId: submission.userId,
    checkInId: submission.checkInId ?? null,
    answers: submission.answers ?? {},
    signatureDataUrl: submission.signatureDataUrl ?? '',
    signedName: submission.signedName ?? '',
    submittedAt: submission.submittedAt.toISOString(),
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
  };
}
