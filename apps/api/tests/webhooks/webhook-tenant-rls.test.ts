import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  webhookEndpoints,
  webhookLogs,
} from '../../src/db/schema/index.js';

describe('Webhook Multi-Tenant Isolation & Cross-Tenant Security', () => {
  const app = createApp();
  const companyA = '99999999-9999-9999-9999-999999999915';
  const companyB = '99999999-9999-9999-9999-999999999916';
  const userA = '00000000-0000-0000-0000-000000000101';
  const userB = '00000000-0000-0000-0000-000000000102';

  let endpointAId: string;
  let logAId: string;

  const _tokenA = signAccessToken({
    sub: userA,
    companyId: companyA,
    role: 'company_admin',
    status: 'active',
    email: 'admin@company-a.com',
    name: 'Admin A',
  });

  const tokenB = signAccessToken({
    sub: userB,
    companyId: companyB,
    role: 'company_admin',
    status: 'active',
    email: 'admin@company-b.com',
    name: 'Admin B',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyA, companyB]);

    await testDb
      .insert(companies)
      .values([
        { id: companyA, name: 'Tenant A Realty', slug: 'tenant-a-wh', plan: 'growth', status: 'active' },
        { id: companyB, name: 'Tenant B Realty', slug: 'tenant-b-wh', plan: 'growth', status: 'active' },
      ])
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values([
        { id: userA, companyId: companyA, name: 'Admin A', email: 'admin@company-a.com', role: 'company_admin', status: 'active', passwordHash: 'dummy' },
        { id: userB, companyId: companyB, name: 'Admin B', email: 'admin@company-b.com', role: 'company_admin', status: 'active', passwordHash: 'dummy' },
      ])
      .onConflictDoNothing();

    const [epA] = await testDb
      .insert(webhookEndpoints)
      .values({
        companyId: companyA,
        name: 'Company A Secret Webhook',
        url: 'https://api.company-a.com/hooks',
        secret: 'whsec_secret_a',
        subscribedEvents: ['lead_captured'],
      })
      .returning();

    endpointAId = epA!.id;

    const [logA] = await testDb
      .insert(webhookLogs)
      .values({
        companyId: companyA,
        endpointId: endpointAId,
        eventType: 'lead_captured',
        status: 'success',
        statusCode: 200,
        requestPayload: { secret_lead: 'Confidential A Lead' },
      })
      .returning();

    logAId = logA!.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyA, companyB]);
  });

  it("Company B cannot view Company A's webhook endpoints", async () => {
    const res = await request(app)
      .get('/api/webhooks/endpoints')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    const endpoints = res.body.data;
    expect(endpoints.some((ep: { id: string }) => ep.id === endpointAId)).toBe(false);
  });

  it("Company B cannot view Company A's delivery logs", async () => {
    const res = await request(app)
      .get('/api/webhooks/logs')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    const logs = res.body.data.items;
    expect(logs.some((l: { id: string }) => l.id === logAId)).toBe(false);
  });

  it("Company B cannot replay Company A's webhook log", async () => {
    const res = await request(app)
      .post(`/api/webhooks/logs/${logAId}/replay`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it("Company B cannot delete Company A's webhook endpoint", async () => {
    const res = await request(app)
      .delete(`/api/webhooks/endpoints/${endpointAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
  });
});
