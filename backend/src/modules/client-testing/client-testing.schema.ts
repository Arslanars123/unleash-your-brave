import { z } from 'zod';

export const updateClientTestingSchema = z.object({
  enabled: z.boolean(),
});
