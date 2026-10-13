import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, contacts, leads } from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';

describe('CRM Contacts & Organizations Endpoints', () => {
  const app = createApp();
  const companyId = '66666666-6666-6666-6666-666666666666';
  let contact1Id: string;
  let contact2Id: string;
  let lead1Id: string;
  let lead2Id: string;

  const adminToken = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000061',
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@contacts-test.com',
    name: 'Admin Contacts',
  });

  beforeAll(async () => {
    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Contacts Test Realty',
        slug: 'contacts-test-realty',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    const [c1] = await testDb
      .insert(contacts)
      .values({
        companyId,
        firstName: 'Amit',
        lastName: 'Shah',
        phone: '+919555511111',
        email: 'amit@example.com',
      })
      .returning();
    contact1Id = c1.id;

    const [c2] = await testDb
      .insert(contacts)
      .values({
        companyId,
        firstName: 'Amit',
        lastName: 'K Shah',
        phone: '+919555522222',
        email: 'amit.shah@business.com',
      })
      .returning();
    contact2Id = c2.id;

    const [l1] = await testDb
      .insert(leads)
      .values({
        companyId,
        contactId: contact1Id,
        status: 'new',
        priority: 'high',
        source: 'chat',
      })
      .returning();
    lead1Id = l1.id;

    const [l2] = await testDb
      .insert(leads)
      .values({
        companyId,
        contactId: contact2Id,
        status: 'qualified',
        priority: 'medium',
        source: 'whatsapp',
      })
      .returning();
    lead2Id = l2.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('GET /api/crm/contacts lists contacts with linked lead counts', async () => {
    const res = await request(app)
      .get('/api/crm/contacts')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
    const amit1 = res.body.data.items.find((c: { id: string }) => c.id === contact1Id);
    expect(amit1?.leadCount).toBe(1);
  });

  it('GET /api/crm/contacts/:contactId returns contact profile with all linked inquiries', async () => {
    const res = await request(app)
      .get(`/api/crm/contacts/${contact1Id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.contact.firstName).toBe('Amit');
    expect(res.body.data.leads).toHaveLength(1);
    expect(res.body.data.leads[0].id).toBe(lead1Id);
  });

  it('POST /api/crm/contacts/merge merges source contact into target contact', async () => {
    const res = await request(app)
      .post('/api/crm/contacts/merge')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sourceContactId: contact2Id,
        targetContactId: contact1Id,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.contact.id).toBe(contact1Id);

    // Verify lead2 now points to contact1
    const updatedLead2 = await testDb.query.leads.findFirst({
      where: eq(leads.id, lead2Id),
    });
    expect(updatedLead2?.contactId).toBe(contact1Id);

    // Verify contact2 was soft deleted
    const deletedContact2 = await testDb.query.contacts.findFirst({
      where: eq(contacts.id, contact2Id),
    });
    expect(deletedContact2?.deletedAt).not.toBeNull();
  });

  it('POST & GET /api/crm/organizations manages organizations', async () => {
    const createRes = await request(app)
      .post('/api/crm/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Apex Capital Investments',
        industry: 'Real Estate Investment Trust',
        website: 'https://apexcapital.example.com',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.name).toBe('Apex Capital Investments');

    const listRes = await request(app)
      .get('/api/crm/organizations')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items.some((o: { name: string }) => o.name === 'Apex Capital Investments')).toBe(true);
  });
});
