import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { leads, users, leadActivities, domainEvents } from '../../db/schema/index.js';
import { leadsService } from '../leads/leads.service.js';
import type { LeadItemResponse } from '@propbot/shared';

export class AssignmentService {
  /**
   * Assigns a single lead to a verified tenant agent.
   */
  async assignLead(
    companyId: string,
    leadId: string,
    agentId: string,
    reason?: string,
    assignedBy?: string,
  ): Promise<LeadItemResponse> {
    // 1. Verify agent belongs to this company and is active
    const agent = await db.query.users.findFirst({
      where: and(eq(users.id, agentId), eq(users.companyId, companyId), eq(users.status, 'active')),
    });

    if (!agent) {
      const err = new Error('Assigned user not found or is not an active team member of this company');
      Object.assign(err, { statusCode: 400 });
      throw err;
    }

    const lead = await leadsService.getLeadById(companyId, leadId);

    await db.transaction(async tx => {
      await tx
        .update(leads)
        .set({
          assignedAgentId: agentId,
          updatedAt: new Date(),
        })
        .where(and(eq(leads.id, leadId), eq(leads.companyId, companyId)));

      await tx.insert(leadActivities).values({
        companyId,
        leadId,
        contactId: lead.contactId,
        activityType: 'lead_assigned',
        title: `Assigned to Agent: ${agent.name}`,
        description: reason || `Lead assigned to ${agent.name} (${agent.email})`,
        metadata: {
          agentId,
          agentName: agent.name,
          assignedBy,
          reason,
        },
      });

      await tx.insert(domainEvents).values({
        companyId,
        type: 'lead_updated',
        payload: {
          lead_id: leadId,
          changes: {
            assignedAgentId: agentId,
            assignedAgentName: agent.name,
          },
        },
      });
    });

    return leadsService.getLeadById(companyId, leadId);
  }

  /**
   * Round-robin assignment across available sales agents.
   * Selects active agent with the lowest number of assigned leads.
   */
  async roundRobinAssign(companyId: string, leadId: string): Promise<LeadItemResponse> {
    // Find eligible agents (agents and sales managers)
    const eligibleAgents = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        assignedCount: sql<number>`count(${leads.id})::int`,
      })
      .from(users)
      .leftJoin(leads, and(eq(leads.assignedAgentId, users.id), eq(leads.companyId, companyId)))
      .where(
        and(
          eq(users.companyId, companyId),
          eq(users.status, 'active'),
          inArray(users.role, ['agent', 'sales_manager', 'company_admin']),
        ),
      )
      .groupBy(users.id, users.name, users.role)
      .orderBy(sql`count(${leads.id}) ASC`);

    if (!eligibleAgents.length) {
      throw new Error('No eligible active sales agents found for round-robin assignment');
    }

    const selectedAgent = eligibleAgents[0];
    if (!selectedAgent) {
      throw new Error('Could not select agent');
    }

    return this.assignLead(
      companyId,
      leadId,
      selectedAgent.id,
      'Automated round-robin distribution',
    );
  }

  /**
   * Bulk reassigns an array of leads to a chosen agent.
   */
  async bulkAssign(
    companyId: string,
    leadIds: string[],
    agentId: string,
    assignedBy?: string,
  ): Promise<{ updatedCount: number }> {
    const agent = await db.query.users.findFirst({
      where: and(eq(users.id, agentId), eq(users.companyId, companyId), eq(users.status, 'active')),
    });

    if (!agent) {
      const err = new Error('Assigned user not found or not active in this company');
      Object.assign(err, { statusCode: 400 });
      throw err;
    }

    if (!leadIds.length) return { updatedCount: 0 };

    await db.transaction(async tx => {
      await tx
        .update(leads)
        .set({
          assignedAgentId: agentId,
          updatedAt: new Date(),
        })
        .where(and(eq(leads.companyId, companyId), inArray(leads.id, leadIds)));

      for (const leadId of leadIds) {
        await tx.insert(domainEvents).values({
          companyId,
          type: 'lead_updated',
          payload: {
            lead_id: leadId,
            changes: { assignedAgentId: agentId, assignedAgentName: agent.name },
            bulk: true,
            assignedBy,
          },
        });
      }
    });

    return { updatedCount: leadIds.length };
  }

  /**
   * Checks for breached speed-to-lead SLAs and automatically reassigns.
   * If lead was flagged hot and not contacted within 15 minutes, marks breached and reassigns.
   */
  async checkAndReassignSlaBreaches(companyId: string): Promise<{ breachedCount: number }> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const breachedLeads = await db.query.leads.findMany({
      where: and(
        eq(leads.companyId, companyId),
        eq(leads.status, 'new'),
        sql`${leads.slaStartedAt} IS NOT NULL AND ${leads.slaStartedAt} <= ${fifteenMinutesAgo}`,
        sql`${leads.slaBreachedAt} IS NULL`,
      ),
    });

    if (!breachedLeads.length) return { breachedCount: 0 };

    // Get manager or top available agent
    const managers = await db.query.users.findMany({
      where: and(
        eq(users.companyId, companyId),
        eq(users.status, 'active'),
        inArray(users.role, ['sales_manager', 'company_admin']),
      ),
    });

    const backupAgentId = managers[0]?.id;

    for (const lead of breachedLeads) {
      await db
        .update(leads)
        .set({
          slaBreachedAt: new Date(),
          assignedAgentId: backupAgentId ?? lead.assignedAgentId,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id));

      await db.insert(leadActivities).values({
        companyId,
        leadId: lead.id,
        contactId: lead.contactId,
        activityType: 'sla_breached',
        title: 'Speed-to-Lead SLA Breached (15 min)',
        description: backupAgentId
          ? `SLA response exceeded. Auto-escalated to manager (${managers[0]?.name}).`
          : 'SLA response exceeded. Immediate contact required.',
        metadata: { slaStartedAt: lead.slaStartedAt, escalatedTo: backupAgentId },
      });
    }

    return { breachedCount: breachedLeads.length };
  }
}

export const assignmentService = new AssignmentService();
