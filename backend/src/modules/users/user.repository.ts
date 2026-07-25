import { randomUUID } from 'node:crypto';
import type { ListUsersQuery, User, UserRole, UserStatus } from './user.types.js';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

/**
 * The persistence contract. Services depend on this interface only, so swapping
 * the in-memory store for Prisma/Postgres is a one-line change in the container.
 */
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(query: ListUsersQuery): Promise<PaginatedResult<User>>;
  create(data: {
    email: string;
    name: string;
    passwordHash: string;
    role: UserRole;
    status: UserStatus;
  }): Promise<User>;
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

  async list(query: ListUsersQuery): Promise<PaginatedResult<User>> {
    const search = query.search?.toLowerCase();

    const filtered = [...this.users.values()]
      .filter((user) => {
        if (query.role && user.role !== query.role) return false;
        if (query.status && user.status !== query.status) return false;
        if (search) {
          return user.name.toLowerCase().includes(search) || user.email.includes(search);
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

  async create(data: {
    email: string;
    name: string;
    passwordHash: string;
    role: UserRole;
    status: UserStatus;
  }): Promise<User> {
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      email: data.email.toLowerCase(),
      name: data.name,
      passwordHash: data.passwordHash,
      role: data.role,
      status: data.status,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  async update(id: string, data: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
    const existing = this.users.get(id);
    if (!existing) return null;

    const updated: User = { ...existing, ...data, id: existing.id, updatedAt: new Date() };
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
