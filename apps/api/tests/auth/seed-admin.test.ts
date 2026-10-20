import { describe, it, expect, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import crypto from 'crypto';
import { seedPlatformOwner } from '../../src/db/seed-admin.js';
import { testDb } from '../helpers/test-db.js';
import { users } from '../../src/db/schema/index.js';

describe('seedPlatformOwner', () => {
  const email = `owner_${crypto.randomBytes(4).toString('hex')}@example.com`;

  afterAll(async () => {
    await testDb.delete(users).where(eq(users.email, email));
    delete process.env.SEED_ADMIN_EMAIL;
    delete process.env.SEED_ADMIN_PASSWORD;
  });

  it('requires env vars and a strong password', async () => {
    delete process.env.SEED_ADMIN_EMAIL;
    delete process.env.SEED_ADMIN_PASSWORD;
    await expect(seedPlatformOwner()).rejects.toThrow(/SEED_ADMIN_EMAIL/);
    process.env.SEED_ADMIN_EMAIL = email;
    process.env.SEED_ADMIN_PASSWORD = 'short';
    await expect(seedPlatformOwner()).rejects.toThrow(/12 characters/);
  });

  it('is idempotent and creates an active ps-owner', async () => {
    process.env.SEED_ADMIN_EMAIL = email;
    process.env.SEED_ADMIN_PASSWORD = crypto.randomBytes(12).toString('hex');
    expect(await seedPlatformOwner()).toBe('created');
    expect(await seedPlatformOwner()).toBe('exists');
    const rows = await testDb.select().from(users).where(and(eq(users.email, email)));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.role).toBe('ps-owner');
    expect(rows[0]?.status).toBe('active');
  });
});
