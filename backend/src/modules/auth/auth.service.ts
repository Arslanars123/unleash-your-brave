import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../core/errors/app-error.js';
import type { MailService } from '../mail/mail.service.js';
import type { TeamMemberService } from '../team-members/team-member.service.js';
import { toPublicDeskUser } from '../team-members/team-member.service.js';
import type { UserRepository } from '../users/user.repository.js';
import { generatePasswordResetOtp } from '../users/user.service.js';
import type { PublicUser } from '../users/user.types.js';
import { toPublicUser } from '../users/user.mapper.js';
import { UserService } from '../users/user.service.js';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyResetOtpInput,
} from './auth.schema.js';
import {
  issueTokenPair,
  signResetToken,
  type TokenPair,
  verifyRefreshToken,
  verifyResetToken,
} from './token.service.js';

export interface AuthResult {
  user: PublicUser;
  tokens: TokenPair;
}

export interface ForgotPasswordResult {
  message: string;
}

export interface VerifyResetOtpResult {
  resetToken: string;
}

const GENERIC_RESET_MESSAGE =
  'If an account exists for that email, a verification code has been sent.';

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly userService: UserService,
    private readonly mail: MailService,
    private readonly teamMembers?: TeamMemberService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const { user } = await this.userService.create({ ...input, role: 'member' });
    return {
      user,
      tokens: issueTokenPair(user.id, user.role, {
        speakerId: user.speakerId,
        sponsorId: user.sponsorId,
      }),
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();

    // Desk team is a separate collection. Same email may also exist as attendee/admin —
    // authenticate against whichever store matches the password.
    if (this.teamMembers) {
      const desk = await this.teamMembers.findRecordByEmail(email);
      if (desk) {
        const deskPasswordOk = await bcrypt.compare(input.password, desk.passwordHash);
        if (deskPasswordOk) {
          if (desk.status === 'deactivated') {
            throw new UnauthorizedError("You don't have an account.");
          }
          if (desk.status !== 'active') {
            throw new UnauthorizedError('Account is suspended');
          }
          return {
            user: toPublicDeskUser(desk),
            tokens: issueTokenPair(desk.id, 'desk'),
          };
        }
      }
    }

    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Legacy desk rows in users collection (if any).
    if (user.role === 'desk') {
      const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
      if (!passwordOk) throw new UnauthorizedError('Invalid email or password');
      if (user.status !== 'active') throw new UnauthorizedError('Account is suspended');
      return {
        user: toPublicUser(user),
        tokens: issueTokenPair(user.id, 'desk'),
      };
    }

    const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
    let inviteOk = false;

    if (user.inviteCodeHash) {
      const candidate = input.password.trim();
      inviteOk =
        (await bcrypt.compare(candidate, user.inviteCodeHash)) ||
        (await bcrypt.compare(candidate.toUpperCase(), user.inviteCodeHash));

      if (inviteOk) {
        const notExpired =
          !user.inviteCodeExpiresAt || user.inviteCodeExpiresAt.getTime() > Date.now();

        if (!user.mustChangePassword) {
          throw new UnauthorizedError(
            'You already used your invite code and set up a password. Please enter your password, or reset it if you forgot.',
            'INVITE_ALREADY_USED',
          );
        }

        if (!notExpired) {
          throw new UnauthorizedError(
            'This invite code has expired. Contact support or request a new invite.',
            'INVITE_EXPIRED',
          );
        }
      }
    }

    if (!passwordOk && !inviteOk) {
      if (user.mustChangePassword && user.inviteCodeHash) {
        throw new UnauthorizedError(
          'Enter the invite code from your email to continue',
        );
      }
      throw new UnauthorizedError('Invalid email or password');
    }

    if (passwordOk && user.mustChangePassword && user.inviteCodeHash) {
      throw new UnauthorizedError(
        'Enter the invite code from your email to continue',
      );
    }

    if (user.status === 'deactivated') {
      throw new UnauthorizedError("You don't have an account.");
    }
    if (user.status !== 'active') {
      throw new UnauthorizedError('Account is suspended');
    }

    const publicUser = toPublicUser(user);
    return {
      user: publicUser,
      tokens: issueTokenPair(user.id, user.role, {
        speakerId: user.speakerId,
        sponsorId: user.sponsorId,
      }),
    };
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<PublicUser> {
    if (this.teamMembers) {
      const desk = await this.teamMembers.findRecordById(userId);
      if (desk) {
        if (!input.currentPassword) {
          throw new UnauthorizedError('Current password is required');
        }
        const ok = await bcrypt.compare(input.currentPassword, desk.passwordHash);
        if (!ok) throw new UnauthorizedError('Current password is incorrect');
        return this.teamMembers.setPassword(userId, input.newPassword);
      }
    }

    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedError('Invalid session');

    if (!user.mustChangePassword) {
      if (!input.currentPassword) {
        throw new UnauthorizedError('Current password is required');
      }
      const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!ok) throw new UnauthorizedError('Current password is incorrect');
    }

    return this.userService.setPassword(userId, input.newPassword);
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<ForgotPasswordResult> {
    const email = input.email.trim().toLowerCase();

    if (this.teamMembers) {
      const desk = await this.teamMembers.findRecordByEmail(email);
      if (desk?.status === 'deactivated') {
        throw new UnauthorizedError("You don't have an account.");
      }
      if (desk && desk.status === 'active') {
        // Desk reset uses the same OTP email path via temporary storage on the team member.
        // For now redirect them to ask admin for Reinvite (simpler, avoids parallel OTP store).
        // Still return generic message; admin Reinvite is the supported reset for desk.
        return { message: GENERIC_RESET_MESSAGE };
      }
    }

    const user = await this.users.findByEmail(email);

    if (user?.status === 'deactivated') {
      throw new UnauthorizedError("You don't have an account.");
    }

    if (user && user.status === 'active') {
      const otp = generatePasswordResetOtp();
      await this.userService.storePasswordResetOtp(user.id, otp);
      await this.mail.sendPasswordResetOtp({
        to: user.email,
        name: user.name,
        otp,
        expiresInMinutes: env.passwordResetOtpTtlMinutes,
      });
    }

    return { message: GENERIC_RESET_MESSAGE };
  }

  async verifyResetOtp(input: VerifyResetOtpInput): Promise<VerifyResetOtpResult> {
    const user = await this.users.findByEmail(input.email);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedError('Invalid or expired verification code');
    }

    const ok = await this.userService.verifyPasswordResetOtp(user.id, input.otp);
    if (!ok) {
      throw new UnauthorizedError('Invalid or expired verification code');
    }

    await this.userService.clearPasswordResetOtp(user.id);
    return { resetToken: signResetToken(user.id) };
  }

  async resetPassword(input: ResetPasswordInput): Promise<PublicUser> {
    let payload;
    try {
      payload = verifyResetToken(input.resetToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    const user = await this.users.findById(payload.sub);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    return this.userService.setPassword(user.id, input.newPassword);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (this.teamMembers) {
      const desk = await this.teamMembers.findRecordById(payload.sub);
      if (desk) {
        if (desk.status !== 'active') {
          throw new UnauthorizedError('Invalid refresh token');
        }
        return issueTokenPair(desk.id, 'desk');
      }
    }

    const user = await this.users.findById(payload.sub);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedError('Invalid refresh token');
    }

    return issueTokenPair(user.id, user.role, {
      speakerId: user.speakerId,
      sponsorId: user.sponsorId,
    });
  }

  async me(userId: string): Promise<PublicUser> {
    if (this.teamMembers) {
      const desk = await this.teamMembers.findRecordById(userId);
      if (desk) return toPublicDeskUser(desk);
    }
    return this.userService.getById(userId);
  }
}
