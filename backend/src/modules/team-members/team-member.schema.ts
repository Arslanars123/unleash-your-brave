import { z } from 'zod';

export const listTeamMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
});

export const createTeamMemberSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().toLowerCase(),
});

export const updateTeamMemberSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    email: z.string().email().toLowerCase().optional(),
    status: z.enum(['active', 'suspended', 'deactivated']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export const teamMemberIdParamSchema = z.object({
  id: z.string().uuid('Expected a valid team member id'),
});
