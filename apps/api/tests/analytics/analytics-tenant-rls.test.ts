import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  chatbots,
  conversations,
  contacts,
  leads,
} from '../../src/db/schema/index.js';

describe('Analytics Multi-Tenant Isolation & Authorization', () => {
  const app = createApp();
  const companyA = '99999999-9999-9999-9999-999999999925';
  const companyB = '99999999-9999-9999-9999-999999999926';
  const userA = '00000000-0000-0000-0000-000000000206';
  const userB = '00000000-0000-0000-0000-000000000207';
  const agentA = '00000000-0000-0000-0000-000000000208';

  const tokenA = signAccessToken({
    sub: userA,
    companyId: companyA,
    role: 'company_admin',
    status: 'active',
    email: 'admin@company-a.com',
    name: 'Admin A',
  });

  const tokenB = signAccessToken({
    sub: userB,
    companyId: companyB,
    role: 'company_admin',
    status: 'active',
    email: 'admin@company-b.com',
    name: 'Admin B',
  });

  const tokenAgentA = signAccessToken({
    sub: agentA,
    companyId: companyA,
    role: 'agent',
    status: 'active',
    email: 'agent@company-a.com',
    name: 'Agent A',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyA, companyB]);

    await testDb
      .insert(companies)
      .values([
        { id: companyA, name: 'Realty A', slug: 'realty-a-analytics', plan: 'enterprise', status: 'active' },
        { id: companyB, name: 'Realty B', slug: 'realty-b-analytics', plan: 'growth', status: 'active' },
      ])
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values([
        { id: userA, companyId: companyA, name: 'Admin A', email: 'admin@company-a.com', role: 'company_admin', status: 'active', passwordHash: 'dummy' },
        { id: userB, companyId: companyB, name: 'Admin B', email: 'admin@company-b.com', role: 'company_admin', status: 'active', passwordHash: 'dummy' },
        { id: agentA, companyId: companyA, name: 'Agent A', email: 'agent@company-a.com', role: 'agent', status: 'active', passwordHash: 'dummy' },
      ])
      .onConflictDoNothing();

    const botA = '88888888-8888-8888-8888-888888888825';
    await testDb
      .insert(chatbots)
      .values({ id: botA, companyId: companyA, name: 'Bot A', status: 'active', publicKey: 'pub_a_01' });

    // Seed 3 conversations for Company A
    for (let i = 1; i <= 3; i++) {
      await testDb.insert(conversations).values({
        companyId: companyA,
        chatbotId: botA,
        channel: 'web',
        status: 'bot',
      });
    }

    // Seed 1 lead for Company A
    const contactA = '66666666-6666-6666-6666-666666666025';
    await testDb.insert(contacts).values({
      id: contactA,
      companyId: companyA,
      firstName: 'Lead A',
      phone: '+919876500099',
    });
    await testDb.insert(leads).values({
      companyId: companyA,
      contactId: contactA,
      chatbotId: botA,
      status: 'qualified',
      source: 'chat',
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyA, companyB]);
  });

  it('Company A sees its own metrics', async () => {
    const resA = await request(app)
      .get('/api/analytics/kpis')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(resA.status).toBe(200);
    expect(resA.body.data.totalConversations.current).toBe(3);
    expect(resA.body.data.leadsGenerated.current).toBe(1);
  });

  it('Company B sees zero metrics and cannot see Company A records', async () => {
    const resB = await request(app)
      .get('/api/analytics/kpis')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(resB.status).toBe(200);
    expect(resB.body.data.totalConversations.current).toBe(0);
    expect(resB.body.data.leadsGenerated.current).toBe(0);
  });

  it('Role without view_analytics (agent) is rejected with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/analytics/kpis')
      .set('Authorization', `Bearer ${tokenAgentA}`);

    expect(res.status).toBe(403);
  });
});
