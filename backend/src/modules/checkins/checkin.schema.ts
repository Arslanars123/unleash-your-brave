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
    /**
     * qr = camera/token scan → form opens on attendee app.
     * manual = list "Check in" → form opens on dashboard.
     * Defaults from whether a token was provided.
     */
    source: z.enum(['qr', 'manual']).optional(),
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

export const myPendingFormQuerySchema = z.object({
  eventId: z.string().uuid().optional(),
});

export const completeMyCheckInFormSchema = z.object({
  eventId: z.string().uuid(),
  answers: z.record(z.string(), z.union([z.string(), z.boolean()])),
  signatureDataUrl: z.string().max(2_000_000).optional().default(''),
  signedName: z.string().trim().min(1).max(200),
});

export const completeCheckInWithFormSchema = z
  .object({
    token: z.string().trim().min(10).optional(),
    eventId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    expectedEventId: z.string().uuid().optional(),
    answers: z.record(z.string(), z.union([z.string(), z.boolean()])),
    signatureDataUrl: z.string().max(2_000_000).optional().default(''),
    signedName: z.string().trim().min(1).max(200),
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
