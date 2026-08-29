import { z } from 'zod';
import { isValidMediaUrl } from '../uploads/media-url.js';

export const updateAppBrandingSchema = z.object({
  homeCoverImage: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .refine((value) => value === undefined || isValidMediaUrl(value), {
      message: 'Home cover must be a URL or an uploaded file path',
    }),
  supportEmail: z.string().trim().email('Enter a valid support email').optional(),
  supportPhone: z.string().trim().max(30).optional(),
});
