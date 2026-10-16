import { describe, it, expect } from 'vitest';
import { validateEnv, getMaskedConfigSummary } from '../src/config/env.js';

describe('Environment Startup Validation (Zod Guard)', () => {
  const validBaseEnv = {
    NODE_ENV: 'test',
    PORT: '3000',
    API_URL: 'http://localhost:3000',
    WEB_URL: 'http://localhost:5173',
    DATABASE_URL: 'postgresql://propbot:password@localhost:5432/test_db',
    JWT_ACCESS_SECRET: 'super_secure_access_secret_longer_than_16_chars',
    JWT_REFRESH_SECRET: 'super_secure_refresh_secret_longer_than_16_chars',
  };

  it('passes validation when all required variables are present', () => {
    const validated = validateEnv(validBaseEnv);
    expect(validated.NODE_ENV).toBe('test');
    expect(validated.PORT).toBe(3000);
    expect(validated.DATABASE_URL).toBe(validBaseEnv.DATABASE_URL);
  });

  it('fails loudly when DATABASE_URL is missing', () => {
    const invalidEnv = { ...validBaseEnv, DATABASE_URL: '' };
    expect(() => validateEnv(invalidEnv)).toThrow(/DATABASE_URL is required/);
  });

  it('fails loudly when JWT secrets are shorter than 16 characters', () => {
    const invalidEnv = { ...validBaseEnv, JWT_ACCESS_SECRET: 'short' };
    expect(() => validateEnv(invalidEnv)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('enforces ENCRYPTION_KEY in production environment', () => {
    const prodEnvWithoutKey = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      ENCRYPTION_KEY: '',
    };
    expect(() => validateEnv(prodEnvWithoutKey)).toThrow(/ENCRYPTION_KEY is required in production/);
  });

  it('generates a masked configuration summary without revealing secrets', () => {
    process.env.OPENAI_API_KEY = 'sk-proj-test-1234567890abcdef';
    const summary = getMaskedConfigSummary();

    expect(summary.llmProvider).toContain('OpenAI');
    expect(summary.llmProvider).toContain('••••••••cdef');
    expect(summary.llmProvider).not.toContain('1234567890');
  });
});
