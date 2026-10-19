import { eq, and, or, inArray, desc, asc, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { leads, contacts, conversations, messages } from '../../db/schema/index.js';
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
   * Fetches real conversation messages and detected intent topics for this lead/contact
   */
  private async getLeadConversationContext(
    companyId: string,
    leadId: string,
    contactId: string | null,
  ): Promise<{
    transcript: string;
    lastVisitorMessage: string;
    visitorMessages: string[];
    topicsDiscussed: string[];
    channel: string;
  }> {
    try {
      const convs = await db
        .select({ id: conversations.id, channel: conversations.channel })
        .from(conversations)
        .where(
          and(
            eq(conversations.companyId, companyId),
            or(
              eq(conversations.leadId, leadId),
              contactId ? eq(conversations.contactId, contactId) : sql`false`,
            ),
          ),
        )
        .orderBy(desc(conversations.createdAt))
        .limit(3);

      if (!convs.length) {
        return {
          transcript: '',
          lastVisitorMessage: '',
          visitorMessages: [],
          topicsDiscussed: [],
          channel: 'web',
        };
      }

      const convIds = convs.map(c => c.id);
      const msgs = await db
        .select({
          senderType: messages.senderType,
          content: messages.content,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(inArray(messages.conversationId, convIds))
        .orderBy(asc(messages.createdAt))
        .limit(30);

      const transcript = msgs
        .map(m => `${m.senderType === 'visitor' ? 'Buyer' : 'Assistant'}: ${m.content}`)
        .join('\n');

      const visitorMsgs = msgs.filter(m => m.senderType === 'visitor').map(m => m.content);
      const lastVisitorMessage = visitorMsgs[visitorMsgs.length - 1] || '';

      const allText = msgs.map(m => m.content.toLowerCase()).join(' ');
      const topics: string[] = [];
      if (/price|pricing|cost|rate|budget|cr|lakh|payment|20:80/i.test(allText)) topics.push('Pricing & Payment Plans');
      if (/visit|tour|walkthrough|saturday|sunday|weekend|see/i.test(allText)) topics.push('Site Visit Scheduling');
      if (/brochure|floor plan|layout|master|pdf/i.test(allText)) topics.push('Brochure & Floor Plans');
      if (/possession|rera|timeline|ready|construction/i.test(allText)) topics.push('Possession & RERA Timeline');
      if (/amenities|clubhouse|pool|gym|garden/i.test(allText)) topics.push('Clubhouse & Amenities');
      if (/loan|emi|bank|finance|interest/i.test(allText)) topics.push('Home Loan & Financing');

      return {
        transcript,
        lastVisitorMessage,
        visitorMessages: visitorMsgs,
        topicsDiscussed: topics,
        channel: convs[0]?.channel || 'web',
      };
    } catch {
      return {
        transcript: '',
        lastVisitorMessage: '',
        visitorMessages: [],
        topicsDiscussed: [],
        channel: 'web',
      };
    }
  }

  /**
   * Generates 3 strategic AI reply suggestions customized to actual conversation
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
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .where(and(eq(leads.companyId, companyId), eq(leads.id, leadId)));

    if (!lead) throw new Error('Lead not found');

    const contactName = lead.contactName?.trim() || 'Prospect';
    const firstName = contactName.split(' ')[0] || 'there';
    const dna = (lead.buyerDna as BuyerDna) || {};
    const bhk = dna.bhk?.length ? dna.bhk.join('/') : '3BHK';
    const locality = dna.localities?.length ? dna.localities[0] : 'prime city locality';
    const budgetStr = dna.budgetMax
      ? `₹${(dna.budgetMax / 10000000).toFixed(2)} Cr`
      : 'target budget';

    const convCtx = await this.getLeadConversationContext(companyId, leadId, lead.contactId);
    const lastMsg = input.lastVisitorMessage || convCtx.lastVisitorMessage || 'Interested in property options and pricing';

    const prompt = `Generate 3 high-converting response suggestions for a real estate agent replying to buyer ${contactName}.
Buyer DNA: ${bhk} residences in ${locality}, budget ${budgetStr}, Intent Score: ${lead.intentScore}/100.
Channel: ${convCtx.channel}
Conversation Transcript:
${convCtx.transcript || '(No previous chat recorded - prospect submitted inquiry form)'}
Last Buyer Message/Question: "${lastMsg}"
Topics Asked: ${convCtx.topicsDiscussed.join(', ') || 'General Enquiry'}
Desired tone: ${input.tone}
Return strict JSON with suggestions: [{ id: "sug-1", title: string, text: string, strategy: string }]`;

    try {
      const aiCall = await modelRouter.call({
        tier: TaskTier.FAST,
        companyId,
        chatbotId: 'copilot',
        systemPrompt: 'You are an elite real estate sales copilot generating high-converting agent replies in strict JSON.',
        userMessage: prompt,
        promptName: 'copilot_suggest_reply',
        promptVersion: 'v13.0',
      });

      const parsed = JSON.parse(aiCall.text) as CopilotSuggestReplyResponse;
      if (parsed.suggestions && Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
        return parsed;
      }
    } catch {
      // Dynamic fallback grounded in real conversation and buyer DNA
    }

    const isPriceQuery = /price|cost|rate|budget|cr|lakh|payment/i.test(lastMsg);
    const isVisitQuery = /visit|tour|walkthrough|weekend|see|saturday|sunday/i.test(lastMsg);

    return {
      suggestions: [
        {
          id: 'sug-1',
          title: isVisitQuery ? 'Confirm Private Walkthrough' : isPriceQuery ? 'Address Price & Payment Plan' : 'Invite for Private Preview',
          text: isPriceQuery
            ? `Hi ${firstName}, regarding the pricing for our ${bhk} residences in ${locality}, prices start at ${budgetStr} with flexible payment milestones. Would you like me to share the detailed payment schedule?`
            : `Hi ${firstName}, I would be delighted to host you for a private walkthrough of our ${bhk} sample residences in ${locality} this Saturday at 11:00 AM or 3:00 PM. Would either timing suit you?`,
          strategy: isPriceQuery ? 'Direct pricing transparency' : 'Proactive visit booking',
        },
        {
          id: 'sug-2',
          title: 'Share Milestone Payment Plan',
          text: `We currently have a flexible 20:80 milestone construction payment schedule for ${bhk} units in ${locality}, which keeps your initial outlay to just 20%. Would you like me to send the breakdown?`,
          strategy: 'Overcome budget hesitation',
        },
        {
          id: 'sug-3',
          title: 'Share Master Brochure & Plans',
          text: `I have the complete architectural floor plans and 45,000 sq ft clubhouse layout ready for ${locality}. Would WhatsApp or email be more convenient for you?`,
          strategy: 'Asset delivery',
        },
      ],
    };
  }

  /**
   * Generates a 1-click executive summary of this lead grounded in chat
   */
  async summariseLead(companyId: string, leadId: string): Promise<CopilotSummaryResponse> {
    const [lead] = await db
      .select({
        id: leads.id,
        contactId: leads.contactId,
        status: leads.status,
        intentScore: leads.intentScore,
        buyerDna: leads.buyerDna,
        contactName: sql<string>`concat(${contacts.firstName}, ' ', coalesce(${contacts.lastName}, ''))`,
      })
      .from(leads)
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .where(and(eq(leads.companyId, companyId), eq(leads.id, leadId)));

    if (!lead) throw new Error('Lead not found');

    const contactName = lead.contactName?.trim() || 'Prospect';
    const dna = (lead.buyerDna as BuyerDna) || {};
    const bhk = dna.bhk?.length ? dna.bhk.join(', ') : '3BHK/4BHK';
    const locality = dna.localities?.length ? dna.localities.join(', ') : 'Prime Bangalore East';
    const budgetStr = dna.budgetMax
      ? `₹${(dna.budgetMax / 10000000).toFixed(2)} Cr`
      : 'Budget not explicitly capped';

    const convCtx = await this.getLeadConversationContext(companyId, leadId, lead.contactId);

    const prompt = `Summarise buyer ${contactName}.
Buyer DNA: ${bhk} residences in ${locality}, budget ${budgetStr}, intent score: ${lead.intentScore}%, channel: ${convCtx.channel}.
Conversation Transcript:
${convCtx.transcript || '(Inquiry captured directly from lead form)'}
Recent Question: "${convCtx.lastVisitorMessage || 'Interested in property options'}"
Return JSON with summary, keyRequirements (array), statedObjections (array), recommendedAction.`;

    try {
      const aiCall = await modelRouter.call({
        tier: TaskTier.FAST,
        companyId,
        chatbotId: 'copilot',
        systemPrompt: 'You produce executive real estate buyer briefs in strict JSON.',
        userMessage: prompt,
        promptName: 'copilot_summary',
        promptVersion: 'v13.0',
      });

      const parsed = JSON.parse(aiCall.text) as Partial<CopilotSummaryResponse>;
      if (parsed.summary) {
        return {
          leadId: lead.id,
          leadName: contactName,
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
      // Dynamic fallback
    }

    const lastQuestion = convCtx.lastVisitorMessage;
    return {
      leadId: lead.id,
      leadName: contactName,
      intentScore: lead.intentScore,
      status: lead.status,
      sentiment: 'positive',
      intentLevel: lead.intentScore >= 70 ? 'high' : lead.intentScore >= 40 ? 'medium' : 'low',
      summary: `${contactName} connected via ${convCtx.channel === 'whatsapp' ? 'WhatsApp' : 'Website Chatbot'}${lastQuestion ? ` asking about "${lastQuestion.slice(0, 45)}"` : ''}. Actively evaluating ${bhk} residences in ${locality} with target budget ${budgetStr}. Stated high purchase interest with ${lead.intentScore}% Intent Score.`,
      keyRequirements: [
        `${bhk} configuration in ${locality}`,
        `Target budget: ${budgetStr}`,
        `Engaged on: ${convCtx.channel === 'whatsapp' ? 'WhatsApp Inbound' : 'Interactive Web Widget'}`,
      ],
      statedObjections: dna.objections?.length ? dna.objections : ['Evaluating construction schedule vs possession dates'],
      recommendedAction: `Call within 5 minutes to follow up on ${lastQuestion ? `"${lastQuestion.slice(0, 30)}"` : `${bhk} in ${locality}`} and reserve priority weekend preview.`,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates a 60-second personalized call script grounded in actual conversation
   */
  async generateCallScript(companyId: string, leadId: string): Promise<CopilotCallScriptResponse> {
    const [lead] = await db
      .select({
        id: leads.id,
        contactId: leads.contactId,
        buyerDna: leads.buyerDna,
        intentScore: leads.intentScore,
        contactName: sql<string>`concat(${contacts.firstName}, ' ', coalesce(${contacts.lastName}, ''))`,
      })
      .from(leads)
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .where(and(eq(leads.companyId, companyId), eq(leads.id, leadId)));

    if (!lead) throw new Error('Lead not found');

    const contactName = lead.contactName?.trim() || 'Prospect';
    const dna = (lead.buyerDna as BuyerDna) || {};
    const firstName = contactName.split(' ')[0] || 'there';
    const bhk = dna.bhk?.length ? dna.bhk.join('/') : '3BHK';
    const locality = dna.localities?.length ? dna.localities[0] : 'prime city locality';
    const budgetStr = dna.budgetMax
      ? `₹${(dna.budgetMax / 10000000).toFixed(2)} Cr`
      : 'target budget';

    const convCtx = await this.getLeadConversationContext(companyId, leadId, lead.contactId);
    const lastQuestion = convCtx.lastVisitorMessage;

    const prompt = `Create cold/warm call script for buyer ${contactName}.
Buyer DNA: ${bhk} residences in ${locality}, budget ${budgetStr}, intent score: ${lead.intentScore}%, channel: ${convCtx.channel}.
Conversation Transcript:
${convCtx.transcript || '(Inquiry captured directly from lead form)'}
Recent Question/Inquiry: "${lastQuestion || 'Interested in floor plans and pricing'}"
Return JSON with callGoal, suggestedOpener, qualifyingQuestions (array), talkingPoints (array), objectionPreemptions (array of {anticipatedObjection, rebuttal}), closingHook.`;

    try {
      const aiCall = await modelRouter.call({
        tier: TaskTier.FAST,
        companyId,
        chatbotId: 'copilot',
        systemPrompt: 'You produce high-converting phone call scripts for real estate sales advisors in strict JSON.',
        userMessage: prompt,
        promptName: 'copilot_call_script',
        promptVersion: 'v13.0',
      });

      const parsed = JSON.parse(aiCall.text) as Partial<CopilotCallScriptResponse>;
      if (parsed.suggestedOpener) {
        return {
          leadId: lead.id,
          leadName: contactName,
          callGoal: parsed.callGoal || `Qualify purchase readiness for ${locality} ${bhk} and schedule private site visit preview.`,
          suggestedOpener: parsed.suggestedOpener,
          qualifyingQuestions: parsed.qualifyingQuestions || [
            `What possession timeline best fits your family relocation plans for ${locality}?`,
            'Are you looking for self-use residence or rental yield investment?',
          ],
          talkingPoints: parsed.talkingPoints || [
            `Exclusive ${bhk} residences in ${locality} with imported fittings and private deck`,
            '45,000 sq ft clubhouse with temperature-controlled indoor swimming pool',
            'Flexible 20:80 milestone construction payment schedule available this month',
          ],
          objectionPreemptions: parsed.objectionPreemptions || [
            {
              anticipatedObjection: 'Price is above my initial target budget',
              rebuttal: 'We have flexible 20:80 milestone schedules where only 20% is required upfront, reducing immediate cash flow pressure.',
            },
          ],
          closingHook: parsed.closingHook || `We have exclusive preview slots open this Saturday at 11:00 AM. May I reserve a priority slot for you, ${firstName}?`,
        };
      }
    } catch {
      // Dynamic fallback grounded in conversation and Buyer DNA
    }

    const opener = lastQuestion
      ? `Hi ${firstName}, this is Rohan from Property Advisors. I saw your recent inquiry regarding "${lastQuestion.slice(0, 45)}" for our ${bhk} residences in ${locality}, and wanted to personally follow up with the exact details.`
      : `Hi ${firstName}, this is Rohan from Property Advisors. I noticed you were exploring our ${bhk} residences in ${locality} with a budget of ${budgetStr}, and wanted to personally share the updated floor plans.`;

    return {
      leadId: lead.id,
      leadName: contactName,
      callGoal: `Qualify purchase readiness for ${locality} ${bhk} (${budgetStr}) and confirm weekend site visit preview.`,
      suggestedOpener: opener,
      qualifyingQuestions: [
        `What possession timeline best fits your family relocation plans for ${locality}?`,
        'Are you looking for self-use residence or rental yield investment?',
        'Have you explored pre-approved home loan rates with our banking partners?',
      ],
      talkingPoints: [
        `Exclusive ${bhk} residences in ${locality} aligned with your budget target (${budgetStr})`,
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
          rebuttal: 'The project is strictly RERA delayed compensation guaranteed with scheduled possession milestones.',
        },
      ],
      closingHook: `We have exclusive designer villa preview slots open this Saturday at 11:00 AM. May I reserve a priority slot for you and your family, ${firstName}?`,
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
