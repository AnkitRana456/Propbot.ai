import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { leads, contacts } from '../../db/schema/index.js';
import { guardedActionsService, type ActionTier } from '../ai/guarded-actions.service.js';
import { outboxDispatcherService } from '../events/outbox-dispatcher.service.js';
import type { NextBestActionItem, BuyerDna } from '@propbot/shared';
import { pino } from 'pino';

const nbaLogger = pino({
  name: 'next-best-action',
  level: process.env.LOG_LEVEL ?? 'info',
});

export class NextBestActionService {
  constructor() {
    this.registerOutboxConsumer();
  }

  private registerOutboxConsumer(): void {
    outboxDispatcherService.registerConsumer('next_best_action', async (event) => {
      const relevantTypes = [
        'intent_changed',
        'lead_hot',
        'visit_booked',
        'room_viewed',
        'message_received',
        'lead_status_changed',
      ];
      if (relevantTypes.includes(event.type)) {
        await this.handleEvent(event);
      }
    });
  }

  /**
   * Generates a context-grounded Next Best Action for a lead based on event and Buyer DNA.
   */
  evaluateRecommendation(
    lead: {
      id: string;
      intentScore: number;
      status: string;
      buyerDna: unknown;
      contactName: string;
    },
    eventType: string,
    payload: Record<string, unknown> = {},
  ): NextBestActionItem {
    const contactName = lead.contactName || 'Buyer';
    const dna = (lead.buyerDna as BuyerDna) || {};
    const nowIso = new Date().toISOString();

    // 1. Hot Lead Trigger
    if (eventType === 'lead_hot' || lead.intentScore >= 70) {
      return {
        actionType: 'create_task',
        title: 'Call within 5 minutes',
        explanation: `Lead intent score is hot (${lead.intentScore}/100). Reaching out while buyer interest is peak achieves highest site visit conversion.`,
        tier: 'T1',
        args: {
          lead_id: lead.id,
          title: `Urgent: Call hot lead ${contactName} (Intent ${lead.intentScore}/100)`,
        },
        suggestedAt: nowIso,
        status: 'suggested',
      };
    }

    // 2. Site Visit Booked Trigger
    if (eventType === 'visit_booked' || lead.status === 'site_visit_scheduled') {
      return {
        actionType: 'draft_message',
        title: 'Send Visit Confirmation & Google Maps Directions',
        explanation: `Site visit scheduled. Sharing navigation coordinates, developer site coordinator details, and floor plans 24h prior prevents no-shows.`,
        tier: 'T1',
        args: {
          lead_id: lead.id,
          channel: 'whatsapp',
          body: `Hi ${contactName}, your site visit is confirmed! Here is the Google Maps location and entrance directions.`,
        },
        suggestedAt: nowIso,
        status: 'suggested',
      };
    }

    // 3. Shortlist Room Viewed Trigger
    if (eventType === 'room_viewed') {
      const timeSpent = typeof payload.time_spent_seconds === 'number' ? payload.time_spent_seconds : 45;
      return {
        actionType: 'create_task',
        title: 'Offer Priority Unit Consultation',
        explanation: `Buyer spent ${timeSpent}s reviewing the Smart Shortlist Room. Connect while shortlisted floor plans are top of mind.`,
        tier: 'T1',
        args: {
          lead_id: lead.id,
          title: `Follow up on Shortlist Room favorites with ${contactName}`,
        },
        suggestedAt: nowIso,
        status: 'suggested',
      };
    }

    // 4. Price & Discount Inquiry Trigger
    if (eventType === 'intent_changed' && Array.isArray(payload.reasons) && payload.reasons.some((r: string) => /price|payment|discount/i.test(r))) {
      return {
        actionType: 'send_price_quote',
        title: 'Request Manager Special Payment Plan Approval',
        explanation: `Buyer inquired on payment flexibility. Structuring a tailored developer milestone payment plan requires manager authorization.`,
        tier: 'T2',
        args: {
          lead_id: lead.id,
          offered_price: dna.budgetMax || 20000000,
          terms: 'Flexible 20:80 developer milestone payment plan',
        },
        suggestedAt: nowIso,
        status: 'suggested',
      };
    }

    // 5. Active Chat Engagement Default
    return {
      actionType: 'draft_message',
      title: 'Offer Weekend Site Visit Slot',
      explanation: `Buyer is engaged in active chat inquiries. Recommending two specific weekend site visit slots guides them toward in-person viewing.`,
      tier: 'T1',
      args: {
        lead_id: lead.id,
        channel: 'whatsapp',
        body: `Namaste ${contactName}, would Saturday at 11 AM or Sunday at 3 PM be convenient for a guided project walkthrough?`,
      },
      suggestedAt: nowIso,
      status: 'suggested',
    };
  }

  /**
   * Evaluates and updates Next Best Action on a lead from a domain event.
   */
  async handleEvent(event: {
    companyId: string;
    type: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const leadId = (event.payload.leadId || event.payload.lead_id) as string | undefined;
    if (!leadId) return;

    try {
      const [leadRow] = await db
        .select({
          id: leads.id,
          intentScore: leads.intentScore,
          status: leads.status,
          buyerDna: leads.buyerDna,
          contactName: sql<string>`concat(${contacts.firstName}, ' ', coalesce(${contacts.lastName}, ''))`,
        })
        .from(leads)
        .innerJoin(contacts, eq(leads.contactId, contacts.id))
        .where(and(eq(leads.id, leadId), eq(leads.companyId, event.companyId)))
        .limit(1);

      if (!leadRow) return;

      const recommendation = this.evaluateRecommendation(leadRow, event.type, event.payload);

      await db
        .update(leads)
        .set({
          nextBestAction: recommendation,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, leadId));

      nbaLogger.info({ leadId, action: recommendation.title }, 'Updated Next Best Action on lead');
    } catch (err) {
      nbaLogger.warn({ leadId, err }, 'Failed to evaluate Next Best Action');
    }
  }

  /**
   * Executes the lead's current Next Best Action through the Guarded AI Actions framework.
   */
  async executeAction(
    companyId: string,
    leadId: string,
    _userId: string,
  ) {
    const [lead] = await db
      .select({
        id: leads.id,
        nextBestAction: leads.nextBestAction,
      })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.companyId, companyId)))
      .limit(1);

    if (!lead || !lead.nextBestAction) {
      throw new Error('No Next Best Action recommendation found on lead.');
    }

    const nba = lead.nextBestAction as NextBestActionItem;

    const actionResult = await guardedActionsService.executeAgentAction({
      companyId,
      agentName: 'next-best-action-copilot',
      actionType: nba.actionType,
      tier: nba.tier as ActionTier,
      leadId,
      args: nba.args || {},
      executorFn: async () => {
        return {
          executedAt: new Date().toISOString(),
          actionTitle: nba.title,
          appliedArgs: nba.args,
        };
      },
    });

    // Update status on lead recommendation
    const updatedNba: NextBestActionItem = {
      ...nba,
      status: actionResult.status === 'proposed' ? 'executing' : 'executed',
    };

    await db
      .update(leads)
      .set({
        nextBestAction: updatedNba,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    return actionResult;
  }
}

export const nextBestActionService = new NextBestActionService();
