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
  messages,
  contacts,
  leads,
} from '../../src/db/schema/index.js';

describe('Analytics KPIs & Metric Calculations', () => {
  const app = createApp();
  const companyId = '99999999-9999-9999-9999-999999999920';
  const emptyCompanyId = '99999999-9999-9999-9999-999999999921';
  const userId = '00000000-0000-0000-0000-000000000201';
  const emptyUserId = '00000000-0000-0000-0000-000000000202';
  const botId = '88888888-8888-8888-8888-888888888801';

  const token = signAccessToken({
    sub: userId,
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@analyticstest.com',
    name: 'Analytics Admin',
  });

  const emptyToken = signAccessToken({
    sub: emptyUserId,
    companyId: emptyCompanyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@emptyanalytics.com',
    name: 'Empty Admin',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyId, emptyCompanyId]);

    await testDb
      .insert(companies)
      .values([
        { id: companyId, name: 'Analytics Realty Ltd', slug: 'analytics-realty', plan: 'enterprise', status: 'active' },
        { id: emptyCompanyId, name: 'Fresh Realty Ltd', slug: 'fresh-realty', plan: 'starter', status: 'active' },
      ])
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values([
        { id: userId, companyId, name: 'Admin', email: 'admin@analyticstest.com', role: 'company_admin', status: 'active', passwordHash: 'dummy' },
        { id: emptyUserId, companyId: emptyCompanyId, name: 'Empty Admin', email: 'admin@emptyanalytics.com', role: 'company_admin', status: 'active', passwordHash: 'dummy' },
      ])
      .onConflictDoNothing();

    await testDb
      .insert(chatbots)
      .values({
        id: botId,
        companyId,
        name: 'Main Sales Bot',
        status: 'active',
        publicKey: 'pub_analytics_test_bot_01',
      })
      .onConflictDoNothing();

    // Seed 4 conversations in current period (last 7 days)
    const conv1 = '77777777-7777-7777-7777-777777777001';
    const conv2 = '77777777-7777-7777-7777-777777777002';
    const conv3 = '77777777-7777-7777-7777-777777777003';
    const conv4 = '77777777-7777-7777-7777-777777777004';

    await testDb.insert(conversations).values([
      { id: conv1, companyId, chatbotId: botId, channel: 'web', status: 'bot' },
      { id: conv2, companyId, chatbotId: botId, channel: 'web', status: 'bot' },
      { id: conv3, companyId, chatbotId: botId, channel: 'whatsapp', status: 'bot' },
      { id: conv4, companyId, chatbotId: botId, channel: 'web', status: 'bot' },
    ]);

    // Seed messages with response latencies and sentiments
    await testDb.insert(messages).values([
      { companyId, conversationId: conv1, senderType: 'bot', content: 'Hello!', latencyMs: 1200, sentiment: 'positive' },
      { companyId, conversationId: conv2, senderType: 'bot', content: 'Here are details.', latencyMs: 1800, sentiment: 'positive' },
      { companyId, conversationId: conv3, senderType: 'bot', content: 'WhatsApp reply.', latencyMs: 800, sentiment: 'positive' },
      { companyId, conversationId: conv4, senderType: 'bot', content: 'Goodbye!', latencyMs: 2200, sentiment: 'neutral' },
    ]);

    // Seed 2 contacts and 2 leads in current period
    const contact1 = '66666666-6666-6666-6666-666666666001';
    const contact2 = '66666666-6666-6666-6666-666666666002';

    await testDb.insert(contacts).values([
      { id: contact1, companyId, firstName: 'Rohan', lastName: 'Kapoor', phone: '+919876500001' },
      { id: contact2, companyId, firstName: 'Priya', lastName: 'Menon', phone: '+919876500002' },
    ]);

    await testDb.insert(leads).values([
      {
        companyId,
        contactId: contact1,
        chatbotId: botId,
        status: 'qualified',
        priority: 'high',
        intentScore: 78,
        source: 'chat',
      },
      {
        companyId,
        contactId: contact2,
        chatbotId: botId,
        status: 'booked',
        priority: 'hot',
        intentScore: 92,
        source: 'whatsapp',
      },
    ]);
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId, emptyCompanyId]);
  });

  it('GET /api/analytics/kpis returns accurate metrics matching raw database records', async () => {
    const res = await request(app)
      .get('/api/analytics/kpis?period=30d')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const kpis = res.body.data;
    expect(kpis.totalConversations.current).toBe(4);
    expect(kpis.leadsGenerated.current).toBe(2);
    // Conversion rate: 2 leads / 4 conversations = 50.0%
    expect(kpis.conversionRate.current).toBe(50);
    // Latencies: (1200 + 1800 + 800 + 2200) / 4 = 1500ms = 1.5s
    expect(kpis.avgResponseTimeSeconds.current).toBe(1.5);
    expect(kpis.activeChatbots).toBe(1);
    expect(kpis.totalConversations.deltaPercent).toBeDefined();
  });

  it('GET /api/analytics/kpis returns zero counts (not fake numbers) for empty account', async () => {
    const res = await request(app)
      .get('/api/analytics/kpis?period=30d')
      .set('Authorization', `Bearer ${emptyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const kpis = res.body.data;
    expect(kpis.totalConversations.current).toBe(0);
    expect(kpis.leadsGenerated.current).toBe(0);
    expect(kpis.conversionRate.current).toBe(0);
    expect(kpis.avgResponseTimeSeconds.current).toBe(0);
    expect(kpis.activeChatbots).toBe(0);
  });
});
