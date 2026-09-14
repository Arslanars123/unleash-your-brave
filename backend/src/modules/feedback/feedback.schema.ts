import { z } from 'zod';

export const listFeedbackQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
});

export const createFeedbackSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(160),
  email: z.string().trim().email('Enter a valid email').toLowerCase().max(320),
  feedback: z.string().trim().min(1, 'Feedback is required').max(5000),
});
