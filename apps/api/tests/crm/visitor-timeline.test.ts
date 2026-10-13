import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, contacts, leads, leadActivities } from '../../src/db/schema/index.js';

describe('CRM Visitor Timeline Endpoints', () => {
  const app = createApp();
  const companyId = '55555555-5555-5555-5555-555555555555';
  let leadId: string;

  const adminToken = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000051',
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@timeline-test.com',
    name: 'Admin Timeline',
  });

  beforeAll(async () => {
    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Timeline Test Realty',
        slug: 'timeline-test-realty',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    const [contact] = await testDb
      .insert(contacts)
      .values({
        companyId,
        firstName: 'Divya',
        lastName: 'Nair',
        phone: '+919666677777',
      })
      .returning();

    const [lead] = await testDb
      .insert(leads)
      .values({
        companyId,
        contactId: contact.id,
        status: 'new',
        priority: 'high',
        intentScore: 70,
        source: 'chat',
      })
      .returning();
    leadId = lead.id;

    // Seed activities
    await testDb.insert(leadActivities).values([
      {
        companyId,
        leadId,
        contactId: contact.id,
        activityType: 'page_view',
        title: 'Visited Landing Page: Prestige Lakeside',
        description: 'Viewed 3BHK luxury floor plans and amenities',
        metadata: { page: '/properties/prestige-lakeside' },
      },
      {
        companyId,
        leadId,
        contactId: contact.id,
        activityType: 'chat_message',
        title: 'Initiated Chat Conversation',
        description: 'Visitor asked about possession date and RERA registration',
      },
      {
        companyId,
        leadId,
        contactId: contact.id,
        activityType: 'brochure_opened',
        title: 'Brochure PDF Downloaded',
        description: 'Prestige Lakeside e-brochure opened on mobile device',
      },
    ]);
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('GET /api/crm/leads/:leadId/timeline returns chronological visitor feed', async () => {
    const res = await request(app)
      .get(`/api/crm/leads/${leadId}/timeline`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(3);
    expect(res.body.data.items.some((i: { activityType: string }) => i.activityType === 'brochure_opened')).toBe(true);
    expect(res.body.data.items.some((i: { activityType: string }) => i.activityType === 'page_view')).toBe(true);
  });
});
