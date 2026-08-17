import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import type { SpeakerRepository } from '../speakers/speaker.repository.js';
import type { SponsorRepository } from '../sponsors/sponsor.repository.js';
import type { MembershipRepository } from '../memberships/membership.repository.js';
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

/** Six-digit OTP for password reset emails. */
export function generatePasswordResetOtp(): string {
  const value = randomBytes(3).readUIntBE(0, 3) % 1_000_000;
  return value.toString().padStart(6, '0');
}

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly speakers?: SpeakerRepository,
    private readonly sponsors?: SponsorRepository,
    private readonly memberships?: MembershipRepository,
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
      // Keep inviteCodeHash so re-using the invite after setup can return a clear error.
      inviteCodeExpiresAt: null,
      passwordResetOtpHash: null,
      passwordResetOtpExpiresAt: null,
      mustChangePassword: false,
    });
    if (!updated) throw new NotFoundError('User');
    return toPublicUser(updated);
  }

  /**
   * Create or refresh a dashboard portal account (speaker/sponsor) with invite code.
   * Returns plaintext inviteCode on create or when a fresh invite is issued.
   */
  async upsertPortalAccount(input: {
    email: string;
    name: string;
    role: 'speaker' | 'sponsor';
    speakerId?: string | null;
    sponsorId?: string | null;
    issueInvite?: boolean;
  }): Promise<{ user: PublicUser; created: boolean; inviteCode?: string }> {
    const email = input.email.trim().toLowerCase();
    const speakerId = input.role === 'speaker' ? (input.speakerId ?? null) : null;
    const sponsorId = input.role === 'sponsor' ? (input.sponsorId ?? null) : null;

    await this.assertProfileLinks(input.role, speakerId, sponsorId);

    const linkedUser =
      input.role === 'speaker' && speakerId
        ? await this.users.findBySpeakerId(speakerId)
        : input.role === 'sponsor' && sponsorId
          ? await this.users.findBySponsorId(sponsorId)
          : null;

    const byEmail = await this.users.findByEmail(email);
    const existing = linkedUser ?? byEmail;

    if (existing) {
      if (existing.role !== input.role) {
        throw new ConflictError('That email is already used by another account type');
      }
      if (
        speakerId &&
        existing.speakerId &&
        existing.speakerId !== speakerId
      ) {
        throw new ConflictError('That email is linked to a different speaker profile');
      }
      if (
        sponsorId &&
        existing.sponsorId &&
        existing.sponsorId !== sponsorId
      ) {
        throw new ConflictError('That email is linked to a different sponsor profile');
      }

      const shouldIssueInvite = input.issueInvite ?? false;
      let inviteCode: string | undefined;
      let inviteCodeHash = existing.inviteCodeHash;
      let inviteCodeExpiresAt = existing.inviteCodeExpiresAt;
      let mustChangePassword = existing.mustChangePassword;

      if (shouldIssueInvite) {
        inviteCode = generateInviteCode();
        inviteCodeExpiresAt = new Date(
          Date.now() + env.inviteCodeTtlDays * 24 * 60 * 60 * 1000,
        );
        inviteCodeHash = await bcrypt.hash(inviteCode, PASSWORD_SALT_ROUNDS);
        mustChangePassword = true;
      }

      const updated = await this.users.update(existing.id, {
        email,
        name: input.name.trim(),
        speakerId,
        sponsorId,
        status: 'active',
        ...(shouldIssueInvite
          ? {
              inviteCodeHash,
              inviteCodeExpiresAt,
              mustChangePassword,
              passwordHash: await bcrypt.hash(randomSecretPassword(), PASSWORD_SALT_ROUNDS),
            }
          : {}),
      });
      if (!updated) throw new NotFoundError('User');
      return { user: toPublicUser(updated), created: false, inviteCode };
    }

    const inviteCode = generateInviteCode();
    const expiresAt = new Date(
      Date.now() + env.inviteCodeTtlDays * 24 * 60 * 60 * 1000,
    );

    const created = await this.users.create({
      email,
      name: input.name.trim(),
      passwordHash: await bcrypt.hash(randomSecretPassword(), PASSWORD_SALT_ROUNDS),
      inviteCodeHash: await bcrypt.hash(inviteCode, PASSWORD_SALT_ROUNDS),
      inviteCodeExpiresAt: expiresAt,
      mustChangePassword: true,
      role: input.role,
      status: 'active',
      speakerId,
      sponsorId,
      profileCompleted: false,
    });

    return { user: toPublicUser(created), created: true, inviteCode };
  }

  async storePasswordResetOtp(userId: string, otp: string): Promise<void> {
    const expiresAt = new Date(Date.now() + env.passwordResetOtpTtlMinutes * 60 * 1000);
    const updated = await this.users.update(userId, {
      passwordResetOtpHash: await bcrypt.hash(otp, PASSWORD_SALT_ROUNDS),
      passwordResetOtpExpiresAt: expiresAt,
    });
    if (!updated) throw new NotFoundError('User');
  }

  async verifyPasswordResetOtp(userId: string, otp: string): Promise<boolean> {
    const user = await this.requireUser(userId);
    if (!user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) return false;
    if (user.passwordResetOtpExpiresAt.getTime() <= Date.now()) return false;
    return bcrypt.compare(otp.trim(), user.passwordResetOtpHash);
  }

  async clearPasswordResetOtp(userId: string): Promise<void> {
    await this.users.update(userId, {
      passwordResetOtpHash: null,
      passwordResetOtpExpiresAt: null,
    });
  }

  async create(input: CreateUserInput): Promise<PublicUser> {
    if (await this.users.findByEmail(input.email)) {
      throw new ConflictError('A user with that email already exists');
    }

    const role = input.role ?? 'member';
    const speakerId = role === 'speaker' ? (input.speakerId ?? null) : null;
    const sponsorId = role === 'sponsor' ? (input.sponsorId ?? null) : null;
    const membershipId = role === 'member' ? (input.membershipId ?? null) : null;

    await this.assertProfileLinks(role, speakerId, sponsorId);
    await this.assertMembership(membershipId);

    const created = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash: await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS),
      role,
      status: input.status ?? 'active',
      speakerId,
      sponsorId,
      membershipId,
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
    const membershipId =
      input.membershipId !== undefined
        ? input.membershipId
        : role === 'member'
          ? existing.membershipId
          : null;

    if (input.role !== undefined || input.speakerId !== undefined || input.sponsorId !== undefined) {
      await this.assertProfileLinks(
        role,
        role === 'speaker' ? speakerId : null,
        role === 'sponsor' ? sponsorId : null,
      );
    }

    if (input.membershipId !== undefined || input.role !== undefined) {
      await this.assertMembership(role === 'member' ? membershipId : null);
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
      ...(input.membershipId !== undefined || input.role !== undefined
        ? { membershipId: role === 'member' ? membershipId : null }
        : {}),
      ...(input.membershipStatus !== undefined
        ? { membershipStatus: input.membershipStatus }
        : {}),
      ...(input.membershipExpiresAt !== undefined
        ? { membershipExpiresAt: input.membershipExpiresAt }
        : {}),
      ...(input.renewalReminderSentAt !== undefined
        ? { renewalReminderSentAt: input.renewalReminderSentAt }
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

  /**
   * Free in-app upgrades are disabled — purchases go through Stripe checkout.
   */
  async upgradeMyMembership(_userId: string, _membershipId: string): Promise<never> {
    throw new BadRequestError(
      'Membership purchases and upgrades must be completed through Stripe checkout on the membership website',
    );
  }

  private async assertMembership(membershipId: string | null): Promise<void> {
    if (!membershipId) return;
    if (this.memberships && !(await this.memberships.findById(membershipId))) {
      throw new BadRequestError('Linked membership was not found');
    }
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
