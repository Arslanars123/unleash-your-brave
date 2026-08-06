import { z } from 'zod';
import { USER_ROLES } from '../users/user.types.js';

export const announcementIdParamSchema = z.object({
  id: z.string().uuid('Expected a valid announcement id'),
});

export const listAnnouncementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  status: z.enum(['draft', 'scheduled', 'published', 'cancelled']).optional(),
  kind: z.enum(['manual', 'system']).optional(),
});

export const listFeedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30),
  filter: z.enum(['all', 'unread', 'read']).optional().default('all'),
});

const audienceRolesSchema = z.array(z.enum(USER_ROLES)).default(['member']);
const audienceUserIdsSchema = z.array(z.string().uuid()).default([]);

const deliverySchema = z.enum(['immediate', 'scheduled', 'draft']);

export const createAnnouncementSchema = z
  .object({
    title: z.string().trim().min(2, 'Title is required').max(200),
    description: z.string().trim().max(5000).optional().default(''),
    delivery: deliverySchema.default('immediate'),
    audienceType: z.enum(['all', 'roles', 'users']).default('all'),
    audienceRoles: audienceRolesSchema,
    audienceUserIds: audienceUserIdsSchema,
    scheduledAt: z.string().datetime().nullable().optional(),
    sendPush: z.boolean().optional().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.delivery === 'scheduled') {
      if (!value.scheduledAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['scheduledAt'],
          message: 'Scheduled time is required',
        });
      } else if (Date.parse(value.scheduledAt) <= Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['scheduledAt'],
          message: 'Scheduled time must be in the future',
        });
      }
    }
    if (value.audienceType === 'users' && value.audienceUserIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['audienceUserIds'],
        message: 'Select at least one attendee',
      });
    }
    if (value.audienceType === 'roles' && value.audienceRoles.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['audienceRoles'],
        message: 'Select at least one group/role',
      });
    }
  });

export const updateAnnouncementSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    delivery: deliverySchema.optional(),
    audienceType: z.enum(['all', 'roles', 'users']).optional(),
    audienceRoles: z.array(z.enum(USER_ROLES)).optional(),
    audienceUserIds: z.array(z.string().uuid()).optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
    sendPush: z.boolean().optional(),
    status: z.enum(['draft', 'scheduled', 'published', 'cancelled']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export const countdownRuleSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  enabled: z.boolean(),
  offsetDays: z.coerce.number().int().min(0).max(365),
  cadence: z.enum(['once', 'daily', 'weekly']),
  titleTemplate: z.string().trim().min(2).max(200),
  bodyTemplate: z.string().trim().min(2).max(2000),
});

export const updateCountdownSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    rules: z.array(countdownRuleSchema).min(1).max(20).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });
