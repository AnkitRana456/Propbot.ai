import { eq, and, sql, lte, isNull, notInArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { leads, agentActions, domainEvents, integrations } from '../db/schema/index.js';
import { pino } from 'pino';
import { otpService } from '../modules/leads/otp.service.js';

export const jobsLogger = pino({
  name: 'scheduled-jobs',
  level: process.env.LOG_LEVEL ?? 'info',
});

export const ARCHIVE_STUB_MESSAGE = 'This conversation history was archived to save storage space.';

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
   * 30-day chat retention (spec section 8).
   *  1. Anonymous empty/bounced chats (no lead, no contact, 0-1 messages) older than 30 days are deleted.
   *  2. Every other conversation older than 30 days keeps its row, timestamps and lead/contact links, but its
   *     messages are replaced by a single archive stub. Idempotent: archived chats carry metadata.archivedAt.
   * "Older" means no activity for 30 days (last message, else creation time).
   */
  async archiveOldChats(
    now: Date = new Date(),
    batchSize = 200,
    companyId?: string,
  ): Promise<{ archived: number; deleted: number }> {
    const cutoff = new Date(now.getTime() - 30 * 86400000);
    const lastActivity = sql`COALESCE((SELECT max(m.created_at) FROM messages m WHERE m.conversation_id = c.id), c.created_at)`;
    const rowsOf = (res: unknown) =>
      (Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])) as Array<{ id: string; company_id: string }>;

    let deleted = 0;
    for (;;) {
      const res = await db.execute(sql`
        DELETE FROM conversations c
         WHERE c.id IN (
           SELECT c2.id FROM conversations c2
            WHERE c2.lead_id IS NULL AND c2.contact_id IS NULL
              AND (${companyId ?? null}::uuid IS NULL OR c2.company_id = ${companyId ?? null}::uuid)
              AND (SELECT count(*) FROM messages m WHERE m.conversation_id = c2.id) <= 1
              AND COALESCE((SELECT max(m.created_at) FROM messages m WHERE m.conversation_id = c2.id), c2.created_at) < ${cutoff.toISOString()}::timestamptz
            LIMIT ${batchSize})
        RETURNING c.id`);
      const n = rowsOf(res).length;
      deleted += n;
      if (n < batchSize) break;
    }

    let archived = 0;
    for (;;) {
      const batch = rowsOf(
        await db.execute(sql`
          SELECT c.id, c.company_id FROM conversations c
           WHERE (c.metadata->>'archivedAt') IS NULL
             AND (${companyId ?? null}::uuid IS NULL OR c.company_id = ${companyId ?? null}::uuid)
             AND ${lastActivity} < ${cutoff.toISOString()}::timestamptz
           ORDER BY c.created_at ASC
           LIMIT ${batchSize}`),
      );
      if (batch.length === 0) break;

      await db.transaction(async tx => {
        for (const conv of batch) {
          await tx.execute(sql`DELETE FROM messages WHERE conversation_id = ${conv.id}::uuid`);
          await tx.execute(sql`
            INSERT INTO messages (company_id, conversation_id, sender_type, content, metadata)
            VALUES (${conv.company_id}::uuid, ${conv.id}::uuid, 'system', ${ARCHIVE_STUB_MESSAGE},
                    ${JSON.stringify({ archived: true })}::jsonb)`);
          await tx.execute(sql`
            UPDATE conversations
               SET metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ archivedAt: now.toISOString() })}::jsonb
             WHERE id = ${conv.id}::uuid`);
        }
      });
      archived += batch.length;
      if (batch.length < batchSize) break;
    }

    if (archived > 0 || deleted > 0) {
      jobsLogger.info({ archived, deleted }, '30-day chat retention run completed');
    }
    return { archived, deleted };
  }

  /** Postgres has no TTL index: expired OTP challenges are purged here (also rejected on read). */
  async purgeExpiredOtps(): Promise<{ purgedCount: number }> {
    return { purgedCount: await otpService.purgeExpired() };
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

  /**
   * Token Health & Refresh Monitoring:
   * Inspects configured integrations to ensure OAuth tokens or API credentials
   * remain valid, warning administrators if tokens are near expiration (< 24h).
   */
  async checkThirdPartyTokenHealth(): Promise<{ checkedCount: number; expiringCount: number }> {
    const activeIntegrations = await db
      .select({
        id: integrations.id,
        companyId: integrations.companyId,
        provider: integrations.provider,
        config: integrations.config,
      })
      .from(integrations)
      .where(eq(integrations.status, 'active'));

    let expiringCount = 0;
    const now = Date.now();
    const twentyFourHours = 24 * 3600 * 1000;

    for (const item of activeIntegrations) {
      const config = (item.config as Record<string, unknown>) || {};
      const expiry = config.expiresAt || config.tokenExpiresAt || config.expires_at;

      if (expiry) {
        const expiryTime = new Date(expiry as string | number).getTime();
        if (!isNaN(expiryTime) && expiryTime - now < twentyFourHours) {
          expiringCount++;
          jobsLogger.warn(
            {
              integrationId: item.id,
              companyId: item.companyId,
              provider: item.provider,
              expiresAt: new Date(expiryTime).toISOString(),
            },
            'Third-party integration OAuth token expiring soon or expired',
          );
        }
      }
    }

    return { checkedCount: activeIntegrations.length, expiringCount };
  }
}

export const scheduledJobsService = new ScheduledJobsService();
