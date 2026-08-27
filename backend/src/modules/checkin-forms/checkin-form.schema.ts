import { z } from 'zod';

const fieldTypeSchema = z.enum(['text', 'textarea', 'checkbox', 'yes_no']);

export const checkInFormFieldSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(200),
  type: fieldTypeSchema,
  required: z.boolean().optional().default(false),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const eventIdParamSchema = z.object({
  eventId: z.string().uuid('Expected a valid event id'),
});

export const eventIdQuerySchema = z.object({
  eventId: z.string().uuid('eventId is required'),
});

export const upsertCheckInFormSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().default(''),
  fields: z.array(checkInFormFieldSchema).max(50).default([]),
  requireSignature: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
});

export const submitCheckInFormSchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.boolean()])),
  signatureDataUrl: z.string().max(2_000_000).optional().default(''),
  signedName: z.string().trim().min(1).max(200),
});

export const memberSubmitCheckInFormSchema = submitCheckInFormSchema.extend({
  eventId: z.string().uuid('eventId is required'),
});
