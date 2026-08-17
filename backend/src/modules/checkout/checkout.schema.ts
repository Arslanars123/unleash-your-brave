import { z } from 'zod';

export const createCheckoutSessionSchema = z.object({
  membershipId: z.string().uuid(),
  email: z.string().email().max(254),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  couponCode: z.string().trim().min(1).max(64).optional(),
});

export const checkoutEligibilityQuerySchema = z.object({
  email: z.string().email().max(254),
  membershipId: z.string().uuid(),
});

export const checkoutCatalogQuerySchema = z.object({
  eventId: z.string().uuid().optional(),
});

export const checkoutSessionIdParamSchema = z.object({
  id: z.string().min(1),
});
