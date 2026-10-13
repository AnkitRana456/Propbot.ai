import { eq, and, sql, gte, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { agentActions, companyAiSettings, auditLogs, leads, contacts } from '../../db/schema/index.js';

export type ActionTier = 'T0' | 'T1' | 'T2' | 'T3';

export interface ExecuteAgentActionParams {
  companyId: string;
  agentName: string;
  actionType: string;
  tier: ActionTier;
  args: Record<string, unknown>;
  leadId?: string;
  executorFn?: () => Promise<Record<string, unknown>>;
}

export interface AgentActionResult {
  actionId?: string;
  status: 'executed' | 'proposed' | 'blocked' | 'rejected' | 'expired';
  tier: ActionTier;
  result?: Record<string, unknown>;
  message: string;
}

export class GuardedActionsService {
  /**
   * Central gatekeeper for all AI actions.
   * Enforces kill switch, tier validation, daily caps, per-lead rate limits,
   * approval holding for T2, strict T3 blocking, and audit logging.
   */
  async executeAgentAction(params: ExecuteAgentActionParams): Promise<AgentActionResult> {
    const { companyId, agentName, actionType, tier, args, leadId, executorFn } = params;

    // 1. Check Company AI Settings & Kill Switch
    const [settings] = await db
      .select()
      .from(companyAiSettings)
      .where(eq(companyAiSettings.companyId, companyId))
      .limit(1);

    if (settings?.killSwitch) {
      return {
        status: 'blocked',
        tier,
        message: 'AI action blocked: Emergency kill switch is currently active for this company.',
      };
    }

    // 2. Strict T3 Prohibition: never permitted under any circumstance
    if (tier === 'T3') {
      return {
        status: 'blocked',
        tier: 'T3',
        message: 'Action prohibited: T3 actions (refunds, contracts, deletions) can never be performed by AI.',
      };
    }

    // 3. Allowed Tiers Enforcement
    if (settings?.allowedTiers && settings.allowedTiers.length > 0 && !settings.allowedTiers.includes(tier)) {
      return {
        status: 'blocked',
        tier,
        message: `Action tier ${tier} is not permitted by company AI settings.`,
      };
    }

    // 4. Daily AI Action Cap Enforcement
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const [todayUsage] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentActions)
      .where(
        and(
          eq(agentActions.companyId, companyId),
          gte(agentActions.createdAt, todayMidnight),
        ),
      );

    const dailyCap = settings?.dailyActionCap ?? 100;
    if ((todayUsage?.count ?? 0) >= dailyCap) {
      return {
        status: 'blocked',
        tier,
        message: `Daily AI action cap exceeded for this company (cap: ${dailyCap}).`,
      };
    }

    // 5. Per-Lead Rate Limit (max 10 actions per lead per rolling 24h)
    if (leadId) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600 * 1000);
      const [leadUsage] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(agentActions)
        .where(
          and(
            eq(agentActions.companyId, companyId),
            eq(agentActions.leadId, leadId),
            gte(agentActions.createdAt, twentyFourHoursAgo),
          ),
        );

      if ((leadUsage?.count ?? 0) >= 10) {
        return {
          status: 'blocked',
          tier,
          message: 'Per-lead automated AI action rate limit reached (max 10 actions per 24 hours).',
        };
      }
    }

    // 6. T2 Sensitive Action: Requires Human Approval (held in queue)
    if (tier === 'T2') {
      const expiresAt = new Date(Date.now() + 48 * 3600 * 1000); // 48-hour expiration
      const [action] = await db
        .insert(agentActions)
        .values({
          companyId,
          leadId,
          agentName,
          actionType,
          tier: 'T2',
          status: 'proposed',
          args,
          expiresAt,
        })
        .returning();

      return {
        actionId: action?.id,
        status: 'proposed',
        tier: 'T2',
        message: 'Action held in approval queue. A human manager must approve before execution.',
      };
    }

    // 7. T0 Read-Only Action
    if (tier === 'T0') {
      let executionResult: Record<string, unknown> = {};
      if (executorFn) {
        executionResult = await executorFn();
      }
      return {
        status: 'executed',
        tier: 'T0',
        result: executionResult,
        message: 'T0 read-only action executed successfully.',
      };
    }

    // 8. T1 Reversible & Low-Risk Action: Auto-Execute and Record
    let execResult: Record<string, unknown> = {};
    if (executorFn) {
      execResult = await executorFn();
    }

    const [recorded] = await db
      .insert(agentActions)
      .values({
        companyId,
        leadId,
        agentName,
        actionType,
        tier: 'T1',
        status: 'executed',
        args,
        result: execResult,
      })
      .returning();

    // Audit log entry for T1 automated execution
    await db.insert(auditLogs).values({
      companyId,
      action: 'ai_action_auto_executed',
      resourceType: 'agent_actions',
      resourceId: recorded?.id,
      details: {
        agentName,
        actionType,
        tier: 'T1',
        leadId,
      },
    });

    return {
      actionId: recorded?.id,
      status: 'executed',
      tier: 'T1',
      result: execResult,
      message: 'T1 action auto-executed and logged.',
    };
  }

  /**
   * Approves a proposed T2 action by an authorized human manager/admin.
   */
  async approveAction(
    companyId: string,
    actionId: string,
    approvedByUserId: string,
    executeCallback?: (args: Record<string, unknown>) => Promise<Record<string, unknown>>,
    editedArgs?: Record<string, unknown>,
  ): Promise<AgentActionResult> {
    const [action] = await db
      .select()
      .from(agentActions)
      .where(and(eq(agentActions.id, actionId), eq(agentActions.companyId, companyId)))
      .limit(1);

    if (!action) {
      throw new Error('Action not found or unauthorized.');
    }

    if (action.status !== 'proposed') {
      throw new Error(`Cannot approve action with current status: ${action.status}`);
    }

    // Check expiration
    if (action.expiresAt && action.expiresAt < new Date()) {
      await db
        .update(agentActions)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(agentActions.id, actionId));
      throw new Error('Cannot approve action: The proposed action has expired.');
    }

    const finalArgs = editedArgs ? { ...((action.args as Record<string, unknown>) || {}), ...editedArgs } : (action.args as Record<string, unknown>) || {};

    let resultPayload: Record<string, unknown> = {};
    if (executeCallback) {
      resultPayload = await executeCallback(finalArgs);
    }

    await db
      .update(agentActions)
      .set({
        status: 'approved',
        approvedBy: approvedByUserId,
        args: finalArgs,
        result: resultPayload,
        updatedAt: new Date(),
      })
      .where(and(eq(agentActions.id, actionId), eq(agentActions.companyId, companyId)));

    // Record in audit log
    await db.insert(auditLogs).values({
      companyId,
      userId: approvedByUserId,
      action: 'ai_action_approved',
      resourceType: 'agent_actions',
      resourceId: actionId,
      details: {
        agentName: action.agentName,
        actionType: action.actionType,
        tier: action.tier,
        leadId: action.leadId,
        editedByApprover: !!editedArgs,
      },
    });

    return {
      actionId: action.id,
      status: 'executed',
      tier: action.tier as ActionTier,
      result: resultPayload,
      message: 'Action successfully approved and executed.',
    };
  }

  /**
   * Rejects a proposed action by a human manager.
   */
  async rejectAction(
    companyId: string,
    actionId: string,
    rejectedByUserId: string,
    reason?: string,
  ): Promise<void> {
    const [action] = await db
      .select()
      .from(agentActions)
      .where(and(eq(agentActions.id, actionId), eq(agentActions.companyId, companyId)))
      .limit(1);

    if (!action) {
      throw new Error('Action not found or unauthorized.');
    }

    if (action.status !== 'proposed') {
      throw new Error(`Cannot reject action with current status: ${action.status}`);
    }

    await db
      .update(agentActions)
      .set({
        status: 'rejected',
        approvedBy: rejectedByUserId,
        result: reason ? { rejectionReason: reason } : { rejectionReason: 'Rejected by manager' },
        updatedAt: new Date(),
      })
      .where(and(eq(agentActions.id, actionId), eq(agentActions.companyId, companyId)));

    await db.insert(auditLogs).values({
      companyId,
      userId: rejectedByUserId,
      action: 'ai_action_rejected',
      resourceType: 'agent_actions',
      resourceId: actionId,
      details: {
        reason: reason || 'Rejected by manager',
        leadId: action.leadId,
        actionType: action.actionType,
      },
    });
  }

  /**
   * Returns paginated pending approval actions with joined lead and contact context.
   */
  async listPendingApprovals(
    companyId: string,
    options: { page?: number; limit?: number; status?: string } = {},
  ) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const offset = (page - 1) * limit;
    const targetStatus = options.status || 'proposed';

    const items = await db
      .select({
        id: agentActions.id,
        companyId: agentActions.companyId,
        leadId: agentActions.leadId,
        agentName: agentActions.agentName,
        actionType: agentActions.actionType,
        tier: agentActions.tier,
        status: agentActions.status,
        args: agentActions.args,
        result: agentActions.result,
        approvedBy: agentActions.approvedBy,
        expiresAt: agentActions.expiresAt,
        createdAt: agentActions.createdAt,
        updatedAt: agentActions.updatedAt,
        leadName: sql<string>`concat(${contacts.firstName}, ' ', coalesce(${contacts.lastName}, ''))`,
        leadPhone: contacts.phone,
        leadEmail: contacts.email,
        leadIntentScore: leads.intentScore,
        leadIntentLabel: leads.intentLabel,
        leadBuyerDna: leads.buyerDna,
      })
      .from(agentActions)
      .leftJoin(leads, eq(agentActions.leadId, leads.id))
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .where(and(eq(agentActions.companyId, companyId), eq(agentActions.status, targetStatus)))
      .orderBy(desc(agentActions.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(agentActions)
      .where(and(eq(agentActions.companyId, companyId), eq(agentActions.status, targetStatus)));

    const total = countResult?.total ?? 0;

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Count of currently pending approval items (for realtime badge in sidebar).
   */
  async getPendingCount(companyId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentActions)
      .where(and(eq(agentActions.companyId, companyId), eq(agentActions.status, 'proposed')));

    return result?.count ?? 0;
  }

  /**
   * Returns audit history of all agent actions.
   */
  async getActionHistory(
    companyId: string,
    options: { page?: number; limit?: number; tier?: string } = {},
  ) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [eq(agentActions.companyId, companyId)];
    if (options.tier) {
      conditions.push(eq(agentActions.tier, options.tier));
    }

    const items = await db
      .select({
        id: agentActions.id,
        agentName: agentActions.agentName,
        actionType: agentActions.actionType,
        tier: agentActions.tier,
        status: agentActions.status,
        args: agentActions.args,
        result: agentActions.result,
        approvedBy: agentActions.approvedBy,
        createdAt: agentActions.createdAt,
        leadName: sql<string>`concat(${contacts.firstName}, ' ', coalesce(${contacts.lastName}, ''))`,
      })
      .from(agentActions)
      .leftJoin(leads, eq(agentActions.leadId, leads.id))
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .where(and(...conditions))
      .orderBy(desc(agentActions.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(agentActions)
      .where(and(...conditions));

    const total = countResult?.total ?? 0;

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const guardedActionsService = new GuardedActionsService();
