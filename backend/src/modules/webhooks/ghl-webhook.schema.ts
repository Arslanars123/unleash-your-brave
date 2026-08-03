import { z } from 'zod';

export const ghlPurchaseWebhookSchema = z
  .object({
    email: z.string().email().optional(),
    name: z.string().trim().max(160).optional(),
    contactId: z.string().trim().max(120).optional(),
    product: z.string().trim().max(200).optional(),
    amount: z.union([z.string(), z.number()]).optional(),
    // GHL sometimes nests custom data or duplicates keys with different casing.
    Email: z.string().email().optional(),
    Name: z.string().trim().max(160).optional(),
    contact_id: z.string().trim().max(120).optional(),
    Product: z.string().trim().max(200).optional(),
    Amount: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const email = value.email ?? value.Email;
    if (!email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'email is required',
      });
    }
  });
