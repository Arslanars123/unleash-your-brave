import { z } from 'zod';
import { isValidMediaUrl } from '../uploads/media-url.js';

const optionalText = z.string().trim().max(500).optional().default('');
const optionalLongText = z.string().trim().max(5000).optional().default('');

const photoSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .default('')
  .refine((value) => isValidMediaUrl(value), {
    message: 'Photo must be a valid URL or uploaded file path',
  });

export const speakerIdParamSchema = z.object({
  id: z.string().uuid('Expected a valid speaker id'),
});

export const listSpeakersQuerySchema = z.object({
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

export const createSpeakerSchema = z.object({
  eventId: z.string().uuid('Event is required').optional(),
  name: z.string().trim().min(2, 'Name is required').max(160),
  email: optionalEmail,
  title: optionalText,
  description: optionalLongText,
  photo: photoSchema,
});

export const updateSpeakerSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    email: optionalEmail,
    title: z.string().trim().max(500).optional(),
    description: z.string().trim().max(5000).optional(),
    photo: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .refine((value) => value === undefined || isValidMediaUrl(value), {
        message: 'Photo must be a valid URL or uploaded file path',
      }),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });
