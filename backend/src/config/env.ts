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
  PASSWORD_RESET_OTP_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  JWT_RESET_TTL: z.string().default('15m'),
  /** MongoDB connection string (Atlas or local). */
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/unleash_your_brave'),
  /** Firebase Admin service account JSON string (preferred in App Runner). */
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  /** Or path to a service-account JSON file (local/dev). */
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  /** S3 bucket for durable media (required in production / App Runner). */
  S3_BUCKET: z.string().min(1).optional(),
  AWS_REGION: z.string().min(1).default('ap-southeast-2'),
  /**
   * Public base URL for objects (no trailing slash), e.g.
   * https://unleash-media-773063618702.s3.ap-southeast-2.amazonaws.com
   */
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
  /** Optional explicit keys; otherwise default AWS credential chain / instance role. */
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  /** Stripe (membership checkout). Leave blank to disable checkout locally. */
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_CURRENCY: z.string().default('usd'),
  /** Must include `{CHECKOUT_SESSION_ID}` if you want Stripe to inject the session id. */
  STRIPE_SUCCESS_URL: z.string().default('http://localhost:3000/checkout/success?session_id={CHECKOUT_SESSION_ID}'),
  STRIPE_CANCEL_URL: z.string().default('http://localhost:3000/checkout/cancel'),
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
    resetTtl: raw.JWT_RESET_TTL,
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
  passwordResetOtpTtlMinutes: raw.PASSWORD_RESET_OTP_TTL_MINUTES,
  jwtResetTtl: raw.JWT_RESET_TTL,
  mongodbUri: raw.MONGODB_URI,
  firebase: {
    serviceAccountJson: raw.FIREBASE_SERVICE_ACCOUNT_JSON,
    serviceAccountPath: raw.FIREBASE_SERVICE_ACCOUNT_PATH,
  },
  s3: {
    bucket: raw.S3_BUCKET ?? '',
    region: raw.AWS_REGION,
    publicBaseUrl:
      raw.S3_PUBLIC_BASE_URL ??
      (raw.S3_BUCKET
        ? `https://${raw.S3_BUCKET}.s3.${raw.AWS_REGION}.amazonaws.com`
        : ''),
    accessKeyId: raw.AWS_ACCESS_KEY_ID,
    secretAccessKey: raw.AWS_SECRET_ACCESS_KEY,
    enabled: Boolean(raw.S3_BUCKET),
  },
  stripe: {
    secretKey: raw.STRIPE_SECRET_KEY ?? '',
    webhookSecret: raw.STRIPE_WEBHOOK_SECRET ?? '',
    publishableKey: raw.STRIPE_PUBLISHABLE_KEY ?? '',
    currency: raw.STRIPE_CURRENCY.toLowerCase(),
    successUrl: raw.STRIPE_SUCCESS_URL,
    cancelUrl: raw.STRIPE_CANCEL_URL,
    enabled: Boolean(raw.STRIPE_SECRET_KEY),
  },
} as const;

export type Env = typeof env;
