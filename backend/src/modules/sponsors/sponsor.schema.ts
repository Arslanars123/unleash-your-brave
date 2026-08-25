import { z } from 'zod';
import { isValidMediaUrl } from '../uploads/media-url.js';

const optionalMedia = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .default('')
  .refine((value) => isValidMediaUrl(value), {
    message: 'Must be a valid URL or uploaded file path',
  });

const offerLinkSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().max(120).optional().default(''),
  url: z
    .string()
    .trim()
    .min(1, 'Link URL is required')
    .max(2000)
    .refine((value) => isValidMediaUrl(value), {
      message: 'Link must be a valid URL',
    }),
});

const offerSchema = z.object({
  id: z.string().uuid().optional(),
  offerNumber: z.coerce.number().int().min(1).max(50).optional(),
  description: z.string().trim().min(1, 'Offer description is required').max(2000),
  image: optionalMedia,
  links: z.array(offerLinkSchema).max(20).optional().default([]),
});

export const sponsorIdParamSchema = z.object({
  id: z.string().uuid('Expected a valid sponsor id'),
});

export const listSponsorsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  eventId: z.string().uuid().optional(),
});

const optionalEmail = z
  .string()
  .trim()
  .email('Enter a valid email')
  .toLowerCase()
  .optional()
  .or(z.literal(''))
  .transform((value) => value || undefined);

export const createSponsorSchema = z.object({
  eventId: z.string().uuid('Event is required').optional(),
  name: z.string().trim().min(2, 'Sponsor name is required').max(160),
  email: optionalEmail,
  description: z.string().trim().max(5000).optional().default(''),
  image: optionalMedia,
  offers: z.array(offerSchema).max(30).optional().default([]),
});

export const updateSponsorSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    email: optionalEmail,
    description: z.string().trim().max(5000).optional(),
    image: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .refine((value) => value === undefined || isValidMediaUrl(value), {
        message: 'Must be a valid URL or uploaded file path',
      }),
    offers: z.array(offerSchema).max(30).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });
