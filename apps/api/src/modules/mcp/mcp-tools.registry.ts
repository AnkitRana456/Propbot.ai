import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  leads,
  contacts,
  units,
  appointments,
  notes,
  leadActivities,
  voiceCalls,
  users,
} from '../../db/schema/index.js';
import { guardedActionsService } from '../ai/guarded-actions.service.js';
import { auditService } from '../audit/audit.service.js';
import { mcpLogger } from './mcp-auth.middleware.js';

export interface McpToolDefinition {
  name: string;
  description: string;
  scope: 'mcp:read' | 'mcp:write';
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (
    companyId: string,
    args: Record<string, unknown>,
    actor: { id: string; name: string },
  ) => Promise<unknown>;
}

export class McpToolsRegistry {
  private tools: Map<string, McpToolDefinition> = new Map();

  constructor() {
    this.registerReadTools();
    this.registerGuardedWriteTools();
  }

  getTool(name: string): McpToolDefinition | undefined {
    return this.tools.get(name);
  }

  listTools(): McpToolDefinition[] {
    return Array.from(this.tools.values());
  }

  private registerReadTools(): void {
    // 1. get_leads
    this.tools.set('get_leads', {
      name: 'get_leads',
      description: 'Fetch CRM leads for the tenant filtered by status, minimum intent score, or limit.',
      scope: 'mcp:read',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by lead status (e.g. new, qualified, contacted)' },
          minIntentScore: { type: 'number', description: 'Minimum intent score filter (0-100)' },
          limit: { type: 'number', description: 'Maximum number of leads to return (default 20, max 100)' },
        },
      },
      handler: async (companyId, args) => {
        const conditions = [eq(leads.companyId, companyId)];
        if (typeof args.status === 'string') {
          conditions.push(eq(leads.status, args.status));
        }
        if (typeof args.minIntentScore === 'number') {
          conditions.push(gte(leads.intentScore, args.minIntentScore));
        }

        const limit = Math.min(100, Math.max(1, Number(args.limit) || 20));

        const results = await db
          .select({
            id: leads.id,
            status: leads.status,
            intentScore: leads.intentScore,
            intentLabel: leads.intentLabel,
            buyerDna: leads.buyerDna,
            contact: {
              id: contacts.id,
              firstName: contacts.firstName,
              lastName: contacts.lastName,
              phone: contacts.phone,
              email: contacts.email,
            },
            createdAt: leads.createdAt,
          })
          .from(leads)
          .leftJoin(contacts, eq(leads.contactId, contacts.id))
          .where(and(...conditions))
          .orderBy(desc(leads.createdAt))
          .limit(limit);

        return { leads: results, count: results.length };
      },
    });

    // 2. get_lead_detail
    this.tools.set('get_lead_detail', {
      name: 'get_lead_detail',
      description: 'Fetch complete context for a specific lead including Buyer DNA, contact info, notes, and activity timeline.',
      scope: 'mcp:read',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: { type: 'string', description: 'UUID of the lead' },
        },
        required: ['leadId'],
      },
      handler: async (companyId, args) => {
        const leadId = String(args.leadId);

        const [lead] = await db
          .select()
          .from(leads)
          .where(and(eq(leads.id, leadId), eq(leads.companyId, companyId)))
          .limit(1);

        if (!lead) {
          throw new Error(`Lead not found or access denied: ${leadId}`);
        }

        let contact = null;
        if (lead.contactId) {
          const [c] = await db
            .select()
            .from(contacts)
            .where(and(eq(contacts.id, lead.contactId), eq(contacts.companyId, companyId)))
            .limit(1);
          contact = c ?? null;
        }

        const leadNotes = await db
          .select()
          .from(notes)
          .where(and(eq(notes.leadId, leadId), eq(notes.companyId, companyId)))
          .orderBy(desc(notes.createdAt))
          .limit(10);

        const recentActivities = await db
          .select()
          .from(leadActivities)
          .where(and(eq(leadActivities.leadId, leadId), eq(leadActivities.companyId, companyId)))
          .orderBy(desc(leadActivities.createdAt))
          .limit(10);

        const recentCalls = await db
          .select()
          .from(voiceCalls)
          .where(and(eq(voiceCalls.leadId, leadId), eq(voiceCalls.companyId, companyId)))
          .orderBy(desc(voiceCalls.createdAt))
          .limit(5);

        return {
          lead,
          contact,
          notes: leadNotes,
          activities: recentActivities,
          calls: recentCalls,
        };
      },
    });

    // 3. get_pipeline_stats
    this.tools.set('get_pipeline_stats', {
      name: 'get_pipeline_stats',
      description: 'Fetch funnel and pipeline metrics for the authenticated company.',
      scope: 'mcp:read',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async (companyId) => {
        const counts = await db
          .select({
            status: leads.status,
            count: sql<number>`count(*)::int`,
            avgScore: sql<number>`round(avg(coalesce(${leads.intentScore}, 0)))::int`,
          })
          .from(leads)
          .where(eq(leads.companyId, companyId))
          .groupBy(leads.status);

        const totalLeads = counts.reduce((acc, c) => acc + c.count, 0);
        const statusMap: Record<string, number> = {};
        counts.forEach((c) => {
          statusMap[c.status] = c.count;
        });

        return {
          totalLeads,
          breakdown: statusMap,
          metrics: counts,
        };
      },
    });

    // 4. get_inventory
    this.tools.set('get_inventory', {
      name: 'get_inventory',
      description: 'Fetch available property units with optional project, BHK, and price filtering.',
      scope: 'mcp:read',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'UUID of project' },
          bhk: { type: 'number', description: 'Number of bedrooms (e.g. 2, 3, 4)' },
          maxPrice: { type: 'number', description: 'Maximum price filter' },
        },
      },
      handler: async (companyId, args) => {
        const conditions = [
          eq(units.companyId, companyId),
          eq(units.status, 'available'),
        ];

        if (typeof args.projectId === 'string') {
          conditions.push(eq(units.projectId, args.projectId));
        }
        if (typeof args.bhk === 'number') {
          conditions.push(eq(units.bhk, args.bhk));
        }
        if (typeof args.maxPrice === 'number') {
          conditions.push(lte(units.price, String(args.maxPrice)));
        }

        const items = await db
          .select()
          .from(units)
          .where(and(...conditions))
          .orderBy(units.price)
          .limit(30);

        return { units: items, count: items.length };
      },
    });

    // 5. get_appointments
    this.tools.set('get_appointments', {
      name: 'get_appointments',
      description: 'Fetch upcoming appointments and site visits for the company.',
      scope: 'mcp:read',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: { type: 'string', description: 'Filter by specific lead ID' },
          status: { type: 'string', description: 'Appointment status (e.g. scheduled, completed)' },
        },
      },
      handler: async (companyId, args) => {
        const conditions = [eq(appointments.companyId, companyId)];
        if (typeof args.leadId === 'string') {
          conditions.push(eq(appointments.leadId, args.leadId));
        }
        if (typeof args.status === 'string') {
          conditions.push(eq(appointments.status, args.status));
        }

        const results = await db
          .select()
          .from(appointments)
          .where(and(...conditions))
          .orderBy(desc(appointments.scheduledAt))
          .limit(20);

        return { appointments: results, count: results.length };
      },
    });
  }

  private registerGuardedWriteTools(): void {
    // 1. create_lead_note (Tier T1)
    this.tools.set('create_lead_note', {
      name: 'create_lead_note',
      description: 'Add an internal note to a lead timeline. Guarded under Tier T1.',
      scope: 'mcp:write',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: { type: 'string', description: 'UUID of lead' },
          content: { type: 'string', description: 'Note text content' },
        },
        required: ['leadId', 'content'],
      },
      handler: async (companyId, args, actor) => {
        const leadId = String(args.leadId);
        const content = String(args.content);

        return await guardedActionsService.executeAgentAction({
          companyId,
          agentName: `mcp:${actor.name}`,
          actionType: 'create_lead_note',
          tier: 'T1',
          leadId,
          args: { content },
          executorFn: async () => {
            const [lead] = await db
              .select()
              .from(leads)
              .where(and(eq(leads.id, leadId), eq(leads.companyId, companyId)))
              .limit(1);

            if (!lead) throw new Error(`Lead not found: ${leadId}`);

            const [adminUser] = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.companyId, companyId))
              .limit(1);

            let noteId: string | undefined;
            if (adminUser) {
              const [createdNote] = await db
                .insert(notes)
                .values({
                  companyId,
                  leadId,
                  userId: adminUser.id,
                  content: `[MCP Tool: ${actor.name}] ${content}`,
                })
                .returning();
              noteId = createdNote?.id;
            }

            if (lead.contactId) {
              await db.insert(leadActivities).values({
                companyId,
                leadId,
                contactId: lead.contactId,
                activityType: 'note',
                title: 'Note Added via MCP Tool',
                description: content,
                metadata: { actorKey: actor.name, noteId },
              });
            }

            return { noteId, success: true };
          },
        });
      },
    });

    // 2. update_lead_status (Tier T2)
    this.tools.set('update_lead_status', {
      name: 'update_lead_status',
      description: 'Update the status of a lead. Guarded under Tier T2 (requires auto-approval or human review).',
      scope: 'mcp:write',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: { type: 'string', description: 'UUID of lead' },
          status: { type: 'string', description: 'New lead status (e.g. qualified, contacted, negotiation)' },
          reason: { type: 'string', description: 'Reason for status update' },
        },
        required: ['leadId', 'status'],
      },
      handler: async (companyId, args, actor) => {
        const leadId = String(args.leadId);
        const newStatus = String(args.status);
        const reason = typeof args.reason === 'string' ? args.reason : 'Updated via MCP agent';

        return await guardedActionsService.executeAgentAction({
          companyId,
          agentName: `mcp:${actor.name}`,
          actionType: 'update_lead_status',
          tier: 'T2',
          leadId,
          args: { status: newStatus, reason },
          executorFn: async () => {
            const [lead] = await db
              .select()
              .from(leads)
              .where(and(eq(leads.id, leadId), eq(leads.companyId, companyId)))
              .limit(1);

            if (!lead) throw new Error(`Lead not found: ${leadId}`);

            await db
              .update(leads)
              .set({ status: newStatus, updatedAt: new Date() })
              .where(eq(leads.id, leadId));

            if (lead.contactId) {
              await db.insert(leadActivities).values({
                companyId,
                leadId,
                contactId: lead.contactId,
                activityType: 'status_change',
                title: `Lead Status Changed to ${newStatus}`,
                description: reason,
                metadata: { actorKey: actor.name, previousStatus: lead.status, newStatus },
              });
            }

            return { leadId, previousStatus: lead.status, newStatus, success: true };
          },
        });
      },
    });

    // 3. schedule_appointment (Tier T2)
    this.tools.set('schedule_appointment', {
      name: 'schedule_appointment',
      description: 'Book an appointment / site visit for a lead. Guarded under Tier T2.',
      scope: 'mcp:write',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: { type: 'string', description: 'UUID of lead' },
          projectId: { type: 'string', description: 'UUID of project' },
          scheduledAt: { type: 'string', description: 'ISO 8601 datetime for visit' },
          notes: { type: 'string', description: 'Notes regarding visit' },
        },
        required: ['leadId', 'scheduledAt'],
      },
      handler: async (companyId, args, actor) => {
        const leadId = String(args.leadId);
        const scheduledAt = new Date(String(args.scheduledAt));
        const projectId = typeof args.projectId === 'string' ? args.projectId : null;
        const notesText = typeof args.notes === 'string' ? args.notes : undefined;

        return await guardedActionsService.executeAgentAction({
          companyId,
          agentName: `mcp:${actor.name}`,
          actionType: 'schedule_appointment',
          tier: 'T2',
          leadId,
          args: { scheduledAt: scheduledAt.toISOString(), projectId, notes: notesText },
          executorFn: async () => {
            const [lead] = await db
              .select()
              .from(leads)
              .where(and(eq(leads.id, leadId), eq(leads.companyId, companyId)))
              .limit(1);

            if (!lead) throw new Error(`Lead not found: ${leadId}`);

            const [apt] = await db
              .insert(appointments)
              .values({
                companyId,
                leadId,
                projectId,
                scheduledAt,
                notes: notesText,
                status: 'scheduled',
              })
              .returning();

            if (lead.contactId) {
              await db.insert(leadActivities).values({
                companyId,
                leadId,
                contactId: lead.contactId,
                activityType: 'appointment_scheduled',
                title: 'Site Visit Scheduled via MCP Agent',
                description: `Visit scheduled for ${scheduledAt.toLocaleString()}`,
                metadata: { appointmentId: apt!.id, actorKey: actor.name },
              });
            }

            return { appointmentId: apt!.id, scheduledAt, success: true };
          },
        });
      },
    });

    // 4. send_payment_link (Tier T3 - strictly prohibited for AI)
    this.tools.set('send_payment_link', {
      name: 'send_payment_link',
      description: 'Trigger high-risk direct payment link dispatch. Guarded under Tier T3 (strictly prohibited for AI).',
      scope: 'mcp:write',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: { type: 'string', description: 'UUID of lead' },
          amount: { type: 'number', description: 'Payment amount' },
        },
        required: ['leadId', 'amount'],
      },
      handler: async (companyId, args, actor) => {
        const leadId = String(args.leadId);
        return await guardedActionsService.executeAgentAction({
          companyId,
          agentName: `mcp:${actor.name}`,
          actionType: 'send_payment_link',
          tier: 'T3',
          leadId,
          args: { amount: args.amount },
        });
      },
    });
  }

  /**
   * Executes a tool with strict audit logging, error capturing, and duration recording.
   */
  async executeTool(
    toolName: string,
    companyId: string,
    args: Record<string, unknown>,
    actor: { id: string; name: string },
  ): Promise<unknown> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const startTime = Date.now();
    let outcome: 'success' | 'failure' = 'success';
    let result: unknown;
    let errorMessage: string | undefined;

    try {
      result = await tool.handler(companyId, args, actor);
      return result;
    } catch (err) {
      outcome = 'failure';
      errorMessage = (err as Error).message;
      throw err;
    } finally {
      const durationMs = Date.now() - startTime;
      await auditService.log({
        companyId,
        action: 'mcp_tool_execution',
        resourceType: 'mcp_tool',
        resourceId: toolName,
        details: {
          apiKeyId: actor.id,
          apiKeyName: actor.name,
          toolName,
          durationMs,
          outcome,
          errorMessage,
          argsSummary: Object.keys(args),
        },
      });
      mcpLogger.info(
        { toolName, companyId, actorName: actor.name, durationMs, outcome },
        'MCP tool executed',
      );
    }
  }
}

export const mcpToolsRegistry = new McpToolsRegistry();
