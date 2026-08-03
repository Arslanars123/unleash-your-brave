import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  /** Optional shared secret for GHL webhooks (`x-webhook-secret` header). */
  GHL_WEBHOOK_SECRET: z.string().min(8).optional(),
  APP_NAME: z.string().default('Unleash Your Brave'),
  /** Hostinger (or other) SMTP — all four required to actually send mail. */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? true : !['false', '0', 'no'].includes(v.toLowerCase()))),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  INVITE_CODE_TTL_DAYS: z.coerce.number().int().positive().default(7),
  /** MongoDB connection string (Atlas or local). */
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/unleash_your_brave'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const raw = parsed.data;

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  port: raw.PORT,
  logLevel: raw.LOG_LEVEL,
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwt: {
    accessSecret: raw.JWT_ACCESS_SECRET,
    refreshSecret: raw.JWT_REFRESH_SECRET,
    accessTtl: raw.JWT_ACCESS_TTL,
    refreshTtl: raw.JWT_REFRESH_TTL,
  },
  ghlWebhookSecret: raw.GHL_WEBHOOK_SECRET,
  appName: raw.APP_NAME,
  smtp: {
    host: raw.SMTP_HOST ?? '',
    port: raw.SMTP_PORT,
    secure: raw.SMTP_SECURE,
    user: raw.SMTP_USER ?? '',
    pass: raw.SMTP_PASS ?? '',
    from: raw.SMTP_FROM ?? raw.SMTP_USER ?? '',
  },
  inviteCodeTtlDays: raw.INVITE_CODE_TTL_DAYS,
  mongodbUri: raw.MONGODB_URI,
} as const;

export type Env = typeof env;
