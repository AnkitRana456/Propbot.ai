import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  dailyAnalyticsRollups,
  conversations,
  messages,
  leads,
  appointments,
  chatbots,
} from '../../db/schema/index.js';

export class RollupService {
  /**
   * Generates or refreshes daily rollup metrics for a company on a given date.
   */
  async rollupDayForCompany(companyId: string, targetDateStr: string): Promise<void> {
    const startOfDay = new Date(`${targetDateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDateStr}T23:59:59.999Z`);

    // Fetch active chatbots for company (plus null for company-wide overall)
    const bots = await db
      .select({ id: chatbots.id })
      .from(chatbots)
      .where(and(eq(chatbots.companyId, companyId), isNull(chatbots.deletedAt)));

    const botIds: Array<string | null> = [null, ...bots.map(b => b.id)];

    for (const botId of botIds) {
      // 1. Conversations & Messages counts
      const convFilter = [
        eq(conversations.companyId, companyId),
        gte(conversations.createdAt, startOfDay),
        lte(conversations.createdAt, endOfDay),
      ];
      if (botId) convFilter.push(eq(conversations.chatbotId, botId));

      const [convStats] = await db
        .select({
          totalConv: sql<number>`count(*)::int`,
        })
        .from(conversations)
        .where(and(...convFilter));

      // 2. Messages stats (latency, tokens, sentiment)
      const msgFilter = [
        eq(messages.companyId, companyId),
        gte(messages.createdAt, startOfDay),
        lte(messages.createdAt, endOfDay),
      ];

      const [msgStats] = await db
        .select({
          totalMsg: sql<number>`count(*)::int`,
          avgLatency: sql<number>`coalesce(avg(${messages.latencyMs}), 0)::int`,
          tokens: sql<number>`coalesce(sum(${messages.tokensUsed}), 0)::int`,
          posCount: sql<number>`count(case when ${messages.sentiment} = 'positive' then 1 end)::int`,
          negCount: sql<number>`count(case when ${messages.sentiment} = 'negative' then 1 end)::int`,
        })
        .from(messages)
        .where(and(...msgFilter));

      // 3. Leads stats
      const leadFilter = [
        eq(leads.companyId, companyId),
        gte(leads.createdAt, startOfDay),
        lte(leads.createdAt, endOfDay),
        isNull(leads.deletedAt),
      ];
      if (botId) leadFilter.push(eq(leads.chatbotId, botId));

      const [leadStats] = await db
        .select({
          totalLeads: sql<number>`count(*)::int`,
          qualifiedLeads: sql<number>`count(case when ${leads.status} in ('qualified', 'site_visit_scheduled', 'site_visit_done', 'negotiation', 'booked') then 1 end)::int`,
          dealsBooked: sql<number>`count(case when ${leads.status} = 'booked' then 1 end)::int`,
        })
        .from(leads)
        .where(and(...leadFilter));

      // 4. Appointments (visits booked & visits done)
      const apptFilter = [
        eq(appointments.companyId, companyId),
        gte(appointments.scheduledAt, startOfDay),
        lte(appointments.scheduledAt, endOfDay),
      ];

      const [apptStats] = await db
        .select({
          visitsBooked: sql<number>`count(*)::int`,
          visitsDone: sql<number>`count(case when ${appointments.status} = 'completed' then 1 end)::int`,
        })
        .from(appointments)
        .where(and(...apptFilter));

      // Upsert into daily_analytics_rollups
      await db
        .insert(dailyAnalyticsRollups)
        .values({
          companyId,
          chatbotId: botId,
          date: targetDateStr,
          totalConversations: convStats?.totalConv ?? 0,
          totalMessages: msgStats?.totalMsg ?? 0,
          totalLeads: leadStats?.totalLeads ?? 0,
          qualifiedLeads: leadStats?.qualifiedLeads ?? 0,
          visitsBooked: apptStats?.visitsBooked ?? 0,
          visitsDone: apptStats?.visitsDone ?? 0,
          dealsBooked: leadStats?.dealsBooked ?? 0,
          avgLatencyMs: msgStats?.avgLatency ?? 0,
          tokensUsed: msgStats?.tokens ?? 0,
          positiveSentimentCount: msgStats?.posCount ?? 0,
          negativeSentimentCount: msgStats?.negCount ?? 0,
          metricsJson: {},
        })
        .onConflictDoUpdate({
          target: [
            dailyAnalyticsRollups.companyId,
            dailyAnalyticsRollups.chatbotId,
            dailyAnalyticsRollups.date,
          ],
          set: {
            totalConversations: convStats?.totalConv ?? 0,
            totalMessages: msgStats?.totalMsg ?? 0,
            totalLeads: leadStats?.totalLeads ?? 0,
            qualifiedLeads: leadStats?.qualifiedLeads ?? 0,
            visitsBooked: apptStats?.visitsBooked ?? 0,
            visitsDone: apptStats?.visitsDone ?? 0,
            dealsBooked: leadStats?.dealsBooked ?? 0,
            avgLatencyMs: msgStats?.avgLatency ?? 0,
            tokensUsed: msgStats?.tokens ?? 0,
            positiveSentimentCount: msgStats?.posCount ?? 0,
            negativeSentimentCount: msgStats?.negCount ?? 0,
            updatedAt: new Date(),
          },
        });
    }
  }
}

export const rollupService = new RollupService();
