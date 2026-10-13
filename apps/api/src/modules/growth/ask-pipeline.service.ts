import { eq, and, sql, desc, gte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { leads, contacts, appointments } from '../../db/schema/index.js';
import type { AskPipelineResponse, LeadCitation } from '@propbot/shared';
import { pino } from 'pino';

const logger = pino({ name: 'ask-pipeline', level: process.env.LOG_LEVEL ?? 'info' });

export class AskPipelineService {
  /**
   * Fixed query tool 1: list_leads
   * Runs parameterized query strictly isolated by companyId under RLS.
   */
  async toolListLeads(
    companyId: string,
    options: {
      status?: string;
      intentLabel?: string;
      notCalledToday?: boolean;
      minBudget?: number;
      limit?: number;
    } = {},
  ): Promise<LeadCitation[]> {
    const conditions = [
      eq(leads.companyId, companyId),
      sql`${leads.deletedAt} IS NULL`,
    ];

    if (options.status) {
      conditions.push(eq(leads.status, options.status));
    }

    if (options.intentLabel) {
      conditions.push(eq(leads.intentLabel, options.intentLabel));
    }

    if (options.notCalledToday) {
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      conditions.push(sql`(${leads.updatedAt} IS NULL OR ${leads.updatedAt} < ${todayMidnight.toISOString()}::timestamptz)`);
    }

    if (options.minBudget) {
      conditions.push(
        sql`coalesce((${leads.buyerDna}->>'budgetMax')::numeric, (${leads.buyerDna}->>'budgetMin')::numeric, 0) >= ${options.minBudget}`,
      );
    }

    const rows = await db
      .select({
        id: leads.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        phone: contacts.phone,
        email: contacts.email,
        intentScore: leads.intentScore,
        intentLabel: leads.intentLabel,
        status: leads.status,
        lastContactedAt: leads.updatedAt,
      })
      .from(leads)
      .innerJoin(contacts, eq(leads.contactId, contacts.id))
      .where(and(...conditions))
      .orderBy(desc(leads.intentScore))
      .limit(options.limit || 10);

    return rows.map(r => ({
      id: r.id,
      name: `${r.firstName} ${r.lastName || ''}`.trim(),
      phone: r.phone,
      email: r.email || undefined,
      intentScore: r.intentScore,
      intentLabel: r.intentLabel,
      status: r.status,
      stage: r.status,
      score: r.intentScore,
      lastContactedAt: r.lastContactedAt ? r.lastContactedAt.toISOString() : null,
    }));
  }

  /**
   * Fixed query tool 2: lead_stats
   */
  async toolLeadStats(companyId: string, groupBy = 'intent') {
    const conditions = [eq(leads.companyId, companyId), sql`${leads.deletedAt} IS NULL`];

    if (groupBy === 'status') {
      return await db
        .select({
          key: leads.status,
          count: sql<number>`count(*)::int`,
        })
        .from(leads)
        .where(and(...conditions))
        .groupBy(leads.status);
    }

    return await db
      .select({
        key: leads.intentLabel,
        count: sql<number>`count(*)::int`,
        avgScore: sql<number>`round(avg(${leads.intentScore}), 1)::float`,
      })
      .from(leads)
      .where(and(...conditions))
      .groupBy(leads.intentLabel);
  }

  /**
   * Fixed query tool 3: visits_summary
   */
  async toolVisitsSummary(companyId: string) {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    return await db
      .select({
        status: appointments.status,
        count: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .where(and(eq(appointments.companyId, companyId), gte(appointments.scheduledAt, todayMidnight)))
      .groupBy(appointments.status);
  }

  /**
   * Fixed query tool 4: source_performance
   */
  async toolSourcePerformance(companyId: string) {
    return await db
      .select({
        source: leads.source,
        totalLeads: sql<number>`count(*)::int`,
        hotLeads: sql<number>`count(case when ${leads.intentLabel} = 'hot' then 1 end)::int`,
      })
      .from(leads)
      .where(and(eq(leads.companyId, companyId), sql`${leads.deletedAt} IS NULL`))
      .groupBy(leads.source)
      .orderBy(sql`count(*) DESC`)
      .limit(5);
  }

  /**
   * Answers user's natural language question by routing to fixed parameterized query tools.
   * Defends against model-written SQL and adversarial cross-tenant injections.
   */
  async askPipeline(companyId: string, question: string): Promise<AskPipelineResponse> {
    const qLower = question.toLowerCase().trim();

    // Adversarial security check: Block prompts trying to extract other tenants or execute raw SQL
    if (/select\s|insert\s|update\s|delete\s|drop\s|union\s|--|company_id\s*=/i.test(question)) {
      logger.warn({ companyId, question }, 'Adversarial SQL injection attempt rejected');
      return {
        answer: 'Direct SQL execution is strictly disabled. I can only answer CRM pipeline questions using verified tools.',
        toolUsed: 'security_guardrail',
        citations: [],
      };
    }

    // 0. Conversational Greeting
    if (
      /^(hi|hello|hey|namaste|greetings|good\s*(morning|afternoon|evening))\b/i.test(qLower) ||
      qLower === 'hi' ||
      qLower === 'hello' ||
      qLower === 'hey'
    ) {
      const citations = await this.toolListLeads(companyId, { limit: 5 });
      return {
        answer:
          'Hello! I am your AI Pipeline Assistant. Ask me anything about your active leads, conversion statistics, site visit bookings, or marketing source performance.',
        toolUsed: 'greeting',
        citations,
      };
    }

    // 1. Hot leads / not called today
    if (qLower.includes('hot') || qLower.includes('highest intent') || qLower.includes('top lead')) {
      const notCalledOnly =
        qLower.includes('not been called') ||
        qLower.includes('not called') ||
        qLower.includes('uncalled') ||
        (qLower.includes('today') && (qLower.includes('contact') || qLower.includes('call')));

      const citations = await this.toolListLeads(companyId, {
        intentLabel: 'hot',
        notCalledToday: notCalledOnly,
        limit: 10,
      });

      const count = citations.length;
      let answer: string;
      if (notCalledOnly) {
        answer = count > 0
          ? `Found ${count} hot lead${count > 1 ? 's' : ''} who haven't been contacted today. Reaching out quickly while their interest is peaked yields the highest site visit conversion.`
          : 'All hot leads have already been called today, or there are no pending hot leads in your pipeline.';
      } else {
        answer = count > 0
          ? `Here are your top ${count} hottest leads with high purchase intent scores:`
          : 'No hot leads found in your pipeline yet. As prospects engage with your AI agents and campaigns, their scores will update automatically.';
      }

      return {
        answer,
        toolUsed: 'list_leads',
        citations,
      };
    }

    // 2. Budget queries e.g. "Show leads with budget above 1 Cr"
    if (qLower.includes('budget') || qLower.includes('1 cr') || qLower.includes('1cr') || qLower.includes('crore')) {
      const minBudget = (qLower.includes('1 cr') || qLower.includes('1cr') || qLower.includes('crore')) ? 10000000 : undefined;
      const citations = await this.toolListLeads(companyId, { minBudget, limit: 10 });
      const answer = citations.length > 0
        ? `Found ${citations.length} high-ticket lead${citations.length > 1 ? 's' : ''} matching your budget criteria.`
        : 'No leads found matching this specific budget filter. Check the Leads table for unassigned prospects.';

      return {
        answer,
        toolUsed: 'list_leads',
        citations,
      };
    }

    // 3. Lead stats / distribution
    if (qLower.includes('stats') || qLower.includes('how many leads') || qLower.includes('breakdown') || qLower.includes('summary')) {
      const stats = await this.toolLeadStats(companyId, qLower.includes('status') ? 'status' : 'intent');
      const citations = await this.toolListLeads(companyId, { limit: 5 });

      const answer = stats.length > 0
        ? `Here is your current pipeline distribution:\n${stats.map(s => `• ${s.key.toUpperCase()}: ${s.count} leads`).join('\n')}`
        : 'No active leads found in the pipeline distribution.';

      return {
        answer,
        toolUsed: 'lead_stats',
        citations,
      };
    }

    // 4. Source performance
    if (qLower.includes('source') || qLower.includes('channel') || qLower.includes('campaign') || qLower.includes('traffic')) {
      const sources = await this.toolSourcePerformance(companyId);
      const answer = sources.length > 0
        ? `Top lead acquisition sources:\n${sources.map(s => `• ${s.source}: ${s.totalLeads} leads (${s.hotLeads} hot)`).join('\n')}`
        : 'No marketing source traffic recorded yet for your workspace.';

      return {
        answer,
        toolUsed: 'source_performance',
        citations: [],
      };
    }

    // 5. Site visits summary
    if (qLower.includes('visit') || qLower.includes('appointment') || qLower.includes('walkthrough')) {
      const visits = await this.toolVisitsSummary(companyId);
      const answer = visits.length > 0
        ? `Site visits scheduled:\n${visits.map(v => `• ${v.status}: ${v.count}`).join('\n')}`
        : 'No upcoming site visits scheduled for today.';

      return {
        answer,
        toolUsed: 'visits_summary',
        citations: [],
      };
    }

    // Default fallback: List recent hot or qualified leads
    const citations = await this.toolListLeads(companyId, { limit: 5 });
    return {
      answer: `Found ${citations.length} key leads in your pipeline based on recent activity.`,
      toolUsed: 'list_leads',
      citations,
    };
  }
}

export const askPipelineService = new AskPipelineService();
