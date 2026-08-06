import { z } from 'zod';

export const listCheckInsQuerySchema = z.object({
  eventId: z.string().uuid('eventId is required'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().min(1).optional(),
  status: z.enum(['checked_in', 'not_checked_in', 'all']).optional().default('all'),
});

export const scanCheckInSchema = z
  .object({
    token: z.string().trim().min(10).optional(),
    eventId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    /** When set, QR must belong to this edition (prevents past QR checking into current). */
    expectedEventId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.token) return;
    if (!value.eventId || !value.userId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide a QR token, or both eventId and userId',
      });
    }
  });

export const myQrQuerySchema = z.object({
  eventId: z.string().uuid().optional(),
});

export const checkInStatsQuerySchema = z.object({
  eventId: z.string().uuid('eventId is required'),
});
