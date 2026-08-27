import { randomUUID } from 'node:crypto';
import type { Collection, Filter } from 'mongodb';
import { fromDoc, fromDocs, toDoc, type MongoDoc } from '../map.js';
import { containsCi, getDb } from '../mongo.js';
import type {
  CreateUserRecord,
  PaginatedResult,
  UserRepository,
} from '../../modules/users/user.repository.js';
import {
  EMPTY_ATTENDEE_PROFILE,
  type User,
  type UserRole,
  type UserStatus,
  type ListUsersQuery,
} from '../../modules/users/user.types.js';

export class MongoUserRepository implements UserRepository {
  private get collection(): Collection<MongoDoc<User>> {
    return getDb().collection<MongoDoc<User>>('users');
  }

  async findById(id: string): Promise<User | null> {
    return fromDoc<User>(await this.collection.findOne({ _id: id }));
  }

  async findByEmail(email: string): Promise<User | null> {
    return fromDoc<User>(await this.collection.findOne({ email: email.toLowerCase() }));
  }

  async findBySpeakerId(speakerId: string): Promise<User | null> {
    return fromDoc<User>(await this.collection.findOne({ speakerId }));
  }

  async findBySponsorId(sponsorId: string): Promise<User | null> {
    return fromDoc<User>(await this.collection.findOne({ sponsorId }));
  }

  async list(query: ListUsersQuery): Promise<PaginatedResult<User>> {
    const filter: Filter<MongoDoc<User>> = {};
    if (query.userIds) {
      if (query.userIds.length === 0) {
        return { items: [], total: 0 };
      }
      filter._id = { $in: query.userIds };
    }
    if (query.excludeUserIds?.length) {
      if (query.userIds?.length) {
        const excluded = new Set(query.excludeUserIds);
        const allowed = query.userIds.filter((id) => !excluded.has(id));
        if (allowed.length === 0) {
          return { items: [], total: 0 };
        }
        filter._id = { $in: allowed };
      } else {
        filter._id = { $nin: query.excludeUserIds };
      }
    }
    if (query.attendeesOnly) {
      filter.$or = [{ role: 'member' }, { membershipId: { $ne: null } }];
    } else if (query.role) {
      filter.role = query.role;
    }
    if (query.status) filter.status = query.status;
    if (query.search?.trim()) {
      const search = query.search.trim();
      const searchOr = [
        containsCi('name', search),
        containsCi('email', search),
        containsCi('title', search),
        containsCi('business', search),
        containsCi('industry', search),
        containsCi('location', search),
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    const total = await this.collection.countDocuments(filter);
    const docs = await this.collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.perPage)
      .limit(query.perPage)
      .toArray();

    return { items: fromDocs<User>(docs), total };
  }

  async listActiveIdsByRoles(roles: UserRole[]): Promise<string[]> {
    if (roles.length === 0) return [];
    const or: Filter<MongoDoc<User>>[] = [{ role: { $in: roles } }];
    if (roles.includes('speaker')) {
      or.push({ speakerId: { $ne: null } });
    }
    if (roles.includes('sponsor')) {
      or.push({ sponsorId: { $ne: null } });
    }
    if (roles.includes('member')) {
      or.push({ membershipId: { $ne: null } });
    }
    const docs = await this.collection
      .find({ status: 'active', $or: or } as Filter<MongoDoc<User>>)
      .project({ _id: 1 })
      .toArray();
    return [...new Set(docs.map((doc) => String(doc._id)))];
  }

  async listIdsByMembershipIds(membershipIds: string[]): Promise<string[]> {
    if (membershipIds.length === 0) return [];
    const docs = await this.collection
      .find({ membershipId: { $in: membershipIds } })
      .project({ _id: 1 })
      .toArray();
    return docs.map((doc) => String(doc._id));
  }

  async listDueForMembershipExpiry(now: Date): Promise<User[]> {
    const docs = await this.collection
      .find({
        membershipId: { $ne: null },
        membershipExpiresAt: { $lte: now },
        $or: [{ membershipStatus: 'active' }, { membershipStatus: null }, { membershipStatus: { $exists: false } }],
      } as Filter<MongoDoc<User>>)
      .limit(500)
      .toArray();
    return fromDocs<User>(docs);
  }

  async listDueForRenewalReminder(now: Date, withinDays: number): Promise<User[]> {
    const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
    const docs = await this.collection
      .find({
        membershipId: { $ne: null },
        membershipExpiresAt: { $gt: now, $lte: horizon },
        membershipStatus: { $ne: 'expired' },
      } as Filter<MongoDoc<User>>)
      .limit(500)
      .toArray();
    return fromDocs<User>(docs).filter((user) => Boolean(user.membershipExpiresAt));
  }

  async create(data: CreateUserRecord): Promise<User> {
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      email: data.email.toLowerCase(),
      name: data.name,
      passwordHash: data.passwordHash,
      role: data.role,
      status: data.status,
      speakerId: data.speakerId ?? null,
      sponsorId: data.sponsorId ?? null,
      membershipId: data.membershipId ?? null,
      membershipStatus: data.membershipStatus ?? null,
      membershipExpiresAt: data.membershipExpiresAt ?? null,
      renewalReminderSentAt: data.renewalReminderSentAt ?? null,
      qrRenewalBlockedNoticeSentAt: data.qrRenewalBlockedNoticeSentAt ?? null,
      photoUrl: data.photoUrl ?? EMPTY_ATTENDEE_PROFILE.photoUrl,
      title: data.title ?? EMPTY_ATTENDEE_PROFILE.title,
      business: data.business ?? EMPTY_ATTENDEE_PROFILE.business,
      industry: data.industry ?? EMPTY_ATTENDEE_PROFILE.industry,
      location: data.location ?? EMPTY_ATTENDEE_PROFILE.location,
      bio: data.bio ?? EMPTY_ATTENDEE_PROFILE.bio,
      goals: [...(data.goals ?? EMPTY_ATTENDEE_PROFILE.goals)],
      interests: [...(data.interests ?? EMPTY_ATTENDEE_PROFILE.interests)],
      networkingPrefs: data.networkingPrefs ?? EMPTY_ATTENDEE_PROFILE.networkingPrefs,
      linkedinUrl: data.linkedinUrl ?? EMPTY_ATTENDEE_PROFILE.linkedinUrl,
      instagramUrl: data.instagramUrl ?? EMPTY_ATTENDEE_PROFILE.instagramUrl,
      websiteUrl: data.websiteUrl ?? EMPTY_ATTENDEE_PROFILE.websiteUrl,
      isVip: data.isVip ?? EMPTY_ATTENDEE_PROFILE.isVip,
      points: data.points ?? EMPTY_ATTENDEE_PROFILE.points,
      profileCompleted: data.profileCompleted ?? EMPTY_ATTENDEE_PROFILE.profileCompleted,
      inviteCodeHash: data.inviteCodeHash ?? null,
      inviteCodeExpiresAt: data.inviteCodeExpiresAt ?? null,
      passwordResetOtpHash: data.passwordResetOtpHash ?? null,
      passwordResetOtpExpiresAt: data.passwordResetOtpExpiresAt ?? null,
      mustChangePassword: data.mustChangePassword ?? false,
      ghlContactId: data.ghlContactId ?? null,
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(toDoc(user));
    return user;
  }

  async update(
    id: string,
    data: Partial<Omit<User, 'id' | 'createdAt'>>,
  ): Promise<User | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: User = {
      ...existing,
      ...data,
      goals: data.goals ? [...data.goals] : existing.goals,
      interests: data.interests ? [...data.interests] : existing.interests,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    await this.collection.replaceOne({ _id: id }, toDoc(updated));
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  async countByStatus(status: UserStatus): Promise<number> {
    return this.collection.countDocuments({ status });
  }
}
