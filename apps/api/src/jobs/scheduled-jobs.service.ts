import { eq, and, sql, lte, isNull, notInArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { leads, agentActions, domainEvents } from '../db/schema/index.js';
import { pino } from 'pino';

export const jobsLogger = pino({
  name: 'scheduled-jobs',
  level: process.env.LOG_LEVEL ?? 'info',
});

export class ScheduledJobsService {
  /**
   * Nightly Intent Decay:
   * Re-scores open leads that have been idle, decaying their score by 5 points
   * per week of inactivity, updating their priority and intent label.
   */
  async decayIdleLeadScores(): Promise<{ decayedCount: number }> {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);

    const idleLeads = await db
      .select({
        id: leads.id,
        companyId: leads.companyId,
        intentScore: leads.intentScore,
        scoreHistory: leads.scoreHistory,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .where(
        and(
          isNull(leads.deletedAt),
          notInArray(leads.status, ['converted', 'lost', 'booked']),
          lte(leads.updatedAt, threeDaysAgo),
          sql`${leads.intentScore} > 0`,
        ),
      )
      .limit(200);

    let decayedCount = 0;

    for (const lead of idleLeads) {
      const daysIdle = Math.floor((Date.now() - new Date(lead.updatedAt).getTime()) / 86400000);
      const decayPoints = Math.min(lead.intentScore, Math.max(2, Math.floor(daysIdle / 3) * 2));
      const newScore = Math.max(0, lead.intentScore - decayPoints);

      if (newScore !== lead.intentScore) {
        const newLabel = newScore >= 70 ? 'hot' : newScore >= 35 ? 'warm' : 'cold';
        const currentHistory = Array.isArray(lead.scoreHistory) ? lead.scoreHistory : [];
        const newHistory = [
          ...currentHistory,
          {
            score: newScore,
            delta: -decayPoints,
            reason: `Nightly decay: idle for ${daysIdle} days without interaction`,
            timestamp: new Date().toISOString(),
          },
        ];

        await db.transaction(async (tx) => {
          await tx
            .update(leads)
            .set({
              intentScore: newScore,
              intentLabel: newLabel,
              scoreHistory: newHistory,
              updatedAt: new Date(),
            })
            .where(eq(leads.id, lead.id));

          await tx.insert(domainEvents).values({
            companyId: lead.companyId,
            type: 'intent_changed',
            payload: {
              lead_id: lead.id,
              previous_score: lead.intentScore,
              new_score: newScore,
              reasons: [`Nightly decay: ${daysIdle} days idle`],
            },
          });
        });

        decayedCount++;
      }
    }

    if (decayedCount > 0) {
      jobsLogger.info({ decayedCount }, 'Nightly intent score decay sweep completed');
    }

    return { decayedCount };
  }

  /**
   * Stale Approval Expiry:
   * Marks proposed T2 actions as 'expired' once their expiration time passes.
   */
  async expireStaleApprovals(): Promise<{ expiredCount: number }> {
    const now = new Date();

    const staleActions = await db
      .select({ id: agentActions.id, companyId: agentActions.companyId })
      .from(agentActions)
      .where(
        and(
          eq(agentActions.status, 'proposed'),
          lte(agentActions.expiresAt, now),
        ),
      );

    if (staleActions.length === 0) {
      return { expiredCount: 0 };
    }

    for (const action of staleActions) {
      await db
        .update(agentActions)
        .set({
          status: 'expired',
          updatedAt: new Date(),
        })
        .where(eq(agentActions.id, action.id));
    }

    jobsLogger.info({ expiredCount: staleActions.length }, 'Expired stale proposed T2 approvals');
    return { expiredCount: staleActions.length };
  }

  /**
   * Retention & Cleanup:
   * Purges old dead events and processed domain events beyond 30 days.
   */
  async cleanupOldEvents(): Promise<{ purgedCount: number }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const deleted = await db
      .delete(domainEvents)
      .where(
        and(
          sql`${domainEvents.processedAt} IS NOT NULL`,
          lte(domainEvents.createdAt, thirtyDaysAgo),
        ),
      )
      .returning({ id: domainEvents.id });

    return { purgedCount: deleted.length };
  }
}

export const scheduledJobsService = new ScheduledJobsService();
