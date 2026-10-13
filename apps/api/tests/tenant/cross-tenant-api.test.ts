import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser } from '../helpers/test-fixtures.js';

describe('Cross-Tenant API Attack Prevention', () => {
  const app = createApp();
  const createdCompanyIds: string[] = [];

  let tokenA: string;
  let tokenB: string;
  let companyAId: string;
  let companyBId: string;
  let userBId: string;

  beforeAll(async () => {
    const sessionA = await createAuthenticatedUser('company_admin');
    const sessionB = await createAuthenticatedUser('company_admin');

    companyAId = sessionA.company.id;
    companyBId = sessionB.company.id;
    tokenA = sessionA.token;
    tokenB = sessionB.token;
    userBId = sessionB.user.id;

    createdCompanyIds.push(companyAId, companyBId);
  });

  afterAll(async () => {
    await cleanupTestDatabase(createdCompanyIds);
  });

  it('rejects client requests that attempt to tamper or forge another companyId', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .query({ companyId: companyBId }) // Trying to inspect Company B
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TENANT_MISMATCH');
  });

  it('prohibits Company A admin from approving a user belonging to Company B', async () => {
    const res = await request(app)
      .post(`/api/auth/users/${userBId}/approve`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('prohibits Company A admin from disabling a user belonging to Company B', async () => {
    const res = await request(app)
      .post(`/api/auth/users/${userBId}/reject`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('guarantees /api/auth/me returns the authenticated tenant and never other tenants', async () => {
    const resA = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenA}`);

    expect(resA.status).toBe(200);
    expect(resA.body.data.tenant.companyId).toBe(companyAId);

    const resB = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenB}`);

    expect(resB.status).toBe(200);
    expect(resB.body.data.tenant.companyId).toBe(companyBId);
  });
});
