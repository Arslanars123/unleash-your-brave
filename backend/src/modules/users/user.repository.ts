import { randomUUID } from 'node:crypto';
import type {
  ListUsersQuery,
  MembershipStatus,
  NetworkingPref,
  User,
  UserRole,
  UserStatus,
} from './user.types.js';
import { EMPTY_ATTENDEE_PROFILE } from './user.types.js';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface CreateUserRecord {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  speakerId?: string | null;
  sponsorId?: string | null;
  membershipId?: string | null;
  membershipStatus?: MembershipStatus | null;
  membershipExpiresAt?: Date | null;
  renewalReminderSentAt?: Date | null;
  photoUrl?: string;
  title?: string;
  business?: string;
  industry?: string;
  location?: string;
  bio?: string;
  goals?: string[];
  interests?: string[];
  networkingPrefs?: NetworkingPref;
  linkedinUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
  isVip?: boolean;
  points?: number;
  profileCompleted?: boolean;
  inviteCodeHash?: string | null;
  inviteCodeExpiresAt?: Date | null;
  passwordResetOtpHash?: string | null;
  passwordResetOtpExpiresAt?: Date | null;
  mustChangePassword?: boolean;
  ghlContactId?: string | null;
  firstName?: string;
  lastName?: string;
}

/**
 * The persistence contract. Services depend on this interface only, so swapping
 * the in-memory store for Prisma/Postgres is a one-line change in the container.
 */
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findBySpeakerId(speakerId: string): Promise<User | null>;
  findBySponsorId(sponsorId: string): Promise<User | null>;
  list(query: ListUsersQuery): Promise<PaginatedResult<User>>;
  /** Active users matching any of the given roles (for announcement audiences). */
  listActiveIdsByRoles(roles: UserRole[]): Promise<string[]>;
  /** Members whose renewable period has ended but status is still active. */
  listDueForMembershipExpiry(now: Date): Promise<User[]>;
  /** Active renewable members expiring within the reminder window who need a reminder. */
  listDueForRenewalReminder(now: Date, withinDays: number): Promise<User[]>;
  create(data: CreateUserRecord): Promise<User>;
  update(id: string, data: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null>;
  delete(id: string): Promise<boolean>;
  countByStatus(status: UserStatus): Promise<number>;
}

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === normalized) return user;
    }
    return null;
  }

  async findBySpeakerId(speakerId: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.speakerId === speakerId) return user;
    }
    return null;
  }

  async findBySponsorId(sponsorId: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.sponsorId === sponsorId) return user;
    }
    return null;
  }

  async list(query: ListUsersQuery): Promise<PaginatedResult<User>> {
    const search = query.search?.toLowerCase();

    const filtered = [...this.users.values()]
      .filter((user) => {
        if (query.role && user.role !== query.role) return false;
        if (query.status && user.status !== query.status) return false;
        if (search) {
          return (
            user.name.toLowerCase().includes(search) ||
            user.email.includes(search) ||
            user.title.toLowerCase().includes(search) ||
            user.business.toLowerCase().includes(search) ||
            user.industry.toLowerCase().includes(search) ||
            user.location.toLowerCase().includes(search)
          );
        }
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = (query.page - 1) * query.perPage;
    return {
      items: filtered.slice(start, start + query.perPage),
      total: filtered.length,
    };
  }

  async listActiveIdsByRoles(roles: UserRole[]): Promise<string[]> {
    if (roles.length === 0) return [];
    return [...this.users.values()]
      .filter((user) => user.status === 'active' && roles.includes(user.role))
      .map((user) => user.id);
  }

  async listDueForMembershipExpiry(now: Date): Promise<User[]> {
    return [...this.users.values()].filter(
      (user) =>
        user.role === 'member' &&
        user.membershipId &&
        user.membershipExpiresAt &&
        user.membershipExpiresAt.getTime() <= now.getTime() &&
        (user.membershipStatus === 'active' || user.membershipStatus == null),
    );
  }

  async listDueForRenewalReminder(now: Date, withinDays: number): Promise<User[]> {
    const horizon = now.getTime() + withinDays * 24 * 60 * 60 * 1000;
    return [...this.users.values()].filter((user) => {
      if (user.role !== 'member' || !user.membershipId || !user.membershipExpiresAt) {
        return false;
      }
      if (user.membershipStatus === 'expired') return false;
      const expires = user.membershipExpiresAt.getTime();
      if (expires <= now.getTime() || expires > horizon) return false;
      if (user.renewalReminderSentAt && user.renewalReminderSentAt.getTime() >= expires - withinDays * 24 * 60 * 60 * 1000) {
        return false;
      }
      return true;
    });
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
    this.users.set(user.id, user);
    return user;
  }

  async update(id: string, data: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
    const existing = this.users.get(id);
    if (!existing) return null;

    const updated: User = {
      ...existing,
      ...data,
      goals: data.goals ? [...data.goals] : existing.goals,
      interests: data.interests ? [...data.interests] : existing.interests,
      id: existing.id,
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async countByStatus(status: UserStatus): Promise<number> {
    let count = 0;
    for (const user of this.users.values()) {
      if (user.status === status) count += 1;
    }
    return count;
  }
}
