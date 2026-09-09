import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import type { MailService } from '../mail/mail.service.js';
import { toPublicUser } from '../users/user.mapper.js';
import type { UserRepository } from '../users/user.repository.js';
import type { User } from '../users/user.types.js';
import type {
  CreateTeamMemberInput,
  ListTeamMembersQuery,
  TeamMember,
  UpdateTeamMemberInput,
} from './team-member.types.js';

const PASSWORD_SALT_ROUNDS = 12;

function generateTeamPassword(): string {
  // Readable temporary password (no ambiguous characters).
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
    ) ?? env.corsOrigins[0] ?? 'http://localhost:5173';
  return `${preferred.replace(/\/$/, '')}/team/login`;
}

function toTeamMember(user: User): TeamMember {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export class TeamMemberService {
  constructor(
    private readonly users: UserRepository,
    private readonly mail: MailService,
  ) {}

  async list(query: ListTeamMembersQuery): Promise<{ items: TeamMember[]; total: number }> {
    const { items, total } = await this.users.list({
      page: query.page,
      perPage: query.perPage,
      search: query.search,
      role: 'desk',
    });
    return { items: items.map(toTeamMember), total };
  }

  async getById(id: string): Promise<TeamMember> {
    const user = await this.requireDesk(id);
    return toTeamMember(user);
  }

  async create(input: CreateTeamMemberInput): Promise<TeamMember> {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const password = generateTeamPassword();
    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const created = await this.users.create({
      email,
      name,
      passwordHash,
      role: 'desk',
      status: 'active',
      mustChangePassword: false,
      inviteCodeHash: null,
      inviteCodeExpiresAt: null,
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
    await this.requireDesk(id);
    const patch: Partial<User> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.status !== undefined) patch.status = input.status;
    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      const other = await this.users.findByEmail(email);
      if (other && other.id !== id) {
        throw new ConflictError('An account with this email already exists');
      }
      patch.email = email;
    }
    const updated = await this.users.update(id, patch);
    if (!updated) throw new NotFoundError('Team member');
    return toTeamMember(updated);
  }

  async remove(id: string): Promise<void> {
    await this.requireDesk(id);
    await this.users.delete(id);
  }

  /** Generate a new password and email credentials again. */
  async reinvite(id: string): Promise<TeamMember> {
    const user = await this.requireDesk(id);
    if (user.status !== 'active') {
      throw new BadRequestError('Reactivate this team member before sending a reinvite');
    }

    const password = generateTeamPassword();
    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const updated = await this.users.update(id, {
      passwordHash,
      mustChangePassword: false,
      inviteCodeHash: null,
      inviteCodeExpiresAt: null,
    });
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

  private async requireDesk(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user || user.role !== 'desk') {
      throw new NotFoundError('Team member');
    }
    return user;
  }
}
