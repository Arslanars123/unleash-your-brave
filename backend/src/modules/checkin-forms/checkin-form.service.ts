import { randomUUID } from 'node:crypto';
import { BadRequestError, NotFoundError } from '../../core/errors/app-error.js';
import type { EventService } from '../events/event.service.js';
import {
  toPublicCheckInForm,
  toPublicCheckInFormSubmission,
} from './checkin-form.mapper.js';
import type { CheckInFormRepository } from './checkin-form.repository.js';
import type {
  CheckInForm,
  CheckInFormField,
  CheckInFormSubmission,
  PublicCheckInForm,
  PublicCheckInFormSubmission,
  SubmitCheckInFormInput,
  UpsertCheckInFormInput,
} from './checkin-form.types.js';

export class CheckInFormService {
  constructor(
    private readonly forms: CheckInFormRepository,
    private readonly events: EventService,
  ) {}

  async getActiveByEvent(eventId: string): Promise<PublicCheckInForm | null> {
    await this.requireEvent(eventId);
    const form = await this.forms.findActiveByEventId(eventId);
    return form ? toPublicCheckInForm(form) : null;
  }

  /** Internal: active form entity for check-in flow. */
  async findActiveForm(eventId: string): Promise<CheckInForm | null> {
    return this.forms.findActiveByEventId(eventId);
  }

  async getByEvent(eventId: string): Promise<PublicCheckInForm | null> {
    await this.requireEvent(eventId);
    const form = await this.forms.findByEventId(eventId);
    return form ? toPublicCheckInForm(form) : null;
  }

  async upsertByEvent(eventId: string, input: UpsertCheckInFormInput): Promise<PublicCheckInForm> {
    await this.requireEvent(eventId);
    const fields = this.normalizeFields(input.fields);
    const existing = await this.forms.findByEventId(eventId);

    if (existing) {
      const updated = await this.forms.update(existing.id, {
        title: input.title.trim(),
        description: input.description?.trim() ?? '',
        fields,
        requireSignature: input.requireSignature ?? true,
        isActive: input.isActive ?? true,
      });
      if (!updated) throw new NotFoundError('Check-in form');
      return toPublicCheckInForm(updated);
    }

    const created = await this.forms.create({
      eventId,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      fields,
      requireSignature: input.requireSignature ?? true,
      isActive: input.isActive ?? true,
    });
    return toPublicCheckInForm(created);
  }

  async deleteByEvent(eventId: string): Promise<void> {
    await this.requireEvent(eventId);
    if (!(await this.forms.deleteByEventId(eventId))) {
      throw new NotFoundError('Check-in form');
    }
  }

  async getMySubmission(
    userId: string,
    eventId: string,
  ): Promise<PublicCheckInFormSubmission | null> {
    await this.requireEvent(eventId);
    const submission = await this.forms.findSubmissionByEventAndUser(eventId, userId);
    return submission ? toPublicCheckInFormSubmission(submission) : null;
  }

  /** Attendee self-submit before or at the door (staff scan still works after). */
  async submitForMember(
    userId: string,
    eventId: string,
    input: SubmitCheckInFormInput,
  ): Promise<PublicCheckInFormSubmission> {
    await this.requireEvent(eventId);
    const form = await this.forms.findActiveByEventId(eventId);
    if (!form) {
      throw new NotFoundError('Check-in form');
    }
    const submission = await this.saveSubmission(form, userId, input);
    return toPublicCheckInFormSubmission(submission);
  }

  async findSubmission(
    eventId: string,
    userId: string,
  ): Promise<CheckInFormSubmission | null> {
    return this.forms.findSubmissionByEventAndUser(eventId, userId);
  }

  async listSubmissions(eventId: string): Promise<PublicCheckInFormSubmission[]> {
    await this.requireEvent(eventId);
    const items = await this.forms.listSubmissionsByEvent(eventId);
    return items.map(toPublicCheckInFormSubmission);
  }

  /**
   * Validate answers against the active form and persist a submission
   * (or refresh an existing one that is not yet linked to a check-in).
   */
  async saveSubmission(
    form: CheckInForm,
    userId: string,
    input: SubmitCheckInFormInput,
  ): Promise<CheckInFormSubmission> {
    const answers = this.validateAnswers(form, input.answers);
    const signedName = input.signedName.trim();
    if (!signedName) {
      throw new BadRequestError('Signed name is required');
    }

    const signatureDataUrl = input.signatureDataUrl?.trim() ?? '';
    if (form.requireSignature !== false && !signatureDataUrl) {
      throw new BadRequestError('Signature is required for this check-in form');
    }

    const existing = await this.forms.findSubmissionByEventAndUser(form.eventId, userId);
    const now = new Date();

    if (existing) {
      if (existing.checkInId) {
        throw new BadRequestError('Check-in form already submitted for this event');
      }
      const updated = await this.forms.updateSubmission(existing.id, {
        formId: form.id,
        answers,
        signatureDataUrl,
        signedName,
        submittedAt: now,
      });
      if (!updated) throw new NotFoundError('Check-in form submission');
      return updated;
    }

    return this.forms.createSubmission({
      formId: form.id,
      eventId: form.eventId,
      userId,
      checkInId: null,
      answers,
      signatureDataUrl,
      signedName,
      submittedAt: now,
    });
  }

  async linkSubmissionToCheckIn(
    submissionId: string,
    checkInId: string,
  ): Promise<CheckInFormSubmission> {
    const updated = await this.forms.updateSubmission(submissionId, { checkInId });
    if (!updated) throw new NotFoundError('Check-in form submission');
    return updated;
  }

  private normalizeFields(
    fields: UpsertCheckInFormInput['fields'],
  ): CheckInFormField[] {
    return fields.map((field, index) => ({
      id: field.id?.trim() || randomUUID(),
      label: field.label.trim(),
      type: field.type,
      required: field.required ?? false,
      sortOrder: field.sortOrder ?? index,
    }));
  }

  private validateAnswers(
    form: CheckInForm,
    answers: Record<string, string | boolean>,
  ): Record<string, string | boolean> {
    const normalized: Record<string, string | boolean> = {};
    const fieldIds = new Set(form.fields.map((f) => f.id));

    for (const key of Object.keys(answers)) {
      if (!fieldIds.has(key)) {
        throw new BadRequestError(`Unknown form field: ${key}`);
      }
    }

    for (const field of form.fields) {
      const raw = answers[field.id];
      if (raw === undefined || raw === null) {
        if (field.required) {
          throw new BadRequestError(`Field "${field.label}" is required`);
        }
        continue;
      }

      if (field.type === 'checkbox' || field.type === 'yes_no') {
        if (typeof raw !== 'boolean') {
          throw new BadRequestError(`Field "${field.label}" must be yes/no`);
        }
        if (field.required && field.type === 'checkbox' && raw !== true) {
          throw new BadRequestError(`Field "${field.label}" must be checked`);
        }
        normalized[field.id] = raw;
        continue;
      }

      if (typeof raw !== 'string') {
        throw new BadRequestError(`Field "${field.label}" must be text`);
      }
      const text = raw.trim();
      if (field.required && !text) {
        throw new BadRequestError(`Field "${field.label}" is required`);
      }
      normalized[field.id] = text;
    }

    return normalized;
  }

  private async requireEvent(eventId: string): Promise<void> {
    const event = await this.events.getById(eventId);
    if (!event) throw new NotFoundError('Event');
  }
}
