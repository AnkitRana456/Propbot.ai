import { eq, and, isNull, desc, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { leads, contacts, users, tasks, leadActivities, domainEvents } from '../../db/schema/index.js';
import type {
  LeadStatus,
  KanbanBoardResponse,
  KanbanColumn,
  LeadItemResponse,
  BuyerDna,
  ScoreHistoryItem,
  HandoffBrief,
  DuplicateMergeSuggestion,
  LeadPriority,
  IntentLabel,
} from '@propbot/shared';
import { leadsService } from '../leads/leads.service.js';

export const KANBAN_STAGES: { id: LeadStatus; title: string }[] = [
  { id: 'new', title: 'New Leads' },
  { id: 'contacted', title: 'Contacted' },
  { id: 'qualified', title: 'AI Qualified' },
  { id: 'site_visit_scheduled', title: 'Visit Scheduled' },
  { id: 'site_visit_done', title: 'Visit Done' },
  { id: 'negotiation', title: 'Negotiation' },
  { id: 'booked', title: 'Booked / Converted' },
  { id: 'lost', title: 'Lost / Dropped' },
];

export class PipelineService {
  /**
   * Retrieves the full Kanban board grouped by the 8 real-estate stages.
   */
  async getKanbanBoard(companyId: string): Promise<KanbanBoardResponse> {
    const allLeads = await db
      .select({
        lead: leads,
        contact: contacts,
        agent: users,
      })
      .from(leads)
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .leftJoin(users, eq(leads.assignedAgentId, users.id))
      .where(and(eq(leads.companyId, companyId), isNull(leads.deletedAt)))
      .orderBy(desc(leads.updatedAt));

    const columns: KanbanColumn[] = KANBAN_STAGES.map(stage => {
      // 'booked' column also aggregates 'converted'
      const matched = allLeads.filter(row => {
        if (stage.id === 'booked') {
          return row.lead.status === 'booked' || row.lead.status === 'converted';
        }
        return row.lead.status === stage.id;
      });

      const columnLeads: LeadItemResponse[] = matched.slice(0, 50).map(({ lead, contact, agent }) => {
        const name = contact
          ? `${contact.firstName} ${contact.lastName || ''}`.trim()
          : 'Prospective Buyer';

        return {
          id: lead.id,
          companyId: lead.companyId,
          contactId: lead.contactId,
          chatbotId: lead.chatbotId,
          conversationId: null,
          assignedAgentId: lead.assignedAgentId,
          assignedAgentName: agent ? agent.name : null,
          name,
          firstName: contact?.firstName ?? 'Prospect',
          lastName: contact?.lastName ?? null,
          phone: contact?.phone ?? '—',
          email: contact?.email ?? null,
          status: lead.status as LeadStatus,
          lostReason: lead.lostReason,
          priority: lead.priority as LeadPriority,
          intentScore: lead.intentScore,
          intentLabel: lead.intentLabel as IntentLabel,
          scoreExplanation: (lead.scoreExplanation as string[]) || [],
          scoreHistory: (lead.scoreHistory as ScoreHistoryItem[]) || [],
          buyerDna: (lead.buyerDna as BuyerDna) || {},
          handoffBrief: (lead.handoffBrief as HandoffBrief | null) || null,
          duplicateMergeSuggestion:
            (lead.duplicateMergeSuggestion as DuplicateMergeSuggestion | null) || null,
          phoneVerified: lead.phoneVerified,
          tags: (lead.tags as string[]) || [],
          pageUrl: lead.pageUrl,
          nextFollowUpAt: lead.nextFollowUpAt ? lead.nextFollowUpAt.toISOString() : null,
          source: lead.source,
          slaStartedAt: lead.slaStartedAt ? lead.slaStartedAt.toISOString() : null,
          slaBreachedAt: lead.slaBreachedAt ? lead.slaBreachedAt.toISOString() : null,
          createdAt: lead.createdAt.toISOString(),
          updatedAt: lead.updatedAt.toISOString(),
        };
      });

      return {
        id: stage.id,
        title: stage.title,
        leads: columnLeads,
        count: matched.length,
      };
    });

    return {
      columns,
      totalLeads: allLeads.length,
    };
  }

  /**
   * Moves a lead to a new pipeline stage with mandatory lostReason validation and automatic tasks.
   */
  async updateStage(
    companyId: string,
    leadId: string,
    newStatus: LeadStatus,
    lostReason?: string,
    userId?: string,
  ): Promise<LeadItemResponse> {
    if (newStatus === 'lost' && (!lostReason || !lostReason.trim())) {
      throw new Error('A lost reason is mandatory when moving a lead to Lost');
    }

    const currentLead = await leadsService.getLeadById(companyId, leadId);
    const previousStatus = currentLead.status;

    await db.transaction(async tx => {
      // 1. Update lead status
      await tx
        .update(leads)
        .set({
          status: newStatus,
          lostReason: newStatus === 'lost' ? lostReason : null,
          updatedAt: new Date(),
        })
        .where(and(eq(leads.id, leadId), eq(leads.companyId, companyId)));

      // 2. Automated Follow-up Tasks based on stage transition
      const taskAssigneeId = currentLead.assignedAgentId || userId;
      if (taskAssigneeId) {
        if (newStatus === 'site_visit_scheduled') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);

          await tx.insert(tasks).values({
            companyId,
            leadId,
            assignedUserId: taskAssigneeId,
            title: 'Prepare property collateral & confirm site visit',
            type: 'site_visit',
            dueDate: tomorrow,
            priority: 'high',
            status: 'pending',
            description: 'Ensure brochures, layout blueprints, and unit price sheets are prepared before visit.',
          });
        } else if (newStatus === 'site_visit_done') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);

          await tx.insert(tasks).values({
            companyId,
            leadId,
            assignedUserId: taskAssigneeId,
            title: 'Post-visit feedback & unit selection follow-up',
            type: 'follow_up',
            dueDate: tomorrow,
            priority: 'high',
            status: 'pending',
            description: 'Follow up with buyer regarding short-listed units, payment options, and next steps.',
          });
        }
      }

      // 3. Insert into lead_activities
      await tx.insert(leadActivities).values({
        companyId,
        leadId,
        contactId: currentLead.contactId,
        activityType: 'status_changed',
        title: `Stage Changed: ${previousStatus.toUpperCase()} ➜ ${newStatus.toUpperCase()}`,
        description: lostReason ? `Reason: ${lostReason}` : undefined,
        metadata: {
          previousStatus,
          newStatus,
          lostReason,
          updatedBy: userId,
        },
      });

      // 4. Emit transactional outbox event
      await tx.insert(domainEvents).values({
        companyId,
        type: 'lead_status_changed',
        payload: {
          lead_id: leadId,
          previous_status: previousStatus,
          new_status: newStatus,
          reason: lostReason,
        },
      });
    });

    return leadsService.getLeadById(companyId, leadId);
  }

  /**
   * Bulk updates stage status for multiple leads.
   */
  async bulkUpdateStatus(
    companyId: string,
    leadIds: string[],
    newStatus: LeadStatus,
    lostReason?: string,
    _userId?: string,
  ): Promise<{ updatedCount: number }> {
    if (newStatus === 'lost' && (!lostReason || !lostReason.trim())) {
      throw new Error('A lost reason is mandatory when marking leads as Lost');
    }

    if (!leadIds.length) return { updatedCount: 0 };

    await db.transaction(async tx => {
      await tx
        .update(leads)
        .set({
          status: newStatus,
          lostReason: newStatus === 'lost' ? lostReason : null,
          updatedAt: new Date(),
        })
        .where(and(eq(leads.companyId, companyId), inArray(leads.id, leadIds)));

      for (const leadId of leadIds) {
        await tx.insert(domainEvents).values({
          companyId,
          type: 'lead_status_changed',
          payload: {
            lead_id: leadId,
            new_status: newStatus,
            reason: lostReason,
            bulk: true,
          },
        });
      }
    });

    return { updatedCount: leadIds.length };
  }
}

export const pipelineService = new PipelineService();
