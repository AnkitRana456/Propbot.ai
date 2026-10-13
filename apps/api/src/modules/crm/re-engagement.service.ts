import { eq, and, sql, desc, isNull, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  leads,
  contacts,
  reEngagementLogs,
  agentActions,
  domainEvents,
  whatsappConfigs,
} from '../../db/schema/index.js';
import { whatsappAdapter } from '../whatsapp/whatsapp.adapter.js';
import type { ReEngagementSweepResult, BuyerDna } from '@propbot/shared';

export interface SweepOptions {
  companyId?: string;
  forceAll?: boolean;
}

export class ReEngagementService {
  /**
   * Generates a personalized message hook using Buyer DNA
   */
  generatePersonalizedHook(
    leadName: string,
    buyerDna: BuyerDna,
    intervalDays: number,
  ): { template: string; content: string } {
    const firstName = leadName.split(' ')[0] || 'there';
    const bhk = buyerDna.bhk.length > 0 ? buyerDna.bhk.join('/') : '3BHK';
    const locality = buyerDna.localities.length > 0 ? buyerDna.localities[0] : 'prime city location';
    const budgetMax = buyerDna.budgetMax
      ? `₹${(buyerDna.budgetMax / 10000000).toFixed(2)} Cr`
      : 'your budget';

    if (intervalDays === 1) {
      return {
        template: 'day_1_inventory_alert',
        content: `Hi ${firstName}, 2 newly released ${bhk} units in ${locality} matching ${budgetMax} were just added to our master inventory. Would you like me to share the floor plans? Reply STOP to opt out.`,
      };
    }

    if (intervalDays === 3) {
      return {
        template: 'day_3_payment_flexibility',
        content: `Hello ${firstName}, regarding your inquiry for ${bhk} residences in ${locality}: we have opened a flexible 20:80 construction milestone plan this week. Would you like to review the cost breakdown? Reply STOP to opt out.`,
      };
    }

    if (intervalDays === 7) {
      return {
        template: 'day_7_private_preview',
        content: `Hi ${firstName}, our developer sales gallery is hosting private site previews for ${bhk} residences this weekend. Can I reserve a priority 11:00 AM slot for you? Reply STOP to opt out.`,
      };
    }

    return {
      template: 'day_30_phase_launch',
      content: `Hello ${firstName}, we are preparing to launch the next phase of luxury residences in ${locality} at pre-launch pricing. Reply to receive the priority investor prospectus, or STOP to opt out.`,
    };
  }

  /**
   * Runs the re-engagement sweep across active companies
   */
  async runSweep(options: SweepOptions = {}): Promise<ReEngagementSweepResult> {
    const now = new Date();
    let processedCount = 0;
    let dispatchedCount = 0;
    let skippedOptOutCount = 0;
    let failedCount = 0;
    const dispatchedLeads: string[] = [];

    const conditions = [
      inArray(leads.status, ['new', 'contacted', 'qualified']),
      isNull(leads.deletedAt),
    ];

    if (options.companyId) {
      conditions.push(eq(leads.companyId, options.companyId));
    }

    const candidateLeads = await db
      .select({
        id: leads.id,
        companyId: leads.companyId,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
        buyerDna: leads.buyerDna,
        contactId: leads.contactId,
        contactName: sql<string>`concat(${contacts.firstName}, ' ', coalesce(${contacts.lastName}, ''))`,
        contactPhone: contacts.phone,
        leadMetadata: leads.customFields,
      })
      .from(leads)
      .innerJoin(contacts, eq(leads.contactId, contacts.id))
      .where(and(...conditions))
      .limit(200);

    for (const lead of candidateLeads) {
      processedCount++;

      // Check opt-out
      const meta = (lead.leadMetadata as Record<string, unknown>) || {};
      if (meta.optedOut || meta.unsubscribed) {
        skippedOptOutCount++;
        continue;
      }

      const daysInactive = Math.floor(
        (now.getTime() - new Date(lead.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
      );

      // Match interval bracket: 1, 3, 7, 30
      let targetInterval = 0;
      if (daysInactive >= 30) targetInterval = 30;
      else if (daysInactive >= 7) targetInterval = 7;
      else if (daysInactive >= 3) targetInterval = 3;
      else if (daysInactive >= 1) targetInterval = 1;

      if (targetInterval === 0 && !options.forceAll) {
        continue;
      }
      if (options.forceAll && targetInterval === 0) {
        targetInterval = 1;
      }

      // Check if already sent for this interval
      const [existingLog] = await db
        .select({ id: reEngagementLogs.id })
        .from(reEngagementLogs)
        .where(
          and(
            eq(reEngagementLogs.companyId, lead.companyId),
            eq(reEngagementLogs.leadId, lead.id),
            eq(reEngagementLogs.intervalDays, targetInterval),
          ),
        )
        .limit(1);

      if (existingLog) {
        continue;
      }

      // Generate Hook
      const dna = (lead.buyerDna as BuyerDna) || {
        budgetMin: null,
        budgetMax: null,
        bhk: [],
        localities: [],
        propertyType: null,
        purpose: null,
        possessionTimeline: null,
        financingNeeded: null,
        objections: [],
        competitorsMentioned: [],
      };

      const { template, content } = this.generatePersonalizedHook(
        lead.contactName,
        dna,
        targetInterval,
      );

      try {
        // Record log in re_engagement_logs
        await db.insert(reEngagementLogs).values({
          companyId: lead.companyId,
          leadId: lead.id,
          channel: 'whatsapp',
          intervalDays: targetInterval,
          hookTemplate: template,
          messageContent: content,
          status: 'sent',
          sentAt: now,
        });

        // Record in agent_actions for transparency
        await db.insert(agentActions).values({
          companyId: lead.companyId,
          agentName: 're_engagement_worker',
          actionType: 'send_re_engagement_hook',
          tier: 'T1',
          status: 'executed',
          args: {
            leadId: lead.id,
            intervalDays: targetInterval,
            phone: lead.contactPhone,
            template,
          },
          result: { success: true },
        });

        // Emit domain event
        await db.insert(domainEvents).values({
          companyId: lead.companyId,
          type: 'lead_re_engaged',
          payload: {
            lead_id: lead.id,
            interval_days: targetInterval,
            template,
          },
        });

        // Send via WhatsApp adapter if configured
        const [config] = await db
          .select()
          .from(whatsappConfigs)
          .where(eq(whatsappConfigs.companyId, lead.companyId));

        if (config?.enableAutomation && lead.contactPhone) {
          await whatsappAdapter.send(
            lead.companyId,
            lead.contactPhone,
            { type: 'text', text: content },
            {
              phoneNumberId: config.phoneNumberId || 'mock_phone_id',
              accessToken: config.accessToken || 'mock_token',
            },
          );
        }

        dispatchedCount++;
        dispatchedLeads.push(lead.id);
      } catch {
        failedCount++;
      }
    }

    return {
      processedCount,
      dispatchedCount,
      skippedOptOutCount,
      failedCount,
      dispatchedLeads,
    };
  }

  async getLeadHistory(companyId: string, leadId: string) {
    return db
      .select()
      .from(reEngagementLogs)
      .where(
        and(
          eq(reEngagementLogs.companyId, companyId),
          eq(reEngagementLogs.leadId, leadId),
        ),
      )
      .orderBy(desc(reEngagementLogs.sentAt));
  }

  async runDormantLeadSweep(
    companyId?: string,
    options: SweepOptions = {},
  ): Promise<ReEngagementSweepResult> {
    return this.runSweep({ companyId, ...options });
  }

  async getLeadReEngagementHistory(companyId: string, leadId: string) {
    return this.getLeadHistory(companyId, leadId);
  }
}

export const reEngagementService = new ReEngagementService();
