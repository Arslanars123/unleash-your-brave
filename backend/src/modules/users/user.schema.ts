import { z } from 'zod';
import { isValidMediaUrl } from '../uploads/media-url.js';
import { NETWORKING_PREFS, USER_ROLES, USER_STATUSES } from './user.types.js';

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .default('')
  .refine((value) => value === '' || isValidMediaUrl(value) || /^https?:\/\//i.test(value), {
    message: 'Enter a valid URL',
  });

const stringListSchema = z
  .array(z.string().trim().min(1).max(80))
  .max(30)
  .optional()
  .default([]);

export const userIdParamSchema = z.object({
  id: z.string().uuid('Expected a valid user id'),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
});

const profileFields = {
  photoUrl: optionalUrl,
  title: z.string().trim().max(160).optional().default(''),
  business: z.string().trim().max(160).optional().default(''),
  industry: z.string().trim().max(160).optional().default(''),
  location: z.string().trim().max(160).optional().default(''),
  bio: z.string().trim().max(5000).optional().default(''),
  goals: stringListSchema,
  interests: stringListSchema,
  networkingPrefs: z.enum(NETWORKING_PREFS).optional().default('open_to_all'),
  linkedinUrl: optionalUrl,
  instagramUrl: optionalUrl,
  websiteUrl: optionalUrl,
  isVip: z.boolean().optional().default(false),
  points: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  profileCompleted: z.boolean().optional().default(false),
};

export const createUserSchema = z
  .object({
    email: z.string().email().toLowerCase(),
    name: z.string().trim().min(2).max(80),
    password: z.string().min(8).max(128),
    role: z.enum(USER_ROLES).default('member'),
    status: z.enum(USER_STATUSES).optional().default('active'),
    speakerId: z.string().uuid().nullable().optional(),
    sponsorId: z.string().uuid().nullable().optional(),
    membershipId: z.string().uuid().nullable().optional(),
    ...profileFields,
  })
  .superRefine((value, ctx) => {
    if (value.role === 'speaker' && !value.speakerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['speakerId'],
        message: 'Link a speaker profile for speaker accounts',
      });
    }
    if (value.role === 'sponsor' && !value.sponsorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sponsorId'],
        message: 'Link a sponsor profile for sponsor accounts',
      });
    }
    if (value.role !== 'speaker' && value.speakerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['speakerId'],
        message: 'speakerId is only valid for speaker accounts',
      });
    }
    if (value.role !== 'sponsor' && value.sponsorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sponsorId'],
        message: 'sponsorId is only valid for sponsor accounts',
      });
    }
  });

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    email: z.string().email().toLowerCase().optional(),
    password: z.string().min(8).max(128).optional(),
    role: z.enum(USER_ROLES).optional(),
    status: z.enum(USER_STATUSES).optional(),
    speakerId: z.string().uuid().nullable().optional(),
    sponsorId: z.string().uuid().nullable().optional(),
    membershipId: z.string().uuid().nullable().optional(),
    photoUrl: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .refine((value) => value === undefined || value === '' || isValidMediaUrl(value) || /^https?:\/\//i.test(value), {
        message: 'Enter a valid URL',
      }),
    title: z.string().trim().max(160).optional(),
    business: z.string().trim().max(160).optional(),
    industry: z.string().trim().max(160).optional(),
    location: z.string().trim().max(160).optional(),
    bio: z.string().trim().max(5000).optional(),
    goals: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    interests: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    networkingPrefs: z.enum(NETWORKING_PREFS).optional(),
    linkedinUrl: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .refine((value) => value === undefined || value === '' || /^https?:\/\//i.test(value), {
        message: 'Enter a valid URL',
      }),
    instagramUrl: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .refine((value) => value === undefined || value === '' || /^https?:\/\//i.test(value), {
        message: 'Enter a valid URL',
      }),
    websiteUrl: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .refine((value) => value === undefined || value === '' || /^https?:\/\//i.test(value), {
        message: 'Enter a valid URL',
      }),
    isVip: z.boolean().optional(),
    points: z.coerce.number().int().min(0).max(1_000_000).optional(),
    profileCompleted: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

/** Members editing their own profile — no role/status/password/VIP controls. */
export const updateMyProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    photoUrl: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .refine(
        (value) =>
          value === undefined ||
          value === '' ||
          isValidMediaUrl(value) ||
          /^https?:\/\//i.test(value),
        { message: 'Enter a valid photo URL or uploaded path' },
      ),
    title: z.string().trim().max(160).optional(),
    business: z.string().trim().max(160).optional(),
    industry: z.string().trim().max(160).optional(),
    location: z.string().trim().max(160).optional(),
    bio: z.string().trim().max(5000).optional(),
    goals: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    interests: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    networkingPrefs: z.enum(NETWORKING_PREFS).optional(),
    linkedinUrl: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .refine((value) => value === undefined || value === '' || /^https?:\/\//i.test(value), {
        message: 'Enter a valid URL',
      }),
    instagramUrl: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .refine((value) => value === undefined || value === '' || /^https?:\/\//i.test(value), {
        message: 'Enter a valid URL',
      }),
    websiteUrl: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .refine((value) => value === undefined || value === '' || /^https?:\/\//i.test(value), {
        message: 'Enter a valid URL',
      }),
    profileCompleted: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

/** Attendee self-service membership upgrade (higher price only). */
export const upgradeMyMembershipSchema = z.object({
  membershipId: z.string().uuid(),
});
