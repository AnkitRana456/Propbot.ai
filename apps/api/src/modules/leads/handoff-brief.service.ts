import type { BuyerDna, HandoffBrief } from '@propbot/shared';
import { db } from '../../db/index.js';
import { notifications, domainEvents, leads, projects } from '../../db/schema/index.js';
import { modelRouter, TaskTier } from '../ai/router.js';
import { eq, and, isNull } from 'drizzle-orm';

export interface GenerateBriefParams {
  companyId: string;
  chatbotId: string;
  leadId: string;
  leadName: string;
  intentScore: number;
  buyerDna: BuyerDna;
  assignedAgentId?: string | null;
}

export class HandoffBriefService {
  /**
   * Generates an AI-written executive handoff brief when a lead becomes hot.
   */
  async generateBrief(params: GenerateBriefParams): Promise<HandoffBrief> {
    const { companyId, chatbotId, leadId, leadName, intentScore, buyerDna, assignedAgentId } =
      params;

    // 1. Fetch company project inventory for property recommendations
    const availableProjects = await db
      .select({ id: projects.id, name: projects.name, location: projects.location })
      .from(projects)
      .where(and(eq(projects.companyId, companyId), isNull(projects.deletedAt)))
      .limit(3);

    const matchingProperties =
      availableProjects.length > 0
        ? availableProjects.map(p => p.name)
        : ['Prestige Sanctuary Luxury Villas', 'Prestige Elm Park 3BHK/4BHK'];

    // Format DNA summary string
    const budgetStr =
      buyerDna.budgetMin && buyerDna.budgetMax
        ? `₹${(buyerDna.budgetMin / 10000000).toFixed(2)} - ₹${(buyerDna.budgetMax / 10000000).toFixed(2)} Cr`
        : buyerDna.budgetMax
          ? `Up to ₹${(buyerDna.budgetMax / 10000000).toFixed(2)} Cr`
          : 'Budget not explicitly capped';

    const bhkStr = buyerDna.bhk.length > 0 ? buyerDna.bhk.join(', ') : '3BHK/4BHK';
    const locStr =
      buyerDna.localities.length > 0 ? buyerDna.localities.join(', ') : 'Prime Bangalore East';
    const purposeStr = buyerDna.purpose ? `for ${buyerDna.purpose}` : 'for primary residence';
    const dnaSummary = `${bhkStr} ${buyerDna.propertyType ?? 'residence'} in ${locStr} (${budgetStr}, ${purposeStr})`;

    let summary = `High-intent prospect (${intentScore}% score) actively evaluating ${bhkStr} residences in ${locStr}. Stated purchase readiness with budget ${budgetStr}. Pre-qualified via conversational chat assistance.`;
    let suggestedOpener = `Hi ${leadName.split(' ')[0] || 'there'}, I noticed you're exploring our luxury ${bhkStr} residences at ${matchingProperties[0]}. Would you have 5 minutes for a quick conversation or like to schedule a private site preview this weekend?`;
    let nextBestAction = 'Call within 5 minutes to confirm private weekend site visit preview.';

    // Try generating refined copy via STRONG model tier if available
    try {
      const prompt = `You are a luxury real estate sales director. Write an instant hot-lead handoff brief for an agent.
Prospect Name: ${leadName}
Intent Score: ${intentScore}/100
Buyer DNA: ${JSON.stringify(buyerDna)}
Matching Properties: ${matchingProperties.join(', ')}

Return valid JSON with:
summary: (A concise 3-line executive overview of this buyer's status and purchase readiness),
suggestedOpeningLine: (A natural, personalized phone opening line for the agent),
nextBestAction: (One clear imperative action, e.g. "Call within 5 minutes to confirm site visit")`;

      const aiResponse = await modelRouter.call({
        tier: TaskTier.STRONG,
        companyId,
        chatbotId,
        systemPrompt: 'You produce high-converting real estate agent handoff briefs in strict JSON.',
        userMessage: prompt,
        maxTokens: 350,
        temperature: 0.3,
      });

      if (aiResponse.provider !== 'fallback_offline') {
        const parsed = JSON.parse(aiResponse.text);
        if (parsed.summary) summary = parsed.summary;
        if (parsed.suggestedOpeningLine) suggestedOpener = parsed.suggestedOpeningLine;
        if (parsed.nextBestAction) nextBestAction = parsed.nextBestAction;
      }
    } catch {
      // Fallback deterministic brief remains active
    }

    const objectionsAndCompetitors = [
      ...buyerDna.objections,
      ...buyerDna.competitorsMentioned.map(c => `Evaluating competitor: ${c}`),
    ];

    const brief: HandoffBrief = {
      summary,
      buyerDnaSummary: dnaSummary,
      objectionsAndCompetitors,
      matchingProperties,
      suggestedOpeningLine: suggestedOpener,
      nextBestAction,
      generatedAt: new Date().toISOString(),
    };

    // 2. Persist brief and start speed-to-lead SLA timer on lead
    await db
      .update(leads)
      .set({
        handoffBrief: brief,
        slaStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    // 3. Create Notification for assigned agent or admin
    if (assignedAgentId) {
      await db.insert(notifications).values({
        companyId,
        userId: assignedAgentId,
        type: 'hot_lead',
        title: `🔥 Hot Lead Alert: ${leadName} (${intentScore}%)`,
        message: `${leadName} crossed ${intentScore}% buying intent. Action: ${nextBestAction}`,
        linkUrl: `/leads?id=${leadId}`,
        metadata: { leadId, intentScore },
      });
    }

    // 4. Record lead_hot event in domain_events outbox
    await db.insert(domainEvents).values({
      companyId,
      type: 'lead_hot',
      payload: {
        lead_id: leadId,
        intent_score: intentScore,
        summary,
        suggested_opener: suggestedOpener,
      },
    });

    return brief;
  }
}

export const handoffBriefService = new HandoffBriefService();
