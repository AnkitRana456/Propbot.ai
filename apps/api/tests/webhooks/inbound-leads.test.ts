import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  leads,
  contacts,
  domainEvents,
  whatsappConfigs,
} from '../../src/db/schema/index.js';
import { eq, and } from 'drizzle-orm';

describe('Inbound Portal Lead Ingestion & Webhook Ingestion', () => {
  const app = createApp();
  const companyId = '99999999-9999-9999-9999-999999999912';
  const userId = '00000000-0000-0000-0000-000000000100';

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Inbound Portal Realty',
        slug: 'webhook-inbound-p10',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userId,
        companyId,
        name: 'Inbound Admin',
        email: 'admin@webhook-inbound.com',
        role: 'company_admin',
        status: 'active',
        passwordHash: 'dummy',
      })
      .onConflictDoNothing();

    await testDb
      .insert(whatsappConfigs)
      .values({
        companyId,
        phoneNumberId: '104928172635410',
        businessPhoneNumber: '+919876543210',
        accessToken: 'EAAG_test_token',
        verifyToken: 'token_123',
        enableAutomation: true,
        aiAutoReplies: true,
        status: 'connected',
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('POST /api/webhooks/inbound/leads captures portal inquiry and emits lead_created event', async () => {
    const portalPayload = {
      portal: '99acres',
      name: 'Pooja Hegde',
      phone: '+919876500012',
      email: 'pooja@example.com',
      project: 'Prestige Serenity Shores',
      budget: '2.5 Cr - 3 Cr',
      configuration: '3 BHK',
      externalLeadId: '99A_LEAD_84710',
      notes: 'Visitor requested callback regarding floor plan and possession timeline',
    };

    const res = await request(app)
      .post('/api/webhooks/inbound/leads')
      .set('X-PropBot-Company-Id', companyId)
      .send(portalPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.leadId).toBeDefined();

    // 1. Verify Lead was created with source = 99acres
    const lead = await testDb.query.leads.findFirst({
      where: and(eq(leads.companyId, companyId), eq(leads.id, res.body.data.leadId)),
    });
    expect(lead).toBeDefined();
    expect(lead?.source).toBe('99acres');

    // 2. Verify Contact was created with parsed name
    const contact = await testDb.query.contacts.findFirst({
      where: and(eq(contacts.companyId, companyId), eq(contacts.phone, '+919876500012')),
    });
    expect(contact).toBeDefined();
    expect(contact?.firstName).toBe('Pooja');
    expect(contact?.lastName).toBe('Hegde');

    // 3. Verify lead_created event in domain_events outbox
    const events = await testDb
      .select()
      .from(domainEvents)
      .where(and(eq(domainEvents.companyId, companyId), eq(domainEvents.type, 'lead_created')));

    expect(events.length).toBeGreaterThanOrEqual(1);
    const event = events.find(e => (e.payload as Record<string, unknown>)?.source === '99acres');
    expect(event).toBeDefined();
    const payload = event?.payload as Record<string, unknown>;
    expect(payload?.source).toBe('99acres');
    expect(payload?.name).toBe('Pooja Hegde');
  });
});
