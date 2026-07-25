import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().trim().min(2).max(80),
  password: z.string().min(8).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
