import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users, companyAiSettings, agentActions, leads, contacts } from '../../src/db/schema/index.js';
import { guardedActionsService } from '../../src/modules/ai/guarded-actions.service.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { eq } from 'drizzle-orm';

describe('Phase 15A: Full Guarded Actions, Safety Tiers, Daily Caps & Approvals', () => {
  const app = createApp();
  const companyId = '99999999-9999-9999-9999-999999999930';
  const managerUserId = '00000000-0000-0000-0000-000000000088';
  const agentUserId = '00000000-0000-0000-0000-000000000089';
  const leadId = '11111111-1111-1111-1111-111111111130';
  const contactId = '22222222-2222-2222-2222-222222222230';

  let managerToken: string;
  let agentToken: string;

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    // Provision company
    await testDb.insert(companies).values({
      id: companyId,
      name: 'Safety 15A Realty',
      slug: 'safety-15a-realty',
      plan: 'growth',
      status: 'active',
    });

    // Provision manager user
    await testDb.insert(users).values({
      id: managerUserId,
      companyId,
      name: 'Sales Manager 15A',
      email: 'manager15a@test.com',
      passwordHash: 'hashed',
      role: 'sales_manager',
      status: 'active',
    });

    // Provision agent user (no approve_ai_actions permission)
    await testDb.insert(users).values({
      id: agentUserId,
      companyId,
      name: 'Sales Agent 15A',
      email: 'agent15a@test.com',
      passwordHash: 'hashed',
      role: 'agent',
      status: 'active',
    });

    // Provision AI settings (daily cap = 3 for testing)
    await testDb.insert(companyAiSettings).values({
      companyId,
      killSwitch: false,
      allowedTiers: ['T0', 'T1', 'T2'],
      dailyActionCap: 3,
    });

    // Provision test contact & lead
    await testDb.insert(contacts).values({
      id: contactId,
      companyId,
      firstName: 'Vikram',
      lastName: 'Malhotra',
      phone: '+919876543299',
      email: 'vikram.m@test.com',
    });

    await testDb.insert(leads).values({
      id: leadId,
      companyId,
      contactId,
      status: 'qualified',
      intentScore: 82,
      intentLabel: 'hot',
      source: 'web_chat',
    });

    managerToken = signAccessToken({
      sub: managerUserId,
      companyId,
      email: 'manager15a@test.com',
      name: 'Sales Manager 15A',
      role: 'sales_manager',
      status: 'active',
    });

    agentToken = signAccessToken({
      sub: agentUserId,
      companyId,
      email: 'agent15a@test.com',
      name: 'Sales Agent 15A',
      role: 'agent',
      status: 'active',
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('1. T0 read-only action executes automatically without mutation', async () => {
    let executorCalled = false;
    const result = await guardedActionsService.executeAgentAction({
      companyId,
      agentName: 'copilot',
      actionType: 'search_properties',
      tier: 'T0',
      args: { locality: 'Whitefield', bhk: [3] },
      executorFn: async () => {
        executorCalled = true;
        return { count: 5, results: ['Tower A 302'] };
      },
    });

    expect(result.status).toBe('executed');
    expect(result.tier).toBe('T0');
    expect(executorCalled).toBe(true);
    expect(result.result).toEqual({ count: 5, results: ['Tower A 302'] });
  });

  it('2. T3 action (refund / contract / deletion) is strictly blocked', async () => {
    const result = await guardedActionsService.executeAgentAction({
      companyId,
      agentName: 'copilot',
      actionType: 'issue_refund',
      tier: 'T3',
      args: { leadId, amount: 50000 },
    });

    expect(result.status).toBe('blocked');
    expect(result.tier).toBe('T3');
    expect(result.message).toContain('T3 actions');
  });

  it('3. T2 action is held in approval queue with proposed status and expiration', async () => {
    const result = await guardedActionsService.executeAgentAction({
      companyId,
      leadId,
      agentName: 'copilot',
      actionType: 'send_price_quote',
      tier: 'T2',
      args: { lead_id: leadId, offered_price: 24000000, terms: 'Special developer discount' },
    });

    expect(result.status).toBe('proposed');
    expect(result.tier).toBe('T2');
    expect(result.actionId).toBeDefined();

    // Verify stored in DB with 48h expiration
    const [action] = await testDb
      .select()
      .from(agentActions)
      .where(eq(agentActions.id, result.actionId!));

    expect(action).toBeDefined();
    expect(action.status).toBe('proposed');
    expect(action.expiresAt).toBeDefined();
    expect(new Date(action.expiresAt!).getTime()).toBeGreaterThan(Date.now() + 47 * 3600 * 1000);
  });

  it('4. Agent without approve_ai_actions permission cannot approve T2 action (403)', async () => {
    const queue = await guardedActionsService.listPendingApprovals(companyId);
    const actionId = queue.items[0]?.id;
    expect(actionId).toBeDefined();

    const res = await request(app)
      .post(`/api/approvals/${actionId}/approve`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('5. Manager can approve T2 action and optionally modify parameters', async () => {
    const queue = await guardedActionsService.listPendingApprovals(companyId);
    const actionId = queue.items[0]?.id;

    const res = await request(app)
      .post(`/api/approvals/${actionId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        editedArgs: { offered_price: 23500000, terms: 'Manager signed-off ₹2.35 Cr' },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify status updated in DB
    const [action] = await testDb
      .select()
      .from(agentActions)
      .where(eq(agentActions.id, actionId!));

    expect(action.status).toBe('approved');
    expect(action.approvedBy).toBe(managerUserId);
    expect((action.args as Record<string, unknown>).offered_price).toBe(23500000);
  });

  it('6. Cannot re-approve an already approved action (duplicate prevention)', async () => {
    const queue = await testDb
      .select()
      .from(agentActions)
      .where(eq(agentActions.companyId, companyId));

    const approvedAction = queue.find(a => a.status === 'approved');
    expect(approvedAction).toBeDefined();

    const res = await request(app)
      .post(`/api/approvals/${approvedAction!.id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('7. Manager can reject proposed T2 action with required feedback reason', async () => {
    // Propose a second T2 action
    const propRes = await guardedActionsService.executeAgentAction({
      companyId,
      leadId,
      agentName: 'copilot',
      actionType: 'mark_booked',
      tier: 'T2',
      args: { lead_id: leadId, unit_id: 'unit_99', booking_amount: 500000 },
    });

    const res = await request(app)
      .post(`/api/approvals/${propRes.actionId!}/reject`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Unit is on temporary legal hold.' });

    expect(res.status).toBe(200);

    const [rejected] = await testDb
      .select()
      .from(agentActions)
      .where(eq(agentActions.id, propRes.actionId!));

    expect(rejected.status).toBe('rejected');
    expect((rejected.result as Record<string, unknown>).rejectionReason).toBe('Unit is on temporary legal hold.');
  });

  it('8. Daily AI Action Cap stops further automated actions once cap is exceeded', async () => {
    // Set daily action cap to 2 (already reached by the previous 2 actions)
    await testDb
      .update(companyAiSettings)
      .set({ dailyActionCap: 2 })
      .where(eq(companyAiSettings.companyId, companyId));

    const result = await guardedActionsService.executeAgentAction({
      companyId,
      agentName: 'copilot',
      actionType: 'add_tag',
      tier: 'T1',
      args: { lead_id: leadId, tag: 'VIP' },
    });

    expect(result.status).toBe('blocked');
    expect(result.message).toContain('Daily AI action cap exceeded');
  });

  it('9. Emergency Kill Switch halts T0, T1, and T2 actions immediately', async () => {
    // Activate kill switch
    await testDb
      .update(companyAiSettings)
      .set({ killSwitch: true })
      .where(eq(companyAiSettings.companyId, companyId));

    const t0Res = await guardedActionsService.executeAgentAction({
      companyId,
      agentName: 'copilot',
      actionType: 'search_properties',
      tier: 'T0',
      args: {},
    });
    expect(t0Res.status).toBe('blocked');
    expect(t0Res.message).toContain('Emergency kill switch is currently active');

    const t2Res = await guardedActionsService.executeAgentAction({
      companyId,
      agentName: 'copilot',
      actionType: 'send_price_quote',
      tier: 'T2',
      args: {},
    });
    expect(t2Res.status).toBe('blocked');
    expect(t2Res.message).toContain('Emergency kill switch is currently active');
  });
});
