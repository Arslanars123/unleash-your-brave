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
    /** When false, keep the existing account name (checkout chose "keep"). */
    applyName?: boolean;
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
    const applyName = input.applyName !== false;

    if (existing) {
      // Speakers/sponsors (and any account) may also buy membership. Keep their
      // portal role/links; issue a fresh app invite when they still need first login
      // (expires any previous unused invite by replacing the hash).
      const needsAppInvite = existing.mustChangePassword;
      let inviteCode: string | undefined;
      let invitePatch: Partial<{
        inviteCodeHash: string;
        inviteCodeExpiresAt: Date;
        mustChangePassword: boolean;
        passwordHash: string;
      }> = {};

      if (needsAppInvite) {
        inviteCode = generateInviteCode();
        invitePatch = {
          inviteCodeHash: await bcrypt.hash(inviteCode, PASSWORD_SALT_ROUNDS),
          inviteCodeExpiresAt: new Date(
            Date.now() + env.inviteCodeTtlDays * 24 * 60 * 60 * 1000,
          ),
          mustChangePassword: true,
          passwordHash: await bcrypt.hash(randomSecretPassword(), PASSWORD_SALT_ROUNDS),
        };
      }

      const updated = await this.users.update(existing.id, {
        ...(applyName
          ? {
              name: displayName,
              ...(firstName ? { firstName } : {}),
              ...(lastName ? { lastName } : {}),
            }
          : {}),
        ...(input.product?.trim() ? { title: input.product.trim() } : {}),
        ...(input.contactId?.trim() ? { ghlContactId: input.contactId.trim() } : {}),
        status: 'active',
        ...invitePatch,
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

  /**
   * Update display name on the user and linked speaker/sponsor profiles.
   */
  async updateAccountNameEverywhere(
    email: string,
    input: { firstName: string; lastName: string; name?: string },
  ): Promise<PublicUser> {
    const existing = await this.users.findByEmail(email.trim().toLowerCase());
    if (!existing) throw new NotFoundError('User');

    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const name =
      input.name?.trim() ||
      [firstName, lastName].filter(Boolean).join(' ').trim() ||
      existing.name;

    const updated = await this.users.update(existing.id, {
      name,
      firstName,
      lastName,
    });
    if (!updated) throw new NotFoundError('User');

    if (updated.speakerId && this.speakers) {
      await this.speakers.update(updated.speakerId, { name });
    }
    if (updated.sponsorId && this.sponsors) {
      await this.sponsors.update(updated.sponsorId, { name });
    }

    return toPublicUser(updated);
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
   * Create or refresh a dashboard portal account (speaker and/or sponsor) with invite code.
   * Merges portal links on the same email so a user can be attendee + speaker + sponsor.
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
    const incomingSpeakerId = input.role === 'speaker' ? (input.speakerId ?? null) : null;
    const incomingSponsorId = input.role === 'sponsor' ? (input.sponsorId ?? null) : null;

    if (input.role === 'speaker' && !incomingSpeakerId) {
      throw new BadRequestError('Speaker accounts must link a speaker profile');
    }
    if (input.role === 'sponsor' && !incomingSponsorId) {
      throw new BadRequestError('Sponsor accounts must link a sponsor profile');
    }

    await this.assertProfileLinks(incomingSpeakerId, incomingSponsorId);

    const linkedUser =
      input.role === 'speaker' && incomingSpeakerId
        ? await this.users.findBySpeakerId(incomingSpeakerId)
        : input.role === 'sponsor' && incomingSponsorId
          ? await this.users.findBySponsorId(incomingSponsorId)
          : null;

    const byEmail = await this.users.findByEmail(email);
    const existing = linkedUser ?? byEmail;

    if (existing) {
      if (existing.role === 'admin') {
        throw new ConflictError('That email is already used by an admin account');
      }

      if (
        incomingSpeakerId &&
        existing.speakerId &&
        existing.speakerId !== incomingSpeakerId
      ) {
        throw new ConflictError('That email is linked to a different speaker profile');
      }
      if (
        incomingSponsorId &&
        existing.sponsorId &&
        existing.sponsorId !== incomingSponsorId
      ) {
        throw new ConflictError('That email is linked to a different sponsor profile');
      }

      // Merge capabilities — never drop the other portal link or membership.
      const nextSpeakerId =
        input.role === 'speaker' ? incomingSpeakerId : existing.speakerId;
      const nextSponsorId =
        input.role === 'sponsor' ? incomingSponsorId : existing.sponsorId;

      await this.assertProfileLinks(nextSpeakerId, nextSponsorId);

      // Keep an existing portal primary role; promote members into the portal being added.
      const nextRole =
        existing.role === 'speaker' || existing.role === 'sponsor'
          ? existing.role
          : input.role;

      // Password already set → never re-invite; unused invite → replace with a fresh code.
      const passwordAlreadySet = !existing.mustChangePassword;
      const shouldIssueInvite = !passwordAlreadySet && Boolean(input.issueInvite);
      let inviteCode: string | undefined;

      if (shouldIssueInvite) {
        inviteCode = generateInviteCode();
      }

      const updated = await this.users.update(existing.id, {
        email,
        name: input.name.trim(),
        role: nextRole,
        speakerId: nextSpeakerId,
        sponsorId: nextSponsorId,
        status: 'active',
        ...(shouldIssueInvite
          ? {
              inviteCodeHash: await bcrypt.hash(inviteCode!, PASSWORD_SALT_ROUNDS),
              inviteCodeExpiresAt: new Date(
                Date.now() + env.inviteCodeTtlDays * 24 * 60 * 60 * 1000,
              ),
              mustChangePassword: true,
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
      speakerId: incomingSpeakerId,
      sponsorId: incomingSponsorId,
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
    const speakerId = input.speakerId ?? null;
    const sponsorId = input.sponsorId ?? null;
    const membershipId =
      role === 'admin' ? null : (input.membershipId ?? null);

    if (role === 'speaker' && !speakerId) {
      throw new BadRequestError('Speaker accounts must link a speaker profile');
    }
    if (role === 'sponsor' && !sponsorId) {
      throw new BadRequestError('Sponsor accounts must link a sponsor profile');
    }

    await this.assertProfileLinks(speakerId, sponsorId);
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
      input.speakerId !== undefined ? input.speakerId : existing.speakerId;
    const sponsorId =
      input.sponsorId !== undefined ? input.sponsorId : existing.sponsorId;
    const membershipId =
      input.membershipId !== undefined
        ? input.membershipId
        : role === 'admin'
          ? null
          : existing.membershipId;

    if (role === 'speaker' && !speakerId) {
      throw new BadRequestError('Speaker accounts must link a speaker profile');
    }
    if (role === 'sponsor' && !sponsorId) {
      throw new BadRequestError('Sponsor accounts must link a sponsor profile');
    }

    if (
      input.role !== undefined ||
      input.speakerId !== undefined ||
      input.sponsorId !== undefined
    ) {
      await this.assertProfileLinks(speakerId, sponsorId);
    }

    if (input.membershipId !== undefined || input.role !== undefined) {
      await this.assertMembership(role === 'admin' ? null : membershipId);
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
      ...(input.role !== undefined ||
      input.speakerId !== undefined ||
      input.sponsorId !== undefined
        ? {
            speakerId: role === 'admin' ? null : speakerId,
            sponsorId: role === 'admin' ? null : sponsorId,
          }
        : {}),
      ...(input.membershipId !== undefined || input.role !== undefined
        ? { membershipId: role === 'admin' ? null : membershipId }
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
      ...(input.qrRenewalBlockedNoticeSentAt !== undefined
        ? { qrRenewalBlockedNoticeSentAt: input.qrRenewalBlockedNoticeSentAt }
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
    speakerId: string | null,
    sponsorId: string | null,
  ): Promise<void> {
    if (speakerId && this.speakers && !(await this.speakers.findById(speakerId))) {
      throw new BadRequestError('Linked speaker profile was not found');
    }
    if (sponsorId && this.sponsors && !(await this.sponsors.findById(sponsorId))) {
      throw new BadRequestError('Linked sponsor profile was not found');
    }
  }

  private async requireUser(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('User');
    return user;
  }
}
