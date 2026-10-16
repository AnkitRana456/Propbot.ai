import crypto from 'crypto';
import type { UserRole, UserStatus } from '@propbot/shared';
import { sql } from 'drizzle-orm';
import { testDb } from './test-db.js';
import { companies, companyAiSettings, users } from '../../src/db/schema/index.js';
import { hashPassword, signAccessToken } from '../../src/modules/auth/auth.utils.js';

export interface TestCompanyData {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
}

export interface TestUserData {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  rawPassword: string;
}

export async function createTestCompany(
  overrides: Partial<typeof companies.$inferInsert> = {},
): Promise<TestCompanyData> {
  const rand = crypto.randomBytes(4).toString('hex');
  const name = overrides.name ?? `Test Realty ${rand}`;
  const slug = overrides.slug ?? `test-realty-${rand}`;

  return await testDb.transaction(async tx => {
    await tx.execute(sql`SET LOCAL ROLE postgres`);

    const [company] = await tx
      .insert(companies)
      .values({
        name,
        slug,
        plan: overrides.plan ?? 'growth',
        status: overrides.status ?? 'active',
        ...overrides,
      })
      .returning();

    if (!company) {
      throw new Error('Failed to insert test company');
    }

    await tx.insert(companyAiSettings).values({
      companyId: company.id,
      killSwitch: false,
      allowedTiers: ['T0', 'T1'],
      dailyActionCap: 100,
    });

    return company;
  });
}

export async function createTestUser(
  companyId: string,
  overrides: Partial<TestUserData> = {},
): Promise<TestUserData> {
  const rand = crypto.randomBytes(4).toString('hex');
  const rawPassword = overrides.rawPassword ?? 'SecureP@ssw0rd123!';
  const passwordHash = await hashPassword(rawPassword);
  const name = overrides.name ?? `Agent ${rand}`;
  const email = overrides.email ?? `agent_${rand}@example.com`;
  const role = overrides.role ?? 'agent';
  const status = overrides.status ?? 'active';

  const [user] = await testDb
    .insert(users)
    .values({
      companyId,
      name,
      email,
      passwordHash,
      role,
      status,
    })
    .returning();

  if (!user) {
    throw new Error('Failed to insert test user');
  }

  return {
    id: user.id,
    companyId: user.companyId,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    status: user.status as UserStatus,
    rawPassword,
  };
}

export async function createAuthenticatedUser(
  role: UserRole = 'company_admin',
  companyOverrides: Partial<typeof companies.$inferInsert> = {},
  userOverrides: Partial<TestUserData> = {},
) {
  let company: TestCompanyData;
  if (companyOverrides.id) {
    const existing = await testDb.query.companies.findFirst({
      where: (c, { eq }) => eq(c.id, companyOverrides.id!),
    });
    if (existing) {
      company = existing;
    } else {
      company = await createTestCompany(companyOverrides);
    }
  } else {
    company = await createTestCompany(companyOverrides);
  }

  const user = await createTestUser(company.id, { role, ...userOverrides });

  const token = signAccessToken({
    sub: user.id,
    companyId: company.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
  });

  return {
    company,
    user,
    token,
    authHeader: `Bearer ${token}`,
  };
}

export async function createTenantPair() {
  const tenantA = await createAuthenticatedUser('company_admin', { name: 'Company Alpha' });
  const tenantB = await createAuthenticatedUser('company_admin', { name: 'Company Beta' });

  return {
    tenantA,
    tenantB,
  };
}
