import { and, asc, desc, eq, sql } from 'drizzle-orm';
import {
  INTENT_TAXONOMY,
  type ConversationInsightItem,
  type CreateSurveyInput,
  type RecordSurveyResponseInput,
  type SurveyItem,
  type SurveyStats,
} from '@propbot/shared';
import { db } from '../../db/index.js';
import { conversationInsights, conversations, messages, surveyResponses, surveys } from '../../db/schema/index.js';
import { badRequest, notFound } from '../../utils/api-error.js';
import { heuristicSentiment } from '../ai/llm.js';
import { modelRouter, TaskTier } from '../ai/router.js';
import { tagsService } from './tags-groups.service.js';

// ---------------------------------------------------------------- insights
const INTENT_PATTERNS: Array<[(typeof INTENT_TAXONOMY)[number], RegExp]> = [
  ['complaint', /\b(complaint|refund|cheated|worst|not happy|delay(ed)? possession|escalat\w*)\b/i],
  ['loan', /\b(loan|emi|bank|finance|home ?loan|down ?payment|interest rate)\b/i],
  ['site_visit', /\b(site visit|visit|see the (site|flat|unit)|schedule|appointment|come over)\b/i],
  ['resale', /\b(resale|re-?sale|second hand|ready to move)\b/i],
  ['rental', /\b(rent|rental|lease|tenant)\b/i],
  ['broker', /\b(broker|channel partner|commission|dealer|i am an? agent)\b/i],
  ['price_enquiry', /\b(price|cost|rate|how much|budget|per sq|pricing|quote)\b/i],
];
const POSITIVE = /\b(great|thanks|thank you|perfect|interested|sounds good|love|awesome)\b/i;

export function classify(visitorText: string): { intent: string; labels: string[]; sentiment: 'positive' | 'neutral' | 'negative'; score: number } {
  const labels = INTENT_PATTERNS.filter(([, re]) => re.test(visitorText)).map(([k]) => k);
  const frustrated = heuristicSentiment(visitorText) === 'frustrated' || labels.includes('complaint');
  const positive = !frustrated && POSITIVE.test(visitorText);
  return { intent: labels[0] ?? 'other', labels: labels.length ? labels : ['other'], sentiment: frustrated ? 'negative' : positive ? 'positive' : 'neutral', score: frustrated ? -0.7 : positive ? 0.6 : 0 };
}

const toInsight = (r: typeof conversationInsights.$inferSelect): ConversationInsightItem => ({
  conversationId: r.conversationId,
  summary: r.summary,
  intent: r.intent,
  labels: r.labels,
  sentiment: r.sentiment as ConversationInsightItem['sentiment'],
  sentimentScore: r.sentimentScore === null ? null : Number(r.sentimentScore),
  model: r.model,
  generatedAt: r.generatedAt.toISOString(),
});

class InsightsService {
  async get(companyId: string, conversationId: string): Promise<ConversationInsightItem | null> {
    const [r] = await db.select().from(conversationInsights).where(and(eq(conversationInsights.conversationId, conversationId), eq(conversationInsights.companyId, companyId)));
    return r ? toInsight(r) : null;
  }

  /** Summarises, labels and scores a conversation. Rule-based classification always runs; the model only writes the summary. */
  async generate(companyId: string, conversationId: string): Promise<ConversationInsightItem> {
    const [conv] = await db.select({ id: conversations.id }).from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.companyId, companyId)));
    if (!conv) throw notFound('Conversation');
    const msgs = await db
      .select({ senderType: messages.senderType, content: messages.content })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.companyId, companyId)))
      .orderBy(asc(messages.createdAt))
      .limit(60);
    const visitor = msgs.filter(m => m.senderType === 'visitor').map(m => m.content).join('\n');
    if (!visitor.trim()) throw badRequest('INSIGHT_EMPTY', 'This conversation has no visitor messages to analyse.');

    const c = classify(visitor);
    let summary = `Visitor asked about ${c.labels.map(l => l.replace(/_/g, ' ')).join(', ')} over ${msgs.length} messages.`;
    let model: string | null = 'rules';
    if (modelRouter.isConfigured()) {
      try {
        const res = await modelRouter.executeCompletion({
          tier: TaskTier.FAST,
          companyId,
          chatbotId: '',
          trace: { conversationId, purpose: 'summary' },
          systemPrompt: 'Summarise this real-estate sales chat in two short sentences for a sales manager: what the buyer wants (budget, BHK, location, timeline) and the next best step. No greetings.',
          userMessage: msgs.map(m => `${m.senderType}: ${m.content}`).join('\n').slice(-6000),
          temperature: 0.2,
          maxTokens: 160,
          promptName: 'conversation_summary',
        });
        if (res.text.trim()) {
          summary = res.text.trim();
          model = res.model;
        }
      } catch {
        /* keep the rule-based summary */
      }
    }

    const values = { companyId, conversationId, summary, intent: c.intent, labels: c.labels, sentiment: c.sentiment, sentimentScore: c.score.toFixed(3), model, generatedAt: new Date() };
    const [row] = await db
      .insert(conversationInsights)
      .values(values)
      .onConflictDoUpdate({ target: conversationInsights.conversationId, set: values })
      .returning();
    await tagsService.autoTag(companyId, conversationId, c.labels);
    return toInsight(row!);
  }
}

// ---------------------------------------------------------------- surveys
class SurveysService {
  private async mustGet(companyId: string, id: string) {
    const [s] = await db.select().from(surveys).where(and(eq(surveys.id, id), eq(surveys.companyId, companyId)));
    if (!s) throw notFound('Survey');
    return s;
  }

  async list(companyId: string): Promise<SurveyItem[]> {
    const rows = await db.select().from(surveys).where(eq(surveys.companyId, companyId)).orderBy(desc(surveys.createdAt));
    const counts = await db.select({ id: surveyResponses.surveyId, n: sql<number>`count(*)::int` }).from(surveyResponses).where(eq(surveyResponses.companyId, companyId)).groupBy(surveyResponses.surveyId);
    return rows.map(s => ({ id: s.id, name: s.name, kind: s.kind as SurveyItem['kind'], formId: s.formId, trigger: s.trigger as SurveyItem['trigger'], channel: s.channel, isActive: s.isActive, responseCount: counts.find(c => c.id === s.id)?.n ?? 0 }));
  }

  async create(companyId: string, input: CreateSurveyInput): Promise<SurveyItem> {
    const [s] = await db.insert(surveys).values({ companyId, name: input.name, kind: input.kind, formId: input.formId ?? null, trigger: input.trigger, channel: input.channel }).returning();
    return { id: s!.id, name: s!.name, kind: s!.kind as SurveyItem['kind'], formId: s!.formId, trigger: s!.trigger as SurveyItem['trigger'], channel: s!.channel, isActive: s!.isActive, responseCount: 0 };
  }

  async update(companyId: string, id: string, input: Partial<CreateSurveyInput> & { isActive?: boolean }): Promise<void> {
    await this.mustGet(companyId, id);
    await db.update(surveys).set({ ...input, updatedAt: new Date() }).where(eq(surveys.id, id));
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.mustGet(companyId, id);
    await db.delete(surveys).where(eq(surveys.id, id));
  }

  /** Stores an answer. Without a score, one is estimated from the conversation's sentiment and flagged as estimated. */
  async record(companyId: string, id: string, input: RecordSurveyResponseInput) {
    const survey = await this.mustGet(companyId, id);
    let score = input.score;
    let estimated = false;
    if (score === undefined) {
      if (survey.kind === 'custom' || !input.conversationId) throw badRequest('SURVEY_SCORE_REQUIRED', 'A score is required (or a conversation to estimate it from).');
      const insight = (await insightsService.get(companyId, input.conversationId)) ?? (await insightsService.generate(companyId, input.conversationId));
      const s = insight.sentiment ?? 'neutral';
      score = survey.kind === 'nps' ? (s === 'positive' ? 9 : s === 'negative' ? 3 : 7) : s === 'positive' ? 5 : s === 'negative' ? 1 : 3;
      estimated = true;
    }
    if (survey.kind === 'csat' && (score < 1 || score > 5)) throw badRequest('SURVEY_SCORE_RANGE', 'CSAT scores are 1 to 5.');
    if (survey.kind === 'nps' && (score < 0 || score > 10)) throw badRequest('SURVEY_SCORE_RANGE', 'NPS scores are 0 to 10.');
    const [r] = await db
      .insert(surveyResponses)
      .values({ companyId, surveyId: id, leadId: input.leadId ?? null, conversationId: input.conversationId ?? null, appointmentId: input.appointmentId ?? null, score, isEstimated: estimated, answers: input.answers })
      .returning();
    return { id: r!.id, score, estimated };
  }

  async stats(companyId: string, id: string): Promise<SurveyStats> {
    const survey = await this.mustGet(companyId, id);
    const rows = await db.select({ score: surveyResponses.score, est: surveyResponses.isEstimated }).from(surveyResponses).where(and(eq(surveyResponses.surveyId, id), eq(surveyResponses.companyId, companyId)));
    const scored = rows.filter(r => r.score !== null) as Array<{ score: number; est: boolean }>;
    const distribution: Record<string, number> = {};
    for (const r of scored) distribution[String(r.score)] = (distribution[String(r.score)] ?? 0) + 1;
    const base = { kind: survey.kind, responses: rows.length, estimated: rows.filter(r => r.est).length, distribution };
    if (scored.length === 0) return { ...base, score: null };
    if (survey.kind === 'nps') {
      const promoters = scored.filter(r => r.score >= 9).length;
      const detractors = scored.filter(r => r.score <= 6).length;
      return { ...base, score: Math.round(((promoters - detractors) / scored.length) * 100), promoters, passives: scored.length - promoters - detractors, detractors };
    }
    return { ...base, score: Math.round((scored.reduce((a, r) => a + r.score, 0) / scored.length) * 100) / 100 };
  }
}

export const insightsService = new InsightsService();
export const surveysService = new SurveysService();
