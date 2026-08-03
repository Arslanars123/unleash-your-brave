import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .email('Enter a valid email')
  .toLowerCase();

export const loginSchema = z.object({
  email: emailSchema,
  /** Password or one-time invite code from purchase email. */
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const registerSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
