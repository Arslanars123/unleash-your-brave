import type { Collection, Filter } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { containsCi, getDb } from '../mongo.js';

export type TeamMemberStatus = 'active' | 'suspended' | 'deactivated';

/** Desk-team account — separate from attendees/speakers/sponsors/admins. */
export interface TeamMemberRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  status: TeamMemberStatus;
  passwordResetOtpHash: string | null;
  passwordResetOtpExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTeamMemberRecord {
  email: string;
  name: string;
  passwordHash: string;
  status?: TeamMemberStatus;
}

export class MongoTeamMemberRepository {
  private get collection(): Collection<MongoDoc<TeamMemberRecord>> {
    return getDb().collection<MongoDoc<TeamMemberRecord>>('team_members');
  }

  async findById(id: string): Promise<TeamMemberRecord | null> {
    return fromDoc<TeamMemberRecord>(await this.collection.findOne({ _id: id }));
  }

  async findByEmail(email: string): Promise<TeamMemberRecord | null> {
    return fromDoc<TeamMemberRecord>(
      await this.collection.findOne({ email: email.trim().toLowerCase() }),
    );
  }

  async list(query: {
    page: number;
    perPage: number;
    search?: string;
  }): Promise<{ items: TeamMemberRecord[]; total: number }> {
    const filter: Filter<MongoDoc<TeamMemberRecord>> = {};
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [containsCi('name', search), containsCi('email', search)];
    }

    const total = await this.collection.countDocuments(filter);
    const docs = await this.collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .toArray();

    return { items: fromDocs<TeamMemberRecord>(docs), total };
  }

  async create(data: CreateTeamMemberRecord): Promise<TeamMemberRecord> {
    const now = new Date();
    const record: TeamMemberRecord = {
      id: randomUUID(),
      email: data.email.trim().toLowerCase(),
      name: data.name.trim(),
      passwordHash: data.passwordHash,
      status: data.status ?? 'active',
      passwordResetOtpHash: null,
      passwordResetOtpExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(toDoc(record));
    return record;
  }

  async update(
    id: string,
    data: Partial<Omit<TeamMemberRecord, 'id' | 'createdAt'>>,
  ): Promise<TeamMemberRecord | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    return fromDoc<TeamMemberRecord>(result);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }
}
