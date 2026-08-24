import { z } from 'zod';
import { isValidMediaUrl } from '../uploads/media-url.js';

const isoDateSchema = z
  .string()
  .min(1, 'Date is required')
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Enter a valid date',
  });

const optionalText = z.string().trim().max(500).optional().default('');
const optionalLongText = z.string().trim().max(5000).optional().default('');

const eventDaySchema = z.object({
  dayNumber: z.coerce.number().int().min(1).max(60).optional(),
  date: isoDateSchema,
  label: z.string().trim().max(120).optional().default(''),
});

const coverImageSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .default('')
  .refine((value) => isValidMediaUrl(value), {
    message: 'Cover image must be a URL or an uploaded file path',
  });

export const eventIdParamSchema = z.object({
  id: z.string().uuid('Expected a valid event id'),
});

export const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
});

function assertDaysUnique(days: Array<{ date: string }>, ctx: z.RefinementCtx): void {
  const seen = new Set<string>();
  days.forEach((day, index) => {
    const key = new Date(day.date).toISOString().slice(0, 10);
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['days', index, 'date'],
        message: 'Each event day must have a unique date',
      });
    }
    seen.add(key);
  });
}

const optionalCoord = z.union([z.number().finite(), z.null()]).optional();

export const createEventSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required').max(160),
    tagline: optionalText,
    description: optionalLongText,
    days: z.array(eventDaySchema).min(1).max(60).optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    venueName: optionalText,
    venueAddress: optionalText,
    venueCity: optionalText,
    latitude: optionalCoord,
    longitude: optionalCoord,
    coverImage: coverImageSchema,
    allowPreviousAttendeesAccess: z.boolean().optional().default(false),
    blockQrWhenRenewalUnpaid: z.boolean().optional().default(true),
    paused: z.boolean().optional().default(false),
    published: z.boolean().optional().default(true),
  })
  .superRefine((value, ctx) => {
    if (
      (value.latitude == null) !== (value.longitude == null) &&
      !(value.latitude === undefined && value.longitude === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latitude'],
        message: 'Provide both latitude and longitude, or neither',
      });
    }
    if (value.latitude != null && (value.latitude < -90 || value.latitude > 90)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latitude'],
        message: 'Latitude must be between -90 and 90',
      });
    }
    if (value.longitude != null && (value.longitude < -180 || value.longitude > 180)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['longitude'],
        message: 'Longitude must be between -180 and 180',
      });
    }
    if (value.days && value.days.length > 0) {
      assertDaysUnique(value.days, ctx);
      return;
    }

    if (!value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['days'],
        message: 'Add at least one event day (or provide start/end dates)',
      });
      return;
    }

    if (!value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'End date is required when days are not provided',
      });
      return;
    }

    if (Date.parse(value.endDate) < Date.parse(value.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'End date must be on or after the start date',
      });
    }
  });

export const updateEventSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    tagline: z.string().trim().max(500).optional(),
    description: z.string().trim().max(5000).optional(),
    days: z.array(eventDaySchema).min(1).max(60).optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    venueName: z.string().trim().max(500).optional(),
    venueAddress: z.string().trim().max(500).optional(),
    venueCity: z.string().trim().max(500).optional(),
    latitude: z.union([z.number().finite(), z.null()]).optional(),
    longitude: z.union([z.number().finite(), z.null()]).optional(),
    coverImage: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .refine((value) => value === undefined || isValidMediaUrl(value), {
        message: 'Cover image must be a URL or an uploaded file path',
      }),
    allowPreviousAttendeesAccess: z.boolean().optional(),
    blockQrWhenRenewalUnpaid: z.boolean().optional(),
    paused: z.boolean().optional(),
    published: z.boolean().optional(),
    notifyAttendees: z.boolean().optional().default(true),
  })
  .refine((value) => Object.keys(value).filter((k) => k !== 'notifyAttendees').length > 0, {
    message: 'Provide at least one field to update',
  })
  .superRefine((value, ctx) => {
    if (value.days) {
      assertDaysUnique(value.days, ctx);
    }

    if (value.latitude != null && (value.latitude < -90 || value.latitude > 90)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latitude'],
        message: 'Latitude must be between -90 and 90',
      });
    }
    if (value.longitude != null && (value.longitude < -180 || value.longitude > 180)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['longitude'],
        message: 'Longitude must be between -180 and 180',
      });
    }

    if (value.startDate && value.endDate && Date.parse(value.endDate) < Date.parse(value.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'End date must be on or after the start date',
      });
    }
  });

export const scheduleEventSchema = z
  .object({
    days: z.array(eventDaySchema).min(1, 'Add at least one event day').max(60),
    tagline: optionalText,
    description: optionalLongText,
    venueName: optionalText,
    venueAddress: optionalText,
    venueCity: optionalText,
    latitude: optionalCoord,
    longitude: optionalCoord,
    coverImage: coverImageSchema,
    copyDetailsFromPrevious: z.boolean().optional().default(true),
    allowPreviousAttendeesAccess: z.boolean().optional().default(false),
    blockQrWhenRenewalUnpaid: z.boolean().optional().default(true),
    published: z.boolean().optional().default(true),
    notifyAttendees: z.boolean().optional().default(true),
  })
  .superRefine((value, ctx) => {
    assertDaysUnique(value.days, ctx);
  });
