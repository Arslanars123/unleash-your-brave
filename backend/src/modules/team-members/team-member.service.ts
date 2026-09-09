import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import type { MongoTeamMemberRepository, TeamMemberRecord } from '../../db/repositories/mongo-team-member.repository.js';
import type { MailService } from '../mail/mail.service.js';
import type { PublicUser } from '../users/user.types.js';
import type {
  CreateTeamMemberInput,
  ListTeamMembersQuery,
  TeamMember,
  UpdateTeamMemberInput,
} from './team-member.types.js';

const PASSWORD_SALT_ROUNDS = 12;

function generateTeamPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

function dashboardLoginUrl(): string {
  const preferred =
    env.corsOrigins.find((origin) =>
      /cloudfront|admin-dashboard|localhost:5173/i.test(origin),
    ) ??
    env.corsOrigins[0] ??
    'http://localhost:5173';
  return `${preferred.replace(/\/$/, '')}/team/login`;
}

function toTeamMember(record: TeamMemberRecord): TeamMember {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Minimal PublicUser shape so desk JWT sessions work with the dashboard auth client. */
export function toPublicDeskUser(record: TeamMemberRecord): PublicUser {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    fullName: record.name,
    role: 'desk',
    status: record.status,
    speakerId: null,
    sponsorId: null,
    membershipId: null,
    membershipStatus: null,
    membershipExpiresAt: null,
    renewalReminderSentAt: null,
    qrRenewalBlockedNoticeSentAt: null,
    photoUrl: '',
    title: '',
    business: '',
    industry: '',
    location: '',
    bio: '',
    goals: [],
    interests: [],
    networkingPrefs: 'open_to_all',
    linkedinUrl: '',
    instagramUrl: '',
    websiteUrl: '',
    isVip: false,
    points: 0,
    profileCompleted: false,
    mustChangePassword: false,
    ghlContactId: null,
    firstName: record.name.split(/\s+/)[0] ?? record.name,
    lastName: record.name.split(/\s+/).slice(1).join(' '),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class TeamMemberService {
  constructor(
    private readonly teamMembers: MongoTeamMemberRepository,
    private readonly mail: MailService,
  ) {}

  async list(query: ListTeamMembersQuery): Promise<{ items: TeamMember[]; total: number }> {
    const { items, total } = await this.teamMembers.list(query);
    return { items: items.map(toTeamMember), total };
  }

  async getById(id: string): Promise<TeamMember> {
    return toTeamMember(await this.requireTeamMember(id));
  }

  async findRecordById(id: string): Promise<TeamMemberRecord | null> {
    return this.teamMembers.findById(id);
  }

  async findRecordByEmail(email: string): Promise<TeamMemberRecord | null> {
    return this.teamMembers.findByEmail(email);
  }

  async create(input: CreateTeamMemberInput): Promise<TeamMember> {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();

    // Uniqueness only within desk team — same email may exist as attendee/admin elsewhere.
    const existing = await this.teamMembers.findByEmail(email);
    if (existing) {
      throw new ConflictError('A team member with this email already exists');
    }

    const password = generateTeamPassword();
    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const created = await this.teamMembers.create({
      email,
      name,
      passwordHash,
      status: 'active',
    });

    await this.mail.sendTeamCredentials({
      to: email,
      name,
      password,
      loginUrl: dashboardLoginUrl(),
    });

    return toTeamMember(created);
  }

  async update(id: string, input: UpdateTeamMemberInput): Promise<TeamMember> {
    await this.requireTeamMember(id);
    const patch: Partial<Omit<TeamMemberRecord, 'id' | 'createdAt'>> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.status !== undefined) patch.status = input.status;
    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      const other = await this.teamMembers.findByEmail(email);
      if (other && other.id !== id) {
        throw new ConflictError('A team member with this email already exists');
      }
      patch.email = email;
    }
    const updated = await this.teamMembers.update(id, patch);
    if (!updated) throw new NotFoundError('Team member');
    return toTeamMember(updated);
  }

  async remove(id: string): Promise<void> {
    await this.requireTeamMember(id);
    await this.teamMembers.delete(id);
  }

  async reinvite(id: string): Promise<TeamMember> {
    const member = await this.requireTeamMember(id);
    if (member.status !== 'active') {
      throw new BadRequestError('Reactivate this team member before sending a reinvite');
    }

    const password = generateTeamPassword();
    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const updated = await this.teamMembers.update(id, { passwordHash });
    if (!updated) throw new NotFoundError('Team member');

    await this.mail.sendTeamCredentials({
      to: updated.email,
      name: updated.name,
      password,
      loginUrl: dashboardLoginUrl(),
      isReinvite: true,
    });

    return toTeamMember(updated);
  }

  async setPassword(id: string, newPassword: string): Promise<PublicUser> {
    const member = await this.requireTeamMember(id);
    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
    const updated = await this.teamMembers.update(id, {
      passwordHash,
      passwordResetOtpHash: null,
      passwordResetOtpExpiresAt: null,
    });
    if (!updated) throw new NotFoundError('Team member');
    return toPublicDeskUser(updated ?? member);
  }

  private async requireTeamMember(id: string): Promise<TeamMemberRecord> {
    const member = await this.teamMembers.findById(id);
    if (!member) throw new NotFoundError('Team member');
    return member;
  }
}
