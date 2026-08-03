import { z } from 'zod';

export const sessionFeedbackParamSchema = z.object({
  id: z.string().uuid('Expected a valid session id'),
});

export const sessionFeedbackItemParamSchema = z.object({
  id: z.string().uuid('Expected a valid session id'),
  feedbackId: z.string().uuid('Expected a valid feedback id'),
});

export const listSessionFeedbackQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const upsertSessionFeedbackSchema = z.object({
  rating: z.coerce
    .number()
    .int('Rating must be a whole number')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating cannot exceed 5'),
  comment: z.string().trim().max(2000).optional().default(''),
});

export const updateSessionFeedbackSchema = z
  .object({
    rating: z.coerce
      .number()
      .int('Rating must be a whole number')
      .min(1, 'Rating must be at least 1')
      .max(5, 'Rating cannot exceed 5')
      .optional(),
    comment: z.string().trim().max(2000).optional(),
  })
  .refine((value) => value.rating !== undefined || value.comment !== undefined, {
    message: 'Provide a rating and/or comment to update',
  });
