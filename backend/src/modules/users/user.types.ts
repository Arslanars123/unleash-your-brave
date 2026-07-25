export const USER_ROLES = ['admin', 'member'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Internal representation. Never leaves the service layer as-is. */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Shape returned over the wire. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface ListUsersQuery {
  page: number;
  perPage: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}
