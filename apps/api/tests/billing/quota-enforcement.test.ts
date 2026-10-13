import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users, chatbots, subscriptions } from '../../src/db/schema/index.js';
import { SUBSCRIPTION_PLANS, type PlanLimits } from '@propbot/shared';

describe('Plan Quota & Limit Enforcement Middleware', () => {
  const app = createApp();
  const companyId = '99999999-9999-9999-9999-999999999933';
  const adminId = '00000000-0000-0000-0000-000000000331';
  const existingBotId = '88888888-8888-8888-8888-888888888833';

  const adminToken = signAccessToken({
    sub: adminId,
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@quotatest.com',
    name: 'Quota Admin',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    // Trial plan with 1 chatbot and 2 users limit
    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Trial Quota Realty',
        slug: 'trial-quota-realty',
        plan: 'trial',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values([
        {
          id: adminId,
          companyId,
          name: 'Admin',
          email: 'admin@quotatest.com',
          role: 'company_admin',
          status: 'active',
          passwordHash: 'dummy',
        },
        {
          id: '00000000-0000-0000-0000-000000000332',
          companyId,
          name: 'User 2',
          email: 'user2@quotatest.com',
          role: 'agent',
          status: 'active',
          passwordHash: 'dummy',
        },
      ])
      .onConflictDoNothing();

    await testDb
      .insert(subscriptions)
      .values({
        companyId,
        plan: 'trial',
        status: 'active',
        limits: SUBSCRIPTION_PLANS.trial!.limits as unknown as PlanLimits,
      })
      .onConflictDoNothing();

    // Already 1 chatbot created (at limit!)
    await testDb
      .insert(chatbots)
      .values({
        id: existingBotId,
        companyId,
        name: 'First Bot',
        publicKey: 'pub_test_quota_001',
        status: 'published',
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('blocks creating a second chatbot when plan limit is reached with 403 PLAN_LIMIT_EXCEEDED', async () => {
    const res = await request(app)
      .post('/api/chatbots')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Second Chatbot Over Quota',
        type: 'web',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.error.message).toContain('reached your plan limit for active chatbots');
    expect(res.body.error.details.upgradeUrl).toBe('/subscription');
  });

  it('blocks inviting an additional user when team quota is reached with 403 PLAN_LIMIT_EXCEEDED', async () => {
    const res = await request(app)
      .post('/api/users/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'user3_overquota@quotatest.com',
        role: 'agent',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.error.message).toContain('reached your plan limit for team members');
  });
});
