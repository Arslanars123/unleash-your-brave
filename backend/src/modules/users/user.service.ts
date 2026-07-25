import bcrypt from 'bcryptjs';
import { ConflictError, NotFoundError } from '../../core/errors/app-error.js';
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

export class UserService {
  constructor(private readonly users: UserRepository) {}

  async list(query: ListUsersQuery): Promise<PaginatedResult<PublicUser>> {
    const { items, total } = await this.users.list(query);
    return { items: items.map(toPublicUser), total };
  }

  async getById(id: string): Promise<PublicUser> {
    return toPublicUser(await this.requireUser(id));
  }

  async create(input: CreateUserInput): Promise<PublicUser> {
    if (await this.users.findByEmail(input.email)) {
      throw new ConflictError('A user with that email already exists');
    }

    const created = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash: await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS),
      role: input.role ?? 'member',
      status: 'active',
    });

    return toPublicUser(created);
  }

  async update(id: string, input: UpdateUserInput): Promise<PublicUser> {
    await this.requireUser(id);
    const updated = await this.users.update(id, input);
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

  private async requireUser(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('User');
    return user;
  }
}
