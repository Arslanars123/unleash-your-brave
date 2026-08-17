import { z } from 'zod';

const membershipDiscountSchema = z.object({
  membershipId: z.string().uuid(),
  percentOff: z.coerce.number().min(1).max(100),
});

export const couponIdParamSchema = z.object({
  id: z.string().uuid('Expected a valid coupon id'),
});

export const listCouponsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  active: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (typeof value === 'boolean') return value;
      return value === 'true';
    }),
});

export const createCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code may only contain letters, numbers, - and _')
    .optional(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().default(''),
  active: z.boolean().optional().default(true),
  expiresAt: z
    .union([z.string().datetime({ offset: true }), z.null()])
    .optional()
    .default(null),
  maxRedemptions: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  membershipDiscounts: z.array(membershipDiscountSchema).min(1, 'Add at least one membership discount'),
});

export const updateCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, 'Code may only contain letters, numbers, - and _')
      .optional(),
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(2000).optional(),
    active: z.boolean().optional(),
    expiresAt: z.union([z.string().datetime({ offset: true }), z.null()]).optional(),
    maxRedemptions: z.coerce.number().int().min(0).max(1_000_000).optional(),
    membershipDiscounts: z.array(membershipDiscountSchema).min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export const validateCouponSchema = z.object({
  code: z.string().trim().min(1).max(64),
  membershipId: z.string().uuid(),
});

export const sendCouponSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  message: z.string().trim().max(2000).optional(),
  sendPush: z.boolean().optional().default(true),
  audienceType: z.enum(['all', 'roles', 'users']).optional().default('all'),
  audienceRoles: z.array(z.enum(['member', 'speaker', 'sponsor', 'admin'])).optional(),
  audienceUserIds: z.array(z.string().uuid()).optional(),
});
