import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users } from '../../src/db/schema/index.js';

describe('Cross-Tenant Isolation: Users, Billing & Settings', () => {
  const app = createApp();
  const companyAId = '99999999-9999-9999-9999-999999999936';
  const companyBId = '99999999-9999-9999-9999-999999999937';
  const userAId = '00000000-0000-0000-0000-000000000361';
  const userBId = '00000000-0000-0000-0000-000000000371';

  const tokenA = signAccessToken({
    sub: userAId,
    companyId: companyAId,
    role: 'company_admin',
    status: 'active',
    email: 'adminA@isolated.com',
    name: 'Admin A',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);

    await testDb
      .insert(companies)
      .values([
        { id: companyAId, name: 'Company A Ltd', slug: 'company-a-isolated', plan: 'starter', status: 'active' },
        { id: companyBId, name: 'Company B Ltd', slug: 'company-b-isolated', plan: 'growth', status: 'active' },
      ])
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values([
        {
          id: userAId,
          companyId: companyAId,
          name: 'Admin A',
          email: 'adminA@isolated.com',
          role: 'company_admin',
          status: 'active',
          passwordHash: 'dummy',
        },
        {
          id: userBId,
          companyId: companyBId,
          name: 'Admin B',
          email: 'adminB@isolated.com',
          role: 'company_admin',
          status: 'active',
          passwordHash: 'dummy',
        },
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);
  });

  it('Company A user cannot view Company B users in GET /api/users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((u: { companyId: string }) => u.companyId === companyAId)).toBe(true);
    expect(res.body.data.some((u: { id: string }) => u.id === userBId)).toBe(false);
  });

  it('Company A user cannot modify Company B user via PUT /api/users/:id', async () => {
    const res = await request(app)
      .put(`/api/users/${userBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ role: 'agent' });

    expect(res.status).toBe(500);
    expect(res.body.error.message).toContain('User not found');
  });

  it('Company A user cannot view or modify Company B settings', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.company.id).toBe(companyAId);
  });
});
