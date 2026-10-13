import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { leads, contacts } from '../../db/schema/index.js';
import { modelRouter, TaskTier } from '../ai/router.js';
import { playbooksService } from '../ai/playbooks.service.js';
import type {
  CopilotSuggestReplyInput,
  CopilotSuggestReplyResponse,
  CopilotSummaryResponse,
  CopilotCallScriptResponse,
  CopilotObjectionRebuttalInput,
  CopilotObjectionRebuttalResponse,
  BuyerDna,
} from '@propbot/shared';

export class CopilotService {
  /**
   * Generates 3 strategic AI reply suggestions for an agent in Shared Inbox / Lead Drawer
   */
  async suggestReply(
    companyId: string,
    leadId: string,
    input: CopilotSuggestReplyInput = { tone: 'warm' },
  ): Promise<CopilotSuggestReplyResponse> {
    const [lead] = await db
      .select({
        id: leads.id,
        contactId: leads.contactId,
        buyerDna: leads.buyerDna,
        intentScore: leads.intentScore,
        contactName: sql<string>`concat(${contacts.firstName}, ' ', coalesce(${contacts.lastName}, ''))`,
      })
      .from(leads)
      .innerJoin(contacts, eq(leads.contactId, contacts.id))
      .where(and(eq(leads.companyId, companyId), eq(leads.id, leadId)));

    if (!lead) throw new Error('Lead not found');

    const dna = (lead.buyerDna as BuyerDna) || {};
    const bhk = dna.bhk?.length ? dna.bhk.join('/') : '3BHK';
    const locality = dna.localities?.length ? dna.localities[0] : 'prime city locality';
    const budgetStr = dna.budgetMax
      ? `₹${(dna.budgetMax / 10000000).toFixed(2)} Cr`
      : 'target budget';

    const prompt = `Generate 3 high-converting response suggestions for a real estate agent replying to buyer ${lead.contactName}.
Buyer DNA: ${bhk} residences in ${locality}, budget ${budgetStr}, Intent Score: ${lead.intentScore}/100.
Last visitor message: "${input.lastVisitorMessage || 'Interested in property options and pricing'}"
Desired tone: ${input.tone}
Return strict JSON with suggestions: [{ id: "sug-1", title: string, text: string, strategy: string }]`;

    const aiCall = await modelRouter.call({
      tier: TaskTier.FAST,
      companyId,
      chatbotId: 'copilot',
      systemPrompt: 'You are an elite real estate sales copilot generating high-converting agent replies in strict JSON.',
      userMessage: prompt,
      promptName: 'copilot_suggest_reply',
      promptVersion: 'v13.0',
    });

    try {
      const parsed = JSON.parse(aiCall.text) as CopilotSuggestReplyResponse;
      if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        return parsed;
      }
    } catch {
      // Fallback
    }

    return {
      suggestions: [
        {
          id: 'sug-1',
          title: 'Invite for Private Preview',
          text: `Hi ${lead.contactName.split(' ')[0] || 'there'}, I would be delighted to host you for a private walkthrough of our ${bhk} sample residences this Saturday at 11:00 AM or 3:00 PM. Would either timing suit you?`,
          strategy: 'Proactive visit booking',
        },
        {
          id: 'sug-2',
          title: 'Share Milestone Payment Plan',
          text: `We have a flexible 20:80 milestone construction payment schedule available this month, which keeps your initial outlay to just 20%. Would you like me to share the detailed cost schedule?`,
          strategy: 'Overcome budget hesitation',
        },
        {
          id: 'sug-3',
          title: 'Share Master Brochure & Plans',
          text: `I have the complete architectural floor plans and 45,000 sq ft clubhouse layout ready to share. Would WhatsApp or email be more convenient for you?`,
          strategy: 'Asset delivery',
        },
      ],
    };
  }

  /**
   * Generates a 1-click executive summary of this lead
   */
  async summariseLead(companyId: string, leadId: string): Promise<CopilotSummaryResponse> {
    const [lead] = await db
      .select({
        id: leads.id,
        status: leads.status,
        intentScore: leads.intentScore,
        buyerDna: leads.buyerDna,
        contactName: sql<string>`concat(${contacts.firstName}, ' ', coalesce(${contacts.lastName}, ''))`,
      })
      .from(leads)
      .innerJoin(contacts, eq(leads.contactId, contacts.id))
      .where(and(eq(leads.companyId, companyId), eq(leads.id, leadId)));

    if (!lead) throw new Error('Lead not found');

    const dna = (lead.buyerDna as BuyerDna) || {};
    const bhk = dna.bhk?.length ? dna.bhk.join(', ') : '3BHK/4BHK';
    const locality = dna.localities?.length ? dna.localities.join(', ') : 'Prime Bangalore East';
    const budgetStr = dna.budgetMax
      ? `₹${(dna.budgetMax / 10000000).toFixed(2)} Cr`
      : 'Budget not explicitly capped';

    const aiCall = await modelRouter.call({
      tier: TaskTier.FAST,
      companyId,
      chatbotId: 'copilot',
      systemPrompt: 'You produce executive real estate buyer briefs in strict JSON.',
      userMessage: `Summarise buyer ${lead.contactName}: DNA: ${JSON.stringify(dna)}, score: ${lead.intentScore}. Return JSON with summary, keyRequirements (array), statedObjections (array), recommendedAction.`,
      promptName: 'copilot_summary',
      promptVersion: 'v13.0',
    });

    try {
      const parsed = JSON.parse(aiCall.text) as Partial<CopilotSummaryResponse>;
      if (parsed.summary) {
        return {
          leadId: lead.id,
          leadName: lead.contactName,
          intentScore: lead.intentScore,
          status: lead.status,
          sentiment: 'positive',
          intentLevel: lead.intentScore >= 70 ? 'high' : lead.intentScore >= 40 ? 'medium' : 'low',
          summary: parsed.summary,
          keyRequirements: parsed.keyRequirements || [`${bhk} residence in ${locality}`, `Budget: ${budgetStr}`],
          statedObjections: parsed.statedObjections || (dna.objections || []),
          recommendedAction: parsed.recommendedAction || 'Call within 5 minutes to confirm private weekend site visit preview.',
          generatedAt: new Date().toISOString(),
        };
      }
    } catch {
      // Fallback
    }

    return {
      leadId: lead.id,
      leadName: lead.contactName,
      intentScore: lead.intentScore,
      status: lead.status,
      sentiment: 'positive',
      intentLevel: lead.intentScore >= 70 ? 'high' : lead.intentScore >= 40 ? 'medium' : 'low',
      summary: `High-intent prospect actively evaluating ${bhk} residences in ${locality} with stated budget ${budgetStr}. Demonstrated purchase readiness via conversational interactions.`,
      keyRequirements: [`${bhk} residence`, `Target location: ${locality}`, `Budget: ${budgetStr}`],
      statedObjections: dna.objections || ['Evaluating construction schedule vs possession dates'],
      recommendedAction: 'Call within 5 minutes to confirm private weekend site visit preview.',
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates a 60-second personalized call script derived from Buyer DNA
   */
  async generateCallScript(companyId: string, leadId: string): Promise<CopilotCallScriptResponse> {
    const [lead] = await db
      .select({
        id: leads.id,
        buyerDna: leads.buyerDna,
        intentScore: leads.intentScore,
        contactName: sql<string>`concat(${contacts.firstName}, ' ', coalesce(${contacts.lastName}, ''))`,
      })
      .from(leads)
      .innerJoin(contacts, eq(leads.contactId, contacts.id))
      .where(and(eq(leads.companyId, companyId), eq(leads.id, leadId)));

    if (!lead) throw new Error('Lead not found');

    const dna = (lead.buyerDna as BuyerDna) || {};
    const firstName = lead.contactName.split(' ')[0] || 'there';
    const bhk = dna.bhk?.length ? dna.bhk.join('/') : '3BHK';
    const locality = dna.localities?.length ? dna.localities[0] : 'prime city locality';

    const aiCall = await modelRouter.call({
      tier: TaskTier.FAST,
      companyId,
      chatbotId: 'copilot',
      systemPrompt: 'You produce high-converting phone call scripts for real estate sales advisors in strict JSON.',
      userMessage: `Create cold/warm call script for ${lead.contactName}: DNA: ${JSON.stringify(dna)}. Return JSON with callGoal, suggestedOpener, qualifyingQuestions (array), talkingPoints (array), objectionPreemptions (array of {anticipatedObjection, rebuttal}), closingHook.`,
      promptName: 'copilot_call_script',
      promptVersion: 'v13.0',
    });

    try {
      const parsed = JSON.parse(aiCall.text) as Partial<CopilotCallScriptResponse>;
      if (parsed.suggestedOpener) {
        return {
          leadId: lead.id,
          leadName: lead.contactName,
          callGoal: parsed.callGoal || 'Qualify purchase readiness and schedule private site visit preview.',
          suggestedOpener: parsed.suggestedOpener,
          qualifyingQuestions: parsed.qualifyingQuestions || [
            'What possession timeline best fits your family relocation plans?',
            'Are you looking for self-use residence or rental yield investment?',
          ],
          talkingPoints: parsed.talkingPoints || [
            `Exclusive ${bhk} residences in ${locality} with imported sanitary ware and private deck`,
            '45,000 sq ft clubhouse with temperature-controlled indoor swimming pool',
            'Flexible 20:80 milestone construction payment schedule available this month',
          ],
          objectionPreemptions: parsed.objectionPreemptions || [
            {
              anticipatedObjection: 'Price is above my initial budget',
              rebuttal: 'We have flexible 20:80 milestone schedules where only 20% is required upfront, reducing immediate cash flow pressure.',
            },
          ],
          closingHook: parsed.closingHook || 'We have exclusive preview slots open this Saturday at 11:00 AM. May I reserve a priority slot for you?',
        };
      }
    } catch {
      // Fallback
    }

    return {
      leadId: lead.id,
      leadName: lead.contactName,
      callGoal: 'Qualify purchase readiness and schedule private site visit preview.',
      suggestedOpener: `Hi ${firstName}, this is Rohan from Prestige Luxury Residences. I noticed you were exploring our ${bhk} floor plans online and wanted to personally share the updated availability.`,
      qualifyingQuestions: [
        'What possession timeline best fits your family relocation plans?',
        'Are you looking for self-use residence or rental yield investment?',
        'Have you explored pre-approved home loan rates with our banking partners?',
      ],
      talkingPoints: [
        `Exclusive ${bhk} residences in ${locality} with 11.5 ft ceiling clearance and private servant quarters`,
        '45,000 sq ft central clubhouse with heated indoor pool, EV charging, and squash courts',
        'Attractive 20:80 milestone construction-linked payment plan available this week',
      ],
      objectionPreemptions: [
        {
          anticipatedObjection: 'Price is above my initial budget',
          rebuttal: 'We have flexible 20:80 milestone schedules where only 20% is required upfront, reducing immediate cash flow pressure.',
        },
        {
          anticipatedObjection: 'Possession date is too far out',
          rebuttal: 'The project is strictly RERA delayed compensation guaranteed with Phase 1 possession scheduled for December 2027.',
        },
      ],
      closingHook: 'We have exclusive designer villa preview slots open this Saturday at 11:00 AM. May I reserve a priority slot for you and your family?',
    };
  }

  /**
   * Generates objection rebuttals using company playbooks and real estate negotiation strategies
   */
  async getObjectionRebuttal(
    companyId: string,
    input: CopilotObjectionRebuttalInput,
  ): Promise<CopilotObjectionRebuttalResponse> {
    const { playbooks } = await playbooksService.listPlaybooks(companyId);
    const objectionLower = input.objection.toLowerCase();

    // Find matching playbook
    const matchedPlaybook = playbooks.find(p => {
      return p.triggerKeywords.some(kw => objectionLower.includes(kw.toLowerCase()));
    });

    if (matchedPlaybook) {
      return {
        objection: input.objection,
        detectedCategory: matchedPlaybook.category,
        rebuttals: [
          {
            framework: 'Company Approved Playbook',
            text: matchedPlaybook.rebuttalText,
          },
          {
            framework: 'Payment Structure Alternative',
            text: 'We offer a flexible 20:80 milestone payment plan where you pay only 20% upfront and the remaining 80% upon possession, substantially reducing interim interest costs.',
          },
          {
            framework: 'Value Reframing & Long-Term Appreciation',
            text: 'Given the upcoming Blue Line Metro just 800m away and premier international schools nearby, independent property analysts project 15-18% capital appreciation over the construction cycle.',
          },
        ],
      };
    }

    // Default real estate rebuttal frameworks
    return {
      objection: input.objection,
      detectedCategory: 'price_too_high',
      rebuttals: [
        {
          framework: 'Milestone Flexibility',
          text: 'With our flexible 20:80 payment plan, you only commit 20% during booking, with major installments aligned with actual construction milestones.',
        },
        {
          framework: 'Inclusions & Total Cost Transparency',
          text: 'Unlike standard properties, our price includes dedicated private parking, pre-installed smart automation, and full lifetime clubhouse membership with zero hidden charges.',
        },
        {
          framework: 'RERA Assured Quality & Delay Compensation',
          text: 'All units are backed by RERA delayed possession compensation clauses and constructed by top-tier contractors with an unblemished 150+ project delivery track record.',
        },
      ],
    };
  }
}

export const copilotService = new CopilotService();
