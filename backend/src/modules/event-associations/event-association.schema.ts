import { z } from 'zod';

export const eventAssociationsBodySchema = z
  .object({
    speakerIds: z.array(z.string().uuid()).optional(),
    sponsorIds: z.array(z.string().uuid()).optional(),
    membershipIds: z.array(z.string().uuid()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.membershipIds !== undefined && value.membershipIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['membershipIds'],
        message: 'Link at least one membership tier to this edition.',
      });
    }
  });
