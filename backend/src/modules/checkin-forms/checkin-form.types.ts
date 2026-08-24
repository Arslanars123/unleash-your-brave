export type CheckInFormFieldType = 'text' | 'textarea' | 'checkbox' | 'yes_no';

export interface CheckInFormField {
  id: string;
  label: string;
  type: CheckInFormFieldType;
  required: boolean;
  sortOrder: number;
}

export interface CheckInForm {
  id: string;
  eventId: string;
  title: string;
  description: string;
  fields: CheckInFormField[];
  requireSignature: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicCheckInForm {
  id: string;
  eventId: string;
  title: string;
  description: string;
  fields: CheckInFormField[];
  requireSignature: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CheckInFormSubmission {
  id: string;
  formId: string;
  eventId: string;
  userId: string;
  checkInId: string | null;
  answers: Record<string, string | boolean>;
  signatureDataUrl: string;
  signedName: string;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicCheckInFormSubmission {
  id: string;
  formId: string;
  eventId: string;
  userId: string;
  checkInId: string | null;
  answers: Record<string, string | boolean>;
  signatureDataUrl: string;
  signedName: string;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertCheckInFormInput {
  title: string;
  description?: string;
  fields: Array<{
    id?: string;
    label: string;
    type: CheckInFormFieldType;
    required?: boolean;
    sortOrder?: number;
  }>;
  requireSignature?: boolean;
  isActive?: boolean;
}

export interface SubmitCheckInFormInput {
  answers: Record<string, string | boolean>;
  signatureDataUrl?: string;
  signedName: string;
}
