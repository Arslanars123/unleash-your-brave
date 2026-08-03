import { z } from 'zod';

export const announcementIdParamSchema = z.object({
  id: z.string().uuid('Expected a valid announcement id'),
});

export const listAnnouncementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
});

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(2, 'Title is required').max(200),
  description: z.string().trim().max(5000).optional().default(''),
});

export const updateAnnouncementSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });
