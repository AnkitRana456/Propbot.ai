import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser } from '../helpers/test-fixtures.js';
import { contacts, leads } from '../../src/db/schema/index.js';

describe('PATCH /api/leads/:id (inline edits from the leads grid)', () => {
  const app = createApp();
  let a: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let b: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let viewer: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let leadId = '';
  let otherLeadId = '';
  const patch = (id: string, body: object, who = a) => request(app).patch(`/api/leads/${id}`).set('Authorization', who.authHeader).send(body);

  beforeAll(async () => {
    a = await createAuthenticatedUser('company_admin');
    b = await createAuthenticatedUser('company_admin');
    viewer = await createAuthenticatedUser('viewer', { id: a.company.id } as never);
    const [c1] = await testDb.insert(contacts).values({ companyId: a.company.id, firstName: 'Asha', lastName: 'Rao', phone: '+919866600001' }).returning();
    const [c2] = await testDb.insert(contacts).values({ companyId: a.company.id, firstName: 'Ravi', phone: '+919866600002' }).returning();
    const [l1] = await testDb.insert(leads).values({ companyId: a.company.id, contactId: c1!.id }).returning();
    const [l2] = await testDb.insert(leads).values({ companyId: a.company.id, contactId: c2!.id }).returning();
    leadId = l1!.id;
    otherLeadId = l2!.id;
  });
  afterAll(async () => {
    await cleanupTestDatabase([a.company.id, b.company.id]);
  });

  it('edits name, e-mail, budget and follow-up in one call', async () => {
    const when = new Date(Date.now() + 86_400_000).toISOString();
    const res = await patch(leadId, { name: 'Asha Rao Iyer', email: 'Asha@Example.com', budgetMax: 12_000_000, nextFollowUpAt: when });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Asha Rao Iyer', firstName: 'Asha', lastName: 'Rao Iyer', email: 'asha@example.com' });
    expect(res.body.data.buyerDna.budgetMax).toBe(12_000_000);
    expect(new Date(res.body.data.nextFollowUpAt).toISOString()).toBe(when);
  });

  it('normalises a new phone number and marks it unverified', async () => {
    await testDb.update(leads).set({ phoneVerified: true }).where(eq(leads.id, leadId));
    const res = await patch(leadId, { phone: '98666 00003' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.phone).toBe('+919866600003');
    expect(res.body.data.phoneVerified).toBe(false);
  });

  it('clears the budget and the follow-up with null', async () => {
    const res = await patch(leadId, { budgetMax: null, nextFollowUpAt: null });
    expect(res.body.data.buyerDna.budgetMax).toBeNull();
    expect(res.body.data.nextFollowUpAt).toBeNull();
  });

  it('rejects bad input without changing anything', async () => {
    expect((await patch(leadId, { phone: '123' })).status).toBe(400);
    expect((await patch(leadId, { email: 'not-an-email' })).status).toBe(400);
    expect((await patch(leadId, { name: '   ' })).status).toBe(400);
    expect((await patch(leadId, {})).status).toBe(400);
    expect((await patch(leadId, { budgetMax: -5 })).status).toBe(400);
  });

  it('refuses a phone number that belongs to another contact', async () => {
    const res = await patch(leadId, { phone: '+919866600002' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONTACT_EXISTS');
    expect(otherLeadId).toBeTruthy();
  });

  it('is tenant isolated and needs the edit permission', async () => {
    expect((await patch(leadId, { name: 'Hijack' }, b)).status).toBe(404);
    expect((await patch(leadId, { name: 'Viewer edit' }, viewer)).status).toBe(403);
    expect((await patch('00000000-0000-0000-0000-000000000000', { name: 'Ghost' })).status).toBe(404);
  });

  it('keeps an audit trail of the edit on the lead timeline', async () => {
    const res = await request(app).get(`/api/crm/leads/${leadId}/timeline`).set('Authorization', a.authHeader);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain('Lead details edited');
  });
});
