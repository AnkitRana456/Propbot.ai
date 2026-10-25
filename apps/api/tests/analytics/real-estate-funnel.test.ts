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

describe('Real Estate Funnel & Insights API', () => {
  const app = createApp();
  const companyId = '99999999-9999-9999-9999-999999999922';
  const userId = '00000000-0000-0000-0000-000000000203';
  const botId = '88888888-8888-8888-8888-888888888802';

  const token = signAccessToken({
    sub: userId,
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@funneltest.com',
    name: 'Funnel Admin',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({ id: companyId, name: 'Prestige Funnels', slug: 'prestige-funnels', plan: 'growth', status: 'active' })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({ id: userId, companyId, name: 'Admin', email: 'admin@funneltest.com', role: 'company_admin', status: 'active', passwordHash: 'dummy' })
      .onConflictDoNothing();

    await testDb
      .insert(chatbots)
      .values({ id: botId, companyId, name: 'Lead Funnel Bot', status: 'active', publicKey: 'pub_funnel_bot_01' })
      .onConflictDoNothing();

    // Seed conversations
    for (let i = 1; i <= 5; i++) {
      await testDb.insert(conversations).values({
        companyId,
        chatbotId: botId,
        channel: 'web',
        status: 'bot',
      });
    }

    // Seed contacts & leads across various stages
    const contact1 = '66666666-6666-6666-6666-666666666011';
    const contact2 = '66666666-6666-6666-6666-666666666012';
    const contact3 = '66666666-6666-6666-6666-666666666013';

    await testDb.insert(contacts).values([
      { id: contact1, companyId, firstName: 'Aarav', lastName: 'Patel', phone: '+919876500021' },
      { id: contact2, companyId, firstName: 'Kavita', lastName: 'Reddy', phone: '+919876500022' },
      { id: contact3, companyId, firstName: 'Vikram', lastName: 'Mehta', phone: '+919876500023' },
    ]);

    await testDb.insert(leads).values([
      {
        companyId,
        contactId: contact1,
        chatbotId: botId,
        status: 'qualified',
        buyerDna: { bhk: ['3 BHK'], localities: ['Whitefield'], budgetMin: 15000000, objections: ['Price high'] },
        source: 'chat',
      },
      {
        companyId,
        contactId: contact2,
        chatbotId: botId,
        status: 'site_visit_scheduled',
        buyerDna: { bhk: ['2 BHK'], localities: ['Sarjapur Road'], budgetMin: 9000000 },
        source: 'whatsapp',
      },
      {
        companyId,
        contactId: contact3,
        chatbotId: botId,
        status: 'booked',
        buyerDna: { bhk: ['3 BHK'], localities: ['Whitefield'], budgetMin: 22000000 },
        source: 'chat',
      },
    ]);
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('GET /api/analytics/real-estate-funnel returns 5 stages that start at captured leads, with no invented visitor count', async () => {
    const res = await request(app)
      .get('/api/analytics/real-estate-funnel?period=30d')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const stages = res.body.data.stages;
    expect(stages.length).toBe(5);
    expect(stages[0].stage).toBe('lead');
    expect(stages[0].conversionFromTopPercent).toBe(100);

    const stageMap = new Map(stages.map((s: { stage: string; count: number }) => [s.stage, s.count]));
    expect(stageMap.has('visitor')).toBe(false);
    expect(stageMap.has('chat')).toBe(false);
    expect(stageMap.get('lead')).toBe(3);
    // All 3 leads are qualified or higher
    expect(stageMap.get('qualified')).toBe(3);
    // 2 leads have visit booked or higher (site_visit_scheduled and booked)
    expect(stageMap.get('visit_booked')).toBe(2);
    // 1 lead is booked
    expect(stageMap.get('booked')).toBe(1);
  });

  it('GET /api/analytics/cta-funnel only returns stages it can count and never exceeds 100%', async () => {
    const res = await request(app)
      .get('/api/analytics/cta-funnel?period=30d')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const stages = res.body.data.stages;
    expect(stages.map((s: { stage: string }) => s.stage)).toEqual(['started', 'completed', 'failed']);
    const [started, completed, failed] = stages as Array<{ count: number; conversionFromTopPercent: number }>;
    expect(completed!.count).toBeLessThanOrEqual(started!.count);
    expect(completed!.count + failed!.count).toBe(started!.count);
    for (const s of stages) expect(s.conversionFromTopPercent).toBeLessThanOrEqual(100);
  });

  it('GET /api/analytics/real-estate-insights aggregates demand by BHK, locality, and budget', async () => {
    const res = await request(app)
      .get('/api/analytics/real-estate-insights?period=30d')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const insights = res.body.data;
    expect(insights.demandByBhk.length).toBeGreaterThan(0);
    expect(insights.demandByLocality.length).toBeGreaterThan(0);
    expect(insights.demandByBudget.length).toBeGreaterThan(0);
    expect(insights.mostAskedObjections).toBeDefined();
    expect(insights.speedToLeadMinutes).toBeDefined();
  });
});
