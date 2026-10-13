import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users } from '../../src/db/schema/index.js';

describe('Subscription Lifecycle & Invoicing', () => {
  const app = createApp();
  const companyId = '99999999-9999-9999-9999-999999999932';
  const adminId = '00000000-0000-0000-0000-000000000321';

  const adminToken = signAccessToken({
    sub: adminId,
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@billingtest.com',
    name: 'Billing Admin',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Billing Realty Ltd',
        slug: 'billing-realty',
        plan: 'trial',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: adminId,
        companyId,
        name: 'Admin',
        email: 'admin@billingtest.com',
        role: 'company_admin',
        status: 'active',
        passwordHash: 'dummy',
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('GET /api/subscription returns current plan, limits, and usage meters', async () => {
    const res = await request(app)
      .get('/api/subscription')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plan).toBe('trial');
    expect(res.body.data.limits.chatbots).toBe(1);
    expect(res.body.data.usage.chatbots).toBeDefined();
    expect(res.body.data.usage.users).toBeDefined();
  });

  it('POST /api/subscription/checkout initiates checkout and transitions plan to growth', async () => {
    const res = await request(app)
      .post('/api/subscription/checkout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plan: 'growth',
        billingCycle: 'monthly',
        provider: 'mock',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.checkoutUrl).toBeDefined();

    // Verify subscription updated
    const overviewRes = await request(app)
      .get('/api/subscription')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(overviewRes.body.data.plan).toBe('growth');
    expect(overviewRes.body.data.limits.chatbots).toBe(10);
    expect(overviewRes.body.data.limits.features.whiteLabel).toBe(true);
  });

  it('GET /api/subscription/invoices retrieves generated tax invoice', async () => {
    const res = await request(app)
      .get('/api/subscription/invoices')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].invoiceNumber).toContain('INV-');
    expect(res.body.data[0].status).toBe('paid');
  });

  it('POST /api/subscription/lead-credits adds delivery credits to company balance', async () => {
    const res = await request(app)
      .post('/api/subscription/lead-credits')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        credits: 100,
        provider: 'mock',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.creditsAdded).toBe(100);
    expect(res.body.newBalance).toBeGreaterThanOrEqual(100);

    // Verify transaction history
    const txRes = await request(app)
      .get('/api/subscription/lead-credits/transactions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(txRes.status).toBe(200);
    expect(txRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(txRes.body.data[0].type).toBe('purchase');
  });

  it('POST /api/subscription/cancel marks subscription as canceled', async () => {
    const res = await request(app)
      .post('/api/subscription/cancel')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const overviewRes = await request(app)
      .get('/api/subscription')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(overviewRes.body.data.status).toBe('canceled');
  });
});
