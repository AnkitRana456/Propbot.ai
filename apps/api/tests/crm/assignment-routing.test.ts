import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, contacts, leads, users } from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';

describe('CRM Assignment & Routing Endpoints', () => {
  const app = createApp();
  const companyId = '33333333-3333-3333-3333-333333333333';
  let agent1Id: string;
  let agent2Id: string;
  let lead1Id: string;
  let lead2Id: string;

  const adminToken = signAccessToken({
    sub: '00000000-0000-0000-0000-000000000031',
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@assign-test.com',
    name: 'Admin Assign',
  });

  beforeAll(async () => {
    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Assignment Realty',
        slug: 'assign-realty',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    const [a1] = await testDb
      .insert(users)
      .values({
        companyId,
        name: 'Agent One',
        email: 'agent1@assign-realty.com',
        passwordHash: 'hash',
        role: 'agent',
        status: 'active',
      })
      .returning();
    agent1Id = a1.id;

    const [a2] = await testDb
      .insert(users)
      .values({
        companyId,
        name: 'Agent Two',
        email: 'agent2@assign-realty.com',
        passwordHash: 'hash',
        role: 'agent',
        status: 'active',
      })
      .returning();
    agent2Id = a2.id;

    const [contact1] = await testDb
      .insert(contacts)
      .values({
        companyId,
        firstName: 'Ananya',
        lastName: 'Sen',
        phone: '+919111122222',
      })
      .returning();

    const [contact2] = await testDb
      .insert(contacts)
      .values({
        companyId,
        firstName: 'Rohan',
        lastName: 'Gupta',
        phone: '+919333344444',
      })
      .returning();

    const [l1] = await testDb
      .insert(leads)
      .values({
        companyId,
        contactId: contact1.id,
        status: 'new',
        priority: 'high',
        intentScore: 80,
        source: 'chat',
      })
      .returning();
    lead1Id = l1.id;

    const [l2] = await testDb
      .insert(leads)
      .values({
        companyId,
        contactId: contact2.id,
        status: 'new',
        priority: 'medium',
        intentScore: 50,
        source: 'chat',
      })
      .returning();
    lead2Id = l2.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('POST /api/crm/leads/:leadId/assign manually assigns lead to agent', async () => {
    const res = await request(app)
      .post(`/api/crm/leads/${lead1Id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        agentId: agent1Id,
        reason: 'Client requested South Bangalore specialist',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.assignedAgentId).toBe(agent1Id);
    expect(res.body.data.assignedAgentName).toBe('Agent One');
  });

  it('POST /api/crm/leads/:leadId/round-robin automatically distributes to available agent', async () => {
    // Agent Two currently has 0 leads while Agent One has 1 lead
    const res = await request(app)
      .post(`/api/crm/leads/${lead2Id}/round-robin`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.assignedAgentId).toBe(agent2Id);
    expect(res.body.data.assignedAgentName).toBe('Agent Two');
  });

  it('POST /api/crm/leads/bulk-assign bulk assigns multiple leads', async () => {
    const res = await request(app)
      .post('/api/crm/leads/bulk-assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        leadIds: [lead1Id, lead2Id],
        agentId: agent1Id,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.updatedCount).toBe(2);

    const check = await testDb.query.leads.findFirst({
      where: eq(leads.id, lead2Id),
    });
    expect(check?.assignedAgentId).toBe(agent1Id);
  });
});
