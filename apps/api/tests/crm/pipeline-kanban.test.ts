import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, contacts, leads, domainEvents, tasks, users } from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';

describe('CRM Pipeline & Kanban Endpoints', () => {
  const app = createApp();
  const companyId = '22222222-2222-2222-2222-222222222222';
  let leadId: string;

  const adminToken = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000021',
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@crm-pipeline.com',
    name: 'Admin CRM',
  });

  beforeAll(async () => {
    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'CRM Test Realty',
        slug: 'crm-test-realty',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: '00000000-0000-0000-0000-000000000021',
        companyId,
        name: 'Admin CRM',
        email: 'admin@crm-pipeline.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      })
      .onConflictDoNothing();

    const [contact] = await testDb
      .insert(contacts)
      .values({
        companyId,
        firstName: 'Vikram',
        lastName: 'Malhotra',
        phone: '+919876543210',
        email: 'vikram@example.com',
      })
      .returning();

    const [lead] = await testDb
      .insert(leads)
      .values({
        companyId,
        contactId: contact.id,
        status: 'new',
        priority: 'high',
        intentScore: 75,
        intentLabel: 'hot',
        source: 'chat',
      })
      .returning();

    leadId = lead.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('GET /api/crm/pipeline returns 8 real-estate stages with leads', async () => {
    const res = await request(app)
      .get('/api/crm/pipeline')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.columns).toHaveLength(8);
    expect(res.body.data.columns.map((c: { id: string }) => c.id)).toEqual([
      'new',
      'contacted',
      'qualified',
      'site_visit_scheduled',
      'site_visit_done',
      'negotiation',
      'booked',
      'lost',
    ]);

    const newCol = res.body.data.columns.find((c: { id: string }) => c.id === 'new');
    expect(newCol.count).toBeGreaterThanOrEqual(1);
    expect(newCol.leads.some((l: { id: string }) => l.id === leadId)).toBe(true);
  });

  it('PATCH /api/crm/pipeline/:leadId/stage moves lead to site_visit_scheduled and auto-creates task', async () => {
    const res = await request(app)
      .patch(`/api/crm/pipeline/${leadId}/stage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'site_visit_scheduled' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('site_visit_scheduled');

    // Verify auto-created task
    const taskRows = await testDb.query.tasks.findMany({
      where: eq(tasks.leadId, leadId),
    });
    expect(taskRows.some(t => t.title.includes('confirm site visit'))).toBe(true);
  });

  it('PATCH /api/crm/pipeline/:leadId/stage enforces mandatory lostReason when moving to lost', async () => {
    // Missing lost reason
    const failRes = await request(app)
      .patch(`/api/crm/pipeline/${leadId}/stage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'lost' });

    expect(failRes.status).toBe(400);

    // With lost reason
    const okRes = await request(app)
      .patch(`/api/crm/pipeline/${leadId}/stage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'lost', lostReason: 'Budget mismatch (Price too high)' });

    expect(okRes.status).toBe(200);
    expect(okRes.body.data.status).toBe('lost');
    expect(okRes.body.data.lostReason).toBe('Budget mismatch (Price too high)');

    // Verify event emitted
    const events = await testDb.query.domainEvents.findMany({
      where: eq(domainEvents.companyId, companyId),
    });
    expect(events.some(e => e.type === 'lead_status_changed')).toBe(true);
  });

  it('POST /api/crm/pipeline/bulk-status bulk updates multiple leads', async () => {
    const res = await request(app)
      .post('/api/crm/pipeline/bulk-status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        leadIds: [leadId],
        status: 'qualified',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.updatedCount).toBe(1);

    const check = await request(app)
      .get(`/api/leads/${leadId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(check.body.data.status).toBe('qualified');
  });
});
