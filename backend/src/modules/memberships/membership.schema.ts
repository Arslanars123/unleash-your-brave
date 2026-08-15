import { z } from 'zod';
import { isValidMediaUrl } from '../uploads/media-url.js';

const optionalLink = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .default('')
  .refine((value) => value === '' || isValidMediaUrl(value) || /^https?:\/\//i.test(value), {
    message: 'Must be a valid URL',
  });

export const membershipIdParamSchema = z.object({
  id: z.string().uuid('Expected a valid membership id'),
});

export const listMembershipsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  eventId: z.string().uuid().optional(),
});

const featuresSchema = z.array(z.string().trim().min(1).max(240)).max(30).optional().default([]);

export const createMembershipSchema = z.object({
  eventId: z.string().uuid('Event is required'),
  name: z.string().trim().min(2, 'Membership name is required').max(160),
  valueLink: optionalLink,
  price: z.coerce.number().min(0).max(1_000_000).optional().default(0),
  description: z.string().trim().max(5000).optional().default(''),
  features: featuresSchema,
  paymentPlanNote: z.string().trim().max(240).optional().default(''),
  featured: z.boolean().optional().default(false),
  tierRank: z.coerce.number().int().min(0).max(100).optional().default(0),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional().default(0),
});

export const updateMembershipSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    valueLink: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .refine(
        (value) =>
          value === undefined ||
          value === '' ||
          isValidMediaUrl(value) ||
          /^https?:\/\//i.test(value),
        { message: 'Must be a valid URL' },
      ),
    price: z.coerce.number().min(0).max(1_000_000).optional(),
    description: z.string().trim().max(5000).optional(),
    features: z.array(z.string().trim().min(1).max(240)).max(30).optional(),
    paymentPlanNote: z.string().trim().max(240).optional(),
    featured: z.boolean().optional(),
    tierRank: z.coerce.number().int().min(0).max(100).optional(),
    sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });
