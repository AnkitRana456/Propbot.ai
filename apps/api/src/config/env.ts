import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { maskSecret } from '../utils/crypto-vault.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Automatically locate .env from cwd or monorepo root
const possibleEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(__dirname, '../../../../.env'),
];

for (const p of possibleEnvPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(v => parseInt(v, 10)).default('3000'),
  API_URL: z.string().url().default('http://localhost:3000'),
  WEB_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_MAX_CONNECTIONS: z.string().transform(v => parseInt(v, 10)).default('20'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PREFIX: z.string().default('propbot_queue'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters long'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters long'),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),
  ENCRYPTION_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGIN: z.string().optional(),

  // AI & LLM Providers (Optional for startup, required for live AI in R1)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  EMBEDDING_API_KEY: z.string().optional(),
  ALLOW_OFFLINE_MOCK: z.string().optional(),
  MOCK_PROVIDERS: z.string().optional(),

  // Observability & Tracing
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_HOST: z.string().optional(),

  // Meta WhatsApp Cloud API
  META_WHATSAPP_TOKEN: z.string().optional(),
  META_WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  META_WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  // Object Storage
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),

  // Outbound Email (SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Payment Gateways
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

export function validateEnv(customEnv?: Record<string, unknown>): ValidatedEnv {
  const envToValidate = customEnv || process.env;
  const result = envSchema.safeParse(envToValidate);

  if (!result.success) {
    const errorDetails = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.error(`\x1b[31m[CONFIG_ERROR] Invalid environment configuration: ${errorDetails}\x1b[0m`);
    throw new Error(`Invalid environment configuration: ${errorDetails}`);
  }

  const validated = result.data;

  // Strict check in production
  if (validated.NODE_ENV === 'production') {
    if (!validated.ENCRYPTION_KEY || validated.ENCRYPTION_KEY.length < 32) {
      throw new Error('ENCRYPTION_KEY is required in production and must be at least 32 characters');
    }
  }

  return validated;
}

/**
 * Returns a safe diagnostics summary of configured providers with all keys masked.
 */
export function getMaskedConfigSummary(): Record<string, string> {
  return {
    database: process.env.DATABASE_URL ? 'Configured' : 'Missing',
    redis: process.env.REDIS_URL ? 'Configured' : 'Default (localhost:6379)',
    llmProvider: process.env.OPENAI_API_KEY
      ? `OpenAI (${maskSecret(process.env.OPENAI_API_KEY)})`
      : process.env.ANTHROPIC_API_KEY
        ? `Anthropic (${maskSecret(process.env.ANTHROPIC_API_KEY)})`
        : process.env.GEMINI_API_KEY
          ? `Gemini (${maskSecret(process.env.GEMINI_API_KEY)})`
          : 'None (Offline)',
    whatsapp: process.env.META_WHATSAPP_TOKEN
      ? `Configured (${maskSecret(process.env.META_WHATSAPP_TOKEN)})`
      : 'Not Configured',
    storage: process.env.R2_ACCESS_KEY_ID ? 'Configured' : 'Not Configured',
    smtp: process.env.SMTP_HOST ? `Configured (${process.env.SMTP_HOST})` : 'Not Configured',
  };
}
