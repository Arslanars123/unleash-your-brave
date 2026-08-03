import bcrypt from 'bcryptjs';
import { UnauthorizedError } from '../../core/errors/app-error.js';
import type { UserRepository } from '../users/user.repository.js';
import type { PublicUser } from '../users/user.types.js';
import { toPublicUser } from '../users/user.mapper.js';
import { UserService } from '../users/user.service.js';
import type { ChangePasswordInput, LoginInput, RegisterInput } from './auth.schema.js';
import { issueTokenPair, type TokenPair, verifyRefreshToken } from './token.service.js';

export interface AuthResult {
  user: PublicUser;
  tokens: TokenPair;
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly userService: UserService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const user = await this.userService.create({ ...input, role: 'member' });
    return {
      user,
      tokens: issueTokenPair(user.id, user.role, {
        speakerId: user.speakerId,
        sponsorId: user.sponsorId,
      }),
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
    let inviteOk = false;

    if (!passwordOk && user.inviteCodeHash) {
      const notExpired =
        !user.inviteCodeExpiresAt || user.inviteCodeExpiresAt.getTime() > Date.now();
      if (notExpired) {
        const candidate = input.password.trim();
        inviteOk =
          (await bcrypt.compare(candidate, user.inviteCodeHash)) ||
          (await bcrypt.compare(candidate.toUpperCase(), user.inviteCodeHash));
      }
    }

    if (!passwordOk && !inviteOk) {
      if (user.mustChangePassword && user.inviteCodeHash) {
        throw new UnauthorizedError(
          'Enter the verification code from your email to continue',
        );
      }
      throw new UnauthorizedError('Invalid email or password');
    }

    // First-time attendees must verify with the emailed code, not a password guess.
    if (passwordOk && user.mustChangePassword && user.inviteCodeHash) {
      throw new UnauthorizedError(
        'Enter the verification code from your email to continue',
      );
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

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
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
    return this.userService.getById(userId);
  }
}
