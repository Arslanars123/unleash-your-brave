import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import type { SpeakerRepository } from '../speakers/speaker.repository.js';
import type { SponsorRepository } from '../sponsors/sponsor.repository.js';
import type { PaginatedResult, UserRepository } from './user.repository.js';
import type {
  CreateUserInput,
  ListUsersQuery,
  PublicUser,
  UpdateUserInput,
  User,
} from './user.types.js';
import { toPublicUser } from './user.mapper.js';

const PASSWORD_SALT_ROUNDS = 12;

function randomSecretPassword(): string {
  return randomBytes(24).toString('base64url');
}

/** Short typed invite code for first login (email). */
export function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[bytes[i]! % alphabet.length];
  }
  return `UYB-${code}`;
}

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly speakers?: SpeakerRepository,
    private readonly sponsors?: SponsorRepository,
  ) {}

  async list(query: ListUsersQuery): Promise<PaginatedResult<PublicUser>> {
    const { items, total } = await this.users.list(query);
    return { items: items.map(toPublicUser), total };
  }

  async getById(id: string): Promise<PublicUser> {
    return toPublicUser(await this.requireUser(id));
  }

  /**
   * Upsert a member from an external purchase webhook (e.g. GoHighLevel).
   * Creates an active member if the email is new; updates name/title if they exist.
   * On create, returns a plaintext inviteCode (email it once; only the hash is stored).
   */
  async upsertFromPurchase(input: {
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    product?: string;
    contactId?: string;
  }): Promise<{ user: PublicUser; created: boolean; inviteCode?: string }> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.findByEmail(email);
    const firstName = input.firstName?.trim() ?? '';
    const lastName = input.lastName?.trim() ?? '';
    const combinedFromParts = [firstName, lastName].filter(Boolean).join(' ').trim();
    const displayName =
      combinedFromParts ||
      input.name?.trim() ||
      email.split('@')[0] ||
      'Attendee';

    if (existing) {
      const updated = await this.users.update(existing.id, {
        name: displayName,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(input.product?.trim() ? { title: input.product.trim() } : {}),
        ...(input.contactId?.trim() ? { ghlContactId: input.contactId.trim() } : {}),
        status: 'active',
      });
      if (!updated) throw new NotFoundError('User');
      return { user: toPublicUser(updated), created: false };
    }

    const inviteCode = generateInviteCode();
    const expiresAt = new Date(
      Date.now() + env.inviteCodeTtlDays * 24 * 60 * 60 * 1000,
    );

    const created = await this.users.create({
      email,
      name: displayName,
      firstName,
      lastName,
      // Unguessable password — attendee must use invite code, then set their own.
      passwordHash: await bcrypt.hash(randomSecretPassword(), PASSWORD_SALT_ROUNDS),
      inviteCodeHash: await bcrypt.hash(inviteCode, PASSWORD_SALT_ROUNDS),
      inviteCodeExpiresAt: expiresAt,
      mustChangePassword: true,
      ghlContactId: input.contactId?.trim() || null,
      role: 'member',
      status: 'active',
      title: input.product?.trim() ?? '',
      profileCompleted: false,
    });

    return { user: toPublicUser(created), created: true, inviteCode };
  }

  async setPassword(userId: string, newPassword: string): Promise<PublicUser> {
    const updated = await this.users.update(userId, {
      passwordHash: await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS),
      inviteCodeHash: null,
      inviteCodeExpiresAt: null,
      mustChangePassword: false,
    });
    if (!updated) throw new NotFoundError('User');
    return toPublicUser(updated);
  }

  async create(input: CreateUserInput): Promise<PublicUser> {
    if (await this.users.findByEmail(input.email)) {
      throw new ConflictError('A user with that email already exists');
    }

    const role = input.role ?? 'member';
    const speakerId = role === 'speaker' ? (input.speakerId ?? null) : null;
    const sponsorId = role === 'sponsor' ? (input.sponsorId ?? null) : null;

    await this.assertProfileLinks(role, speakerId, sponsorId);

    const created = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash: await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS),
      role,
      status: input.status ?? 'active',
      speakerId,
      sponsorId,
      photoUrl: input.photoUrl,
      title: input.title,
      business: input.business,
      industry: input.industry,
      location: input.location,
      bio: input.bio,
      goals: input.goals,
      interests: input.interests,
      networkingPrefs: input.networkingPrefs,
      linkedinUrl: input.linkedinUrl,
      instagramUrl: input.instagramUrl,
      websiteUrl: input.websiteUrl,
      isVip: input.isVip,
      points: input.points,
      profileCompleted: input.profileCompleted,
    });

    return toPublicUser(created);
  }

  async update(id: string, input: UpdateUserInput): Promise<PublicUser> {
    const existing = await this.requireUser(id);
    const role = input.role ?? existing.role;
    const speakerId =
      input.speakerId !== undefined
        ? input.speakerId
        : role === 'speaker'
          ? existing.speakerId
          : null;
    const sponsorId =
      input.sponsorId !== undefined
        ? input.sponsorId
        : role === 'sponsor'
          ? existing.sponsorId
          : null;

    if (input.role !== undefined || input.speakerId !== undefined || input.sponsorId !== undefined) {
      await this.assertProfileLinks(
        role,
        role === 'speaker' ? speakerId : null,
        role === 'sponsor' ? sponsorId : null,
      );
    }

    if (input.email && input.email.toLowerCase() !== existing.email) {
      const clash = await this.users.findByEmail(input.email);
      if (clash && clash.id !== id) {
        throw new ConflictError('A user with that email already exists');
      }
    }

    const updated = await this.users.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
      ...(input.password !== undefined
        ? { passwordHash: await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS) }
        : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.role !== undefined || input.speakerId !== undefined || input.sponsorId !== undefined
        ? {
            speakerId: role === 'speaker' ? speakerId : null,
            sponsorId: role === 'sponsor' ? sponsorId : null,
          }
        : {}),
      ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.business !== undefined ? { business: input.business } : {}),
      ...(input.industry !== undefined ? { industry: input.industry } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.goals !== undefined ? { goals: input.goals } : {}),
      ...(input.interests !== undefined ? { interests: input.interests } : {}),
      ...(input.networkingPrefs !== undefined ? { networkingPrefs: input.networkingPrefs } : {}),
      ...(input.linkedinUrl !== undefined ? { linkedinUrl: input.linkedinUrl } : {}),
      ...(input.instagramUrl !== undefined ? { instagramUrl: input.instagramUrl } : {}),
      ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl } : {}),
      ...(input.isVip !== undefined ? { isVip: input.isVip } : {}),
      ...(input.points !== undefined ? { points: input.points } : {}),
      ...(input.profileCompleted !== undefined
        ? { profileCompleted: input.profileCompleted }
        : {}),
    });
    if (!updated) throw new NotFoundError('User');
    return toPublicUser(updated);
  }

  async delete(id: string): Promise<void> {
    if (!(await this.users.delete(id))) {
      throw new NotFoundError('User');
    }
  }

  async getStats(): Promise<{ active: number; suspended: number; total: number }> {
    const [active, suspended] = await Promise.all([
      this.users.countByStatus('active'),
      this.users.countByStatus('suspended'),
    ]);
    return { active, suspended, total: active + suspended };
  }

  private async assertProfileLinks(
    role: User['role'],
    speakerId: string | null,
    sponsorId: string | null,
  ): Promise<void> {
    if (role === 'speaker') {
      if (!speakerId) throw new BadRequestError('Speaker accounts must link a speaker profile');
      if (this.speakers && !(await this.speakers.findById(speakerId))) {
        throw new BadRequestError('Linked speaker profile was not found');
      }
    }
    if (role === 'sponsor') {
      if (!sponsorId) throw new BadRequestError('Sponsor accounts must link a sponsor profile');
      if (this.sponsors && !(await this.sponsors.findById(sponsorId))) {
        throw new BadRequestError('Linked sponsor profile was not found');
      }
    }
  }

  private async requireUser(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('User');
    return user;
  }
}
