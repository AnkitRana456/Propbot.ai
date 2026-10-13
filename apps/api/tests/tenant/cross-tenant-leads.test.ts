import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, chatbots, contacts, leads } from '../../src/db/schema/index.js';

describe('Cross-Tenant Lead Security & Isolation', () => {
  const app = createApp();

  const companyAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const companyBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  let leadCompanyAId: string;

  const adminTokenCompanyA = signAccessToken({
    sub: '00000000-0000-0000-0000-00000000000a',
    companyId: companyAId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@company-a.com',
    name: 'Admin Company A',
  });

  const adminTokenCompanyB = signAccessToken({
    sub: '00000000-0000-0000-0000-00000000000b',
    companyId: companyBId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@company-b.com',
    name: 'Admin Company B',
  });

  beforeAll(async () => {
    // Seed Company A & B
    await testDb.insert(companies).values([
      { id: companyAId, name: 'Company A Realty', slug: 'company-a-leads', plan: 'growth', status: 'active' },
      { id: companyBId, name: 'Company B Realty', slug: 'company-b-leads', plan: 'growth', status: 'active' },
    ]);

    const [botA] = await testDb.insert(chatbots).values({
      companyId: companyAId,
      name: 'Bot A',
      publicKey: 'pb_live_tenant_a_leads_key_12345678901234',
    }).returning();

    const [contactA] = await testDb.insert(contacts).values({
      companyId: companyAId,
      firstName: 'Confidential',
      lastName: 'Client A',
      phone: '+919999988888',
      email: 'secret@clienta.com',
    }).returning();

    const [leadA] = await testDb.insert(leads).values({
      companyId: companyAId,
      contactId: contactA.id,
      chatbotId: botA.id,
      intentScore: 85,
      intentLabel: 'hot',
      buyerDna: {
        budgetMin: 50000000,
        budgetMax: 70000000,
        bhk: ['4BHK'],
        localities: ['Indiranagar'],
        propertyType: 'penthouse',
        purpose: 'end_use',
        timeline: 'immediate',
        financing: 'self_funded',
        familySize: 4,
        mustHaves: ['Private Pool'],
        dealBreakers: [],
        objections: [],
        competitorsMentioned: [],
        language: 'en',
        confidence: {},
        explicitFields: [],
      },
    }).returning();

    leadCompanyAId = leadA.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);
  });

  it('Company A admin can view their own lead and Buyer DNA', async () => {
    const res = await request(app)
      .get(`/api/leads/${leadCompanyAId}`)
      .set('Authorization', `Bearer ${adminTokenCompanyA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(leadCompanyAId);
    expect(res.body.data.name).toBe('Confidential Client A');
    expect(res.body.data.buyerDna.propertyType).toBe('penthouse');
    expect(res.body.data.intentScore).toBe(85);
  });

  it('Company B admin receives 404 when attempting to access Company A lead', async () => {
    const res = await request(app)
      .get(`/api/leads/${leadCompanyAId}`)
      .set('Authorization', `Bearer ${adminTokenCompanyB}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('Company B admin cannot modify status of Company A lead', async () => {
    const res = await request(app)
      .patch(`/api/leads/${leadCompanyAId}/status`)
      .set('Authorization', `Bearer ${adminTokenCompanyB}`)
      .send({ status: 'lost', lostReason: 'Unauthorized cross-tenant attack' });

    expect(res.status).toBe(404);
  });

  it('blocks attempts to tamper with companyId via body or query', async () => {
    const res = await request(app)
      .get(`/api/leads?companyId=${companyAId}`)
      .set('Authorization', `Bearer ${adminTokenCompanyB}`);

    // tenantGuard middleware catches claimed company mismatch
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TENANT_MISMATCH');
  });
});
