import { z } from 'zod';
import { ALLOWED_REACTIONS, DEVICE_PLATFORMS } from './chat.types.js';

export const listMessagesQuerySchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

export const listMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});

export const createMessageSchema = z
  .object({
    // Idempotency key — UUID preferred, but any stable client token is fine.
    clientId: z.string().trim().min(8).max(128),
    type: z.enum(['text']),
    body: z.string().max(4000).optional(),
  })
  .superRefine((value, ctx) => {
    if (!(value.body?.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'body is required', path: ['body'] });
    }
  });

export const messageIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const receiptSchema = z.object({
  messageId: z.string().uuid(),
});

export const reactionSchema = z.object({
  emoji: z.enum(ALLOWED_REACTIONS),
});

export const syncQuerySchema = z.object({
  since: z.string().datetime({ offset: true }).or(z.string().min(1)),
});

export const registerDeviceSchema = z.object({
  token: z.string().trim().min(10).max(4096),
  platform: z.enum(DEVICE_PLATFORMS),
});

export const unregisterDeviceSchema = z.object({
  token: z.string().trim().min(10).max(4096),
});
