import type {
  CheckInForm,
  CheckInFormSubmission,
} from './checkin-form.types.js';

export interface CheckInFormRepository {
  findById(id: string): Promise<CheckInForm | null>;
  findByEventId(eventId: string): Promise<CheckInForm | null>;
  findActiveByEventId(eventId: string): Promise<CheckInForm | null>;
  create(data: Omit<CheckInForm, 'id' | 'createdAt' | 'updatedAt'>): Promise<CheckInForm>;
  update(
    id: string,
    data: Partial<Omit<CheckInForm, 'id' | 'createdAt'>>,
  ): Promise<CheckInForm | null>;
  deleteByEventId(eventId: string): Promise<boolean>;

  findSubmissionByEventAndUser(
    eventId: string,
    userId: string,
  ): Promise<CheckInFormSubmission | null>;
  listSubmissionsByEvent(eventId: string): Promise<CheckInFormSubmission[]>;
  createSubmission(
    data: Omit<CheckInFormSubmission, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CheckInFormSubmission>;
  updateSubmission(
    id: string,
    data: Partial<Omit<CheckInFormSubmission, 'id' | 'createdAt'>>,
  ): Promise<CheckInFormSubmission | null>;
}
