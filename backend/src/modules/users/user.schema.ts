import { z } from 'zod';
import { USER_ROLES, USER_STATUSES } from './user.types.js';

export const userIdParamSchema = z.object({
  id: z.string().uuid('Expected a valid user id'),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().trim().min(2).max(80),
  password: z.string().min(8).max(128),
  role: z.enum(USER_ROLES).default('member'),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    role: z.enum(USER_ROLES).optional(),
    status: z.enum(USER_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });
