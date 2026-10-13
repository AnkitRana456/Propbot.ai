import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, contacts, leads, users, notes, tasks } from '../../src/db/schema/index.js';

describe('Cross-Tenant CRM Isolation', () => {
  const app = createApp();
  const companyAId = '77777777-7777-7777-7777-777777777777';
  const companyBId = '88888888-8888-8888-8888-888888888888';

  let leadAId: string;
  let userBId: string;
  let taskAId: string;

  const adminTokenCompanyA = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000071',
    companyId: companyAId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@company-a-crm.com',
    name: 'Admin A CRM',
  });

  const adminTokenCompanyB = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000081',
    companyId: companyBId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@company-b-crm.com',
    name: 'Admin B CRM',
  });

  beforeAll(async () => {
    await testDb.insert(companies).values([
      { id: companyAId, name: 'Tenant A Realty', slug: 'tenant-a-crm', plan: 'growth', status: 'active' },
      { id: companyBId, name: 'Tenant B Realty', slug: 'tenant-b-crm', plan: 'growth', status: 'active' },
    ]);

    await testDb
      .insert(users)
      .values({
        id: '00000000-0000-0000-0000-000000000071',
        companyId: companyAId,
        name: 'Admin A CRM',
        email: 'admin@company-a-crm.com',
        passwordHash: 'hash',
        role: 'company_admin',
        status: 'active',
      })
      .onConflictDoNothing();

    const [uB] = await testDb
      .insert(users)
      .values({
        companyId: companyBId,
        name: 'Agent Tenant B',
        email: 'agent@tenant-b.com',
        passwordHash: 'hash',
        role: 'agent',
        status: 'active',
      })
      .returning();
    userBId = uB.id;

    const [contactA] = await testDb
      .insert(contacts)
      .values({
        companyId: companyAId,
        firstName: 'Confidential Client',
        lastName: 'A',
        phone: '+919888800001',
      })
      .returning();

    const [contactB] = await testDb
      .insert(contacts)
      .values({
        companyId: companyBId,
        firstName: 'Confidential Client',
        lastName: 'B',
        phone: '+919888800002',
      })
      .returning();

    const [leadA] = await testDb
      .insert(leads)
      .values({
        companyId: companyAId,
        contactId: contactA.id,
        status: 'new',
        priority: 'urgent',
      })
      .returning();
    leadAId = leadA.id;

    await testDb
      .insert(leads)
      .values({
        companyId: companyBId,
        contactId: contactB.id,
        status: 'qualified',
        priority: 'medium',
      });

    await testDb
      .insert(notes)
      .values({
        companyId: companyAId,
        leadId: leadAId,
        userId: '00000000-0000-0000-0000-000000000071',
        content: 'Confidential Tenant A Strategy Note',
      });

    const [taskA] = await testDb
      .insert(tasks)
      .values({
        companyId: companyAId,
        leadId: leadAId,
        assignedUserId: '00000000-0000-0000-0000-000000000071',
        title: 'Tenant A VIP Follow-up',
        dueDate: new Date(),
      })
      .returning();
    taskAId = taskA.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);
  });

  it('Company B cannot view Company A pipeline leads', async () => {
    const res = await request(app)
      .get('/api/crm/pipeline')
      .set('Authorization', `Bearer ${adminTokenCompanyB}`);

    expect(res.status).toBe(200);
    const allFetchedLeadIds = res.body.data.columns.flatMap((c: { leads: { id: string }[] }) =>
      c.leads.map(l => l.id),
    );
    expect(allFetchedLeadIds).not.toContain(leadAId);
  });

  it('Company B cannot read Company A notes', async () => {
    const res = await request(app)
      .get(`/api/crm/leads/${leadAId}/notes`)
      .set('Authorization', `Bearer ${adminTokenCompanyB}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('Company B cannot modify Company A tasks', async () => {
    const res = await request(app)
      .patch(`/api/crm/tasks/${taskAId}`)
      .set('Authorization', `Bearer ${adminTokenCompanyB}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(400);
  });

  it('Company A cannot assign an agent belonging to Company B', async () => {
    const res = await request(app)
      .post(`/api/crm/leads/${leadAId}/assign`)
      .set('Authorization', `Bearer ${adminTokenCompanyA}`)
      .send({ agentId: userBId });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Assigned user not found');
  });
});
