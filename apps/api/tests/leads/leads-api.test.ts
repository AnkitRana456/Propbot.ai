import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, companyAiSettings } from '../../src/db/schema/index.js';

describe('Leads API Endpoints', () => {
  const app = createApp();

  const companyAId = '11111111-1111-1111-1111-111111111111';

  beforeAll(async () => {
    await testDb
      .insert(companies)
      .values({
        id: companyAId,
        name: 'Company A Test',
        slug: 'company-a-test-leads',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(companyAiSettings)
      .values({
        companyId: companyAId,
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyAId]);
  });

  const adminTokenCompanyA = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000001',
    companyId: companyAId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@companya.com',
    name: 'Admin Company A',
  });

  const viewerTokenCompanyA = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000002',
    companyId: companyAId,
    role: 'viewer',
    status: 'active',
    email: 'viewer@companya.com',
    name: 'Viewer Company A',
  });

  it('rejects unauthenticated requests to /api/leads with 401', async () => {
    const res = await request(app).get('/api/leads');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows authorized user to list leads', async () => {
    const res = await request(app)
      .get('/api/leads?status=all&limit=10')
      .set('Authorization', `Bearer ${adminTokenCompanyA}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('returns 400 for invalid lead capture payload', async () => {
    const res = await request(app)
      .post('/api/leads/capture')
      .set('Authorization', `Bearer ${adminTokenCompanyA}`)
      .send({
        // missing required fields
        email: 'invalid-email',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('gets company scoring configuration', async () => {
    const res = await request(app)
      .get('/api/leads/settings/scoring')
      .set('Authorization', `Bearer ${adminTokenCompanyA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.thresholds).toBeDefined();
    expect(res.body.data.weights).toBeDefined();
  });

  it('allows company_admin to update scoring configuration', async () => {
    const res = await request(app)
      .put('/api/leads/settings/scoring')
      .set('Authorization', `Bearer ${adminTokenCompanyA}`)
      .send({
        thresholds: {
          coldMax: 30,
          warmMin: 31,
          warmMax: 69,
          hotMin: 70,
        },
        weights: {
          requestedSiteVisit: 30,
          sharedPhone: 25,
          askedPricePaymentPlan: 15,
          budgetFitInventory: 15,
          urgencyWords: 15,
          viewedShortlistRoom: 10,
          askedPossessionDate: 10,
          returnedToChat: 10,
          messagesDepth5: 5,
          messagesDepth10: 5,
          sentimentPositive: 5,
          timeOnPage: 5,
          brokerCasualDeduction: -25,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.weights.requestedSiteVisit).toBe(30);
  });

  it('rejects viewer without edit_leads permission from modifying status', async () => {
    const res = await request(app)
      .patch('/api/leads/33333333-3333-3333-3333-333333333333/status')
      .set('Authorization', `Bearer ${viewerTokenCompanyA}`)
      .send({
        status: 'qualified',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_PERMISSION');
  });
});
