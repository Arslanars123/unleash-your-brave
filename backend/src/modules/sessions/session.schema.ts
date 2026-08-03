import { z } from 'zod';
import { isValidMediaUrl } from '../uploads/media-url.js';

const materialTypeSchema = z.enum(['pdf', 'video', 'doc', 'link']);

/** Empty string or 24h `HH:mm` (e.g. `09:00`). Accepts optional seconds from time inputs. */
const timeHmSchema = z
  .string()
  .trim()
  .transform((value) => {
    const withSeconds = /^(([01]\d|2[0-3]):[0-5]\d):[0-5]\d$/.exec(value);
    return withSeconds ? withSeconds[1]! : value;
  })
  .refine((value) => value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), {
    message: 'Use HH:mm (24-hour), e.g. 09:00',
  });

const materialSchema = z.object({
  id: z.string().uuid().optional(),
  type: materialTypeSchema,
  title: z.string().trim().min(1, 'Material title is required').max(200),
  url: z
    .string()
    .trim()
    .min(1, 'Material URL is required')
    .max(2000)
    .refine((value) => isValidMediaUrl(value), {
      message: 'Material must be a valid URL or uploaded file path',
    }),
});

function refineSessionTimes<T extends { startTime?: string; endTime?: string }>(
  value: T,
  ctx: z.RefinementCtx,
) {
  const hasStart = Object.prototype.hasOwnProperty.call(value, 'startTime');
  const hasEnd = Object.prototype.hasOwnProperty.call(value, 'endTime');

  // Only validate pairing when both fields are part of this payload
  // (create always includes defaults; partial PATCH may send one).
  if (!hasStart || !hasEnd) return;

  const start = value.startTime ?? '';
  const end = value.endTime ?? '';
  if ((start && !end) || (!start && end)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide both start and end time, or leave both empty',
      path: start ? ['endTime'] : ['startTime'],
    });
    return;
  }
  if (start && end && end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End time must be after start time',
      path: ['endTime'],
    });
  }
}

export const sessionIdParamSchema = z.object({
  id: z.string().uuid('Expected a valid session id'),
});

export const listSessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  eventId: z.string().uuid().optional(),
  speakerId: z.string().uuid().optional(),
  eventDayNumber: z.coerce.number().int().min(1).max(60).optional(),
});

export const createSessionSchema = z
  .object({
    eventId: z.string().uuid('Event is required'),
    name: z.string().trim().min(2, 'Name is required').max(160),
    description: z.string().trim().max(5000).optional().default(''),
    speakerId: z.string().uuid('Select a speaker'),
    eventDayNumber: z.coerce.number().int().min(1, 'Select an event day').max(60),
    startTime: timeHmSchema.optional().default(''),
    endTime: timeHmSchema.optional().default(''),
    location: z.string().trim().max(160).optional().default(''),
    materials: z.array(materialSchema).max(40).optional().default([]),
    feedbackEnabled: z.boolean().optional().default(true),
  })
  .superRefine(refineSessionTimes);

export const updateSessionSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(5000).optional(),
    speakerId: z.string().uuid().optional(),
    eventDayNumber: z.coerce.number().int().min(1).max(60).optional(),
    startTime: timeHmSchema.optional(),
    endTime: timeHmSchema.optional(),
    location: z.string().trim().max(160).optional(),
    materials: z.array(materialSchema).max(40).optional(),
    feedbackEnabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  })
  .superRefine(refineSessionTimes);

/** Speakers may only edit description + materials on their own sessions. */
export const speakerUpdateSessionSchema = z
  .object({
    description: z.string().trim().max(5000).optional(),
    materials: z.array(materialSchema).max(40).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });
