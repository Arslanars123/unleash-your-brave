import bcrypt from 'bcryptjs';
import { UnauthorizedError } from '../../core/errors/app-error.js';
import type { UserRepository } from '../users/user.repository.js';
import type { PublicUser } from '../users/user.types.js';
import { toPublicUser } from '../users/user.mapper.js';
import { UserService } from '../users/user.service.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';
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
    return { user, tokens: issueTokenPair(user.id, user.role) };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);

    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedError('Account is suspended');
    }

    return {
      user: toPublicUser(user),
      tokens: issueTokenPair(user.id, user.role),
    };
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

    return issueTokenPair(user.id, user.role);
  }

  async me(userId: string): Promise<PublicUser> {
    return this.userService.getById(userId);
  }
}
