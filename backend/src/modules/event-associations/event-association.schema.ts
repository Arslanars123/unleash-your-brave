import { z } from 'zod';

export const eventAssociationsBodySchema = z.object({
  speakerIds: z.array(z.string().uuid()).optional(),
  sponsorIds: z.array(z.string().uuid()).optional(),
  membershipIds: z.array(z.string().uuid()).optional(),
});
