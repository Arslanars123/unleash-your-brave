import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { getDb } from '../mongo.js';
import type { CheckInFormRepository } from '../../modules/checkin-forms/checkin-form.repository.js';
import type {
  CheckInForm,
  CheckInFormSubmission,
} from '../../modules/checkin-forms/checkin-form.types.js';

export class MongoCheckInFormRepository implements CheckInFormRepository {
  private get forms(): Collection<MongoDoc<CheckInForm>> {
    return getDb().collection<MongoDoc<CheckInForm>>('checkin_forms');
  }

  private get submissions(): Collection<MongoDoc<CheckInFormSubmission>> {
    return getDb().collection<MongoDoc<CheckInFormSubmission>>('checkin_form_submissions');
  }

  async ensureIndexes(): Promise<void> {
    await this.forms.createIndex(
      { eventId: 1 },
      { unique: true, name: 'checkin_forms_eventId_unique' },
    );
    await this.submissions.createIndex(
      { eventId: 1, userId: 1 },
      { unique: true, name: 'checkin_form_submissions_event_user_unique' },
    );
    await this.submissions.createIndex(
      { formId: 1, submittedAt: -1 },
      { name: 'checkin_form_submissions_form_submitted' },
    );
    await this.submissions.createIndex(
      { eventId: 1, submittedAt: -1 },
      { name: 'checkin_form_submissions_event_submitted' },
    );
  }

  async findById(id: string): Promise<CheckInForm | null> {
    return fromDoc<CheckInForm>(await this.forms.findOne({ _id: id }));
  }

  async findByEventId(eventId: string): Promise<CheckInForm | null> {
    return fromDoc<CheckInForm>(await this.forms.findOne({ eventId }));
  }

  async findActiveByEventId(eventId: string): Promise<CheckInForm | null> {
    return fromDoc<CheckInForm>(
      await this.forms.findOne({ eventId, isActive: true }),
    );
  }

  async create(data: Omit<CheckInForm, 'id' | 'createdAt' | 'updatedAt'>): Promise<CheckInForm> {
    const now = new Date();
    const form: CheckInForm = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await this.forms.insertOne(toDoc(form));
    return form;
  }

  async update(
    id: string,
    data: Partial<Omit<CheckInForm, 'id' | 'createdAt'>>,
  ): Promise<CheckInForm | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated: CheckInForm = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    await this.forms.replaceOne({ _id: id }, toDoc(updated));
    return updated;
  }

  async deleteByEventId(eventId: string): Promise<boolean> {
    const result = await this.forms.deleteOne({ eventId });
    return result.deletedCount === 1;
  }

  async findSubmissionByEventAndUser(
    eventId: string,
    userId: string,
  ): Promise<CheckInFormSubmission | null> {
    return fromDoc<CheckInFormSubmission>(
      await this.submissions.findOne({ eventId, userId }),
    );
  }

  async listSubmissionsByEvent(eventId: string): Promise<CheckInFormSubmission[]> {
    const docs = await this.submissions
      .find({ eventId })
      .sort({ submittedAt: -1 })
      .toArray();
    return fromDocs<CheckInFormSubmission>(docs);
  }

  async createSubmission(
    data: Omit<CheckInFormSubmission, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CheckInFormSubmission> {
    const now = new Date();
    const submission: CheckInFormSubmission = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await this.submissions.insertOne(toDoc(submission));
    return submission;
  }

  async updateSubmission(
    id: string,
    data: Partial<Omit<CheckInFormSubmission, 'id' | 'createdAt'>>,
  ): Promise<CheckInFormSubmission | null> {
    const existing = fromDoc<CheckInFormSubmission>(
      await this.submissions.findOne({ _id: id }),
    );
    if (!existing) return null;
    const updated: CheckInFormSubmission = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    await this.submissions.replaceOne({ _id: id }, toDoc(updated));
    return updated;
  }
}
