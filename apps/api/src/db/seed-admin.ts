import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from './index.js';
import { companies, companyAiSettings, users } from './schema/index.js';
import { hashPassword } from '../modules/auth/auth.utils.js';

const PLATFORM_SLUG = 'propbot-platform';

/**
 * Idempotently creates the platform owner (role ps-owner) from env vars.
 * Safe to run repeatedly; an existing owner's password is only reset with SEED_ADMIN_RESET_PASSWORD=true.
 */
export async function seedPlatformOwner(): Promise<'created' | 'exists' | 'password_reset'> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to seed the platform owner.');
  }
  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters.');
  }

  await db
    .insert(companies)
    .values({ name: 'PropBot Platform', slug: PLATFORM_SLUG, plan: 'enterprise', status: 'active' })
    .onConflictDoNothing();
  const company = await db.query.companies.findFirst({ where: eq(companies.slug, PLATFORM_SLUG) });
  if (!company) throw new Error('Failed to resolve platform company.');

  await db
    .insert(companyAiSettings)
    .values({ companyId: company.id, killSwitch: false, allowedTiers: ['T0', 'T1'], dailyActionCap: 100 })
    .onConflictDoNothing();

  const existing = await db.query.users.findFirst({
    where: and(eq(users.companyId, company.id), eq(users.email, email)),
  });

  if (existing) {
    if (process.env.SEED_ADMIN_RESET_PASSWORD === 'true') {
      await db
        .update(users)
        .set({ passwordHash: await hashPassword(password), role: 'ps-owner', status: 'active', updatedAt: new Date() })
        .where(eq(users.id, existing.id));
      return 'password_reset';
    }
    if (existing.role !== 'ps-owner' || existing.status !== 'active') {
      await db.update(users).set({ role: 'ps-owner', status: 'active', updatedAt: new Date() }).where(eq(users.id, existing.id));
    }
    return 'exists';
  }

  await db.insert(users).values({
    companyId: company.id,
    name: 'Platform Owner',
    email,
    passwordHash: await hashPassword(password),
    role: 'ps-owner',
    status: 'active',
  });
  return 'created';
}

if (process.argv[1] && /seed-admin\.(ts|js)$/.test(process.argv[1])) {
  seedPlatformOwner()
    .then(result => {
      console.info(`Platform owner: ${result}`);
      process.exit(0);
    })
    .catch(err => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
