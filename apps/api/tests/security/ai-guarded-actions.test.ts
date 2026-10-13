import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users, companyAiSettings, agentActions, auditLogs } from '../../src/db/schema/index.js';
import { guardedActionsService } from '../../src/modules/ai/guarded-actions.service.js';
import { eq, and } from 'drizzle-orm';

describe('Security: AI Guarded Action Layer & Kill Switch (Phase 14.1)', () => {
  const companyId = '99999999-9999-9999-9999-999999999920';
  const adminUserId = '00000000-0000-0000-0000-000000000020';

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    // Provision test company
    await testDb.insert(companies).values({
      id: companyId,
      name: 'Security Test Realty',
      slug: 'security-test-realty',
      plan: 'growth',
      status: 'active',
    });

    // Provision admin user
    await testDb.insert(users).values({
      id: adminUserId,
      companyId,
      name: 'Security Admin',
      email: 'secadmin@test.com',
      passwordHash: 'hashed',
      role: 'company_admin',
      status: 'active',
    });

    // Provision AI settings with killSwitch = false initially
    await testDb.insert(companyAiSettings).values({
      companyId,
      killSwitch: false,
      allowedTiers: ['T0', 'T1', 'T2'],
      dailyActionCap: 100,
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('1. AI action layer cannot be bypassed: kill switch blocks execution instantly', async () => {
    // Activate kill switch
    await testDb
      .update(companyAiSettings)
      .set({ killSwitch: true })
      .where(eq(companyAiSettings.companyId, companyId));

    // Attempt to execute an action
    let executed = false;
    const result = await guardedActionsService.executeAgentAction({
      companyId,
      agentName: 'concierge',
      actionType: 'send_property_recommendation',
      tier: 'T1',
      args: { projectId: 'project-1' },
      executorFn: async () => {
        executed = true;
        return { success: true };
      },
    });

    expect(result.status).toBe('blocked');
    expect(result.message).toContain('kill switch is currently active');
    expect(executed).toBe(false);

    // Deactivate kill switch for remaining tests
    await testDb
      .update(companyAiSettings)
      .set({ killSwitch: false })
      .where(eq(companyAiSettings.companyId, companyId));
  });

  it('2. Approval-tier (T2) actions never execute automatically without an approver', async () => {
    let sideEffectRan = false;

    const result = await guardedActionsService.executeAgentAction({
      companyId,
      agentName: 'whatsapp_concierge',
      actionType: 'offer_price_discount',
      tier: 'T2',
      args: {
        toPhone: '+919876543210',
        discountPercent: 5,
        unitId: 'unit-402',
      },
      executorFn: async () => {
        sideEffectRan = true;
        return { sent: true };
      },
    });

    expect(result.status).toBe('proposed');
    expect(result.tier).toBe('T2');
    expect(result.actionId).toBeDefined();
    expect(sideEffectRan).toBe(false);

    // Verify DB status is strictly 'proposed'
    const [dbAction] = await testDb
      .select()
      .from(agentActions)
      .where(and(eq(agentActions.id, result.actionId!), eq(agentActions.companyId, companyId)));

    expect(dbAction).toBeDefined();
    expect(dbAction?.status).toBe('proposed');
    expect(dbAction?.approvedBy).toBeNull();
  });

  it('3. Human approver can approve and execute a held T2 action', async () => {
    // Create a proposed T2 action
    const proposal = await guardedActionsService.executeAgentAction({
      companyId,
      agentName: 'whatsapp_concierge',
      actionType: 'confirm_special_payment_plan',
      tier: 'T2',
      args: { paymentPlan: '20:80' },
    });

    expect(proposal.status).toBe('proposed');
    const actionId = proposal.actionId!;

    let executedByApprover = false;
    const approvalResult = await guardedActionsService.approveAction(
      companyId,
      actionId,
      adminUserId,
      async args => {
        executedByApprover = true;
        return { paymentPlanApplied: args.paymentPlan };
      },
    );

    expect(approvalResult.status).toBe('executed');
    expect(executedByApprover).toBe(true);

    // Verify DB update
    const [updatedAction] = await testDb
      .select()
      .from(agentActions)
      .where(eq(agentActions.id, actionId));

    expect(updatedAction?.status).toBe('approved');
    expect(updatedAction?.approvedBy).toBe(adminUserId);

    // Verify AuditLog record
    const [audit] = await testDb
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.companyId, companyId), eq(auditLogs.resourceId, actionId)));

    expect(audit).toBeDefined();
    expect(audit?.action).toBe('ai_action_approved');
    expect(audit?.userId).toBe(adminUserId);
  });

  it('4. T3 actions (refunds, contracts, deletions) are strictly rejected', async () => {
    let sideEffectRan = false;

    const result = await guardedActionsService.executeAgentAction({
      companyId,
      agentName: 'concierge',
      actionType: 'issue_booking_refund',
      tier: 'T3',
      args: { amount: 50000 },
      executorFn: async () => {
        sideEffectRan = true;
        return { refunded: true };
      },
    });

    expect(result.status).toBe('blocked');
    expect(result.message).toContain('T3 actions');
    expect(sideEffectRan).toBe(false);
  });
});
