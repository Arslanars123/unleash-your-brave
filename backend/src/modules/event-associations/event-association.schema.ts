import { z } from 'zod';

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format');

export const eventMembershipLinkSchema = z.object({
  membershipId: z.string().uuid(),
  saleExpiresAt: isoDateSchema.nullable().optional(),
  badgeLabel: z.string().trim().max(40).nullable().optional(),
});

export const eventAssociationsBodySchema = z
  .object({
    speakerIds: z.array(z.string().uuid()).optional(),
    sponsorIds: z.array(z.string().uuid()).optional(),
    membershipIds: z.array(z.string().uuid()).optional(),
    membershipLinks: z.array(eventMembershipLinkSchema).optional(),
  })
  .superRefine((value, ctx) => {
    const linkCount = value.membershipLinks?.length ?? value.membershipIds?.length;
    if (linkCount !== undefined && linkCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['membershipLinks'],
        message: 'Link at least one membership tier to this edition.',
      });
    }
  });
