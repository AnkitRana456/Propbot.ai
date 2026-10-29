import { and, eq, inArray, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../../db/index.js';
import { chatbots, deliveryJobs, integrations, users } from '../../db/schema/index.js';
import { buildLeadCapturedPayload, type FlatLeadWebhookPayload } from '../webhooks/lead-webhook-payload.js';
import { integrationsService } from '../integrations/integrations.service.js';
import { CRM_PROVIDERS } from '../integrations/crm/crm-providers.js';
import { buildLeadAlertMail, sendMail } from './mailer.js';

const log = pino({ name: 'delivery-jobs', level: process.env.LOG_LEVEL ?? 'info' });

/** Same schedule as webhooks: 1 attempt + 3 retries, waiting 1s, 2s, 4s. */
export const DELIVERY_RETRY_DELAYS_SECONDS = [1, 2, 4] as const;
export const DELIVERY_MAX_ATTEMPTS = 4;
const LEASE_SECONDS = 120;

type Job = typeof deliveryJobs.$inferSelect;
type Outcome =
  | { status: 'success'; externalId?: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; retryable: boolean; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class DeliveryJobsService {
  /**
   * Called from the outbox consumer for `lead_created`. Only inserts rows; no network I/O happens here,
   * so neither the lead save nor the outbox transaction ever waits on SMTP or a CRM.
   * Idempotent: the (event, kind, provider) unique index makes replays harmless.
   */
  async enqueueForLeadCreated(event: {
    id: string;
    companyId: string;
    payload: Record<string, unknown>;
  }): Promise<number> {
    const leadId = (event.payload.lead_id || event.payload.leadId) as string | undefined;
    if (!leadId) return 0;
    const lead = await buildLeadCapturedPayload(leadId);
    if (!lead) return 0;

    const rows: Array<typeof deliveryJobs.$inferInsert> = [];
    const base = { companyId: event.companyId, leadId, eventId: event.id, maxAttempts: DELIVERY_MAX_ATTEMPTS };

    const recipients = await this.alertRecipients(event.companyId, lead.ChatbotId);
    if (recipients.length > 0) {
      rows.push({ ...base, kind: 'lead_email_alert', provider: 'smtp', payload: { lead, recipients } });
    }

    const crmIntegrations = await db
      .select({ provider: integrations.provider, events: integrations.events })
      .from(integrations)
      .where(
        and(
          eq(integrations.companyId, event.companyId),
          eq(integrations.status, 'active'),
          inArray(integrations.provider, Object.keys(CRM_PROVIDERS)),
        ),
      );
    for (const i of crmIntegrations) {
      if (!i.events.includes('lead_captured')) continue;
      rows.push({ ...base, kind: 'crm_sync', provider: i.provider, payload: { lead } });
    }

    if (rows.length === 0) return 0;
    const inserted = await db.insert(deliveryJobs).values(rows).onConflictDoNothing().returning({ id: deliveryJobs.id });
    return inserted.length;
  }

  /** Chatbot-level `leadCapture.alertEmails` win; otherwise the company's active admins. */
  private async alertRecipients(companyId: string, chatbotId: string): Promise<string[]> {
    if (chatbotId) {
      const [bot] = await db.select({ config: chatbots.config }).from(chatbots).where(eq(chatbots.id, chatbotId));
      const configured = ((bot?.config as Record<string, unknown> | undefined)?.leadCapture as
        | { alertEmails?: unknown }
        | undefined)?.alertEmails;
      if (Array.isArray(configured)) {
        const valid = configured.filter((e): e is string => typeof e === 'string' && EMAIL_RE.test(e)).slice(0, 10);
        if (valid.length > 0) return valid;
      }
    }
    const envAlert = process.env.LEAD_ALERT_EMAIL;
    if (envAlert && EMAIL_RE.test(envAlert)) return [envAlert];
    const admins = await db
      .select({ email: users.email })
      .from(users)
      .where(
        and(
          eq(users.companyId, companyId),
          eq(users.status, 'active'),
          inArray(users.role, ['company_admin', 'ps-owner']),
          sql`${users.deletedAt} IS NULL`,
        ),
      )
      .limit(10);
    return admins.map(a => a.email).filter(e => EMAIL_RE.test(e));
  }

  /** Claims due jobs with a lease (SKIP LOCKED: safe with several workers) and delivers them in parallel. */
  async processDue(batchSize = 25): Promise<{ processed: number; succeeded: number }> {
    const claimed = await db.execute(sql`
      UPDATE delivery_jobs
         SET next_attempt_at = now() + make_interval(secs => ${LEASE_SECONDS}), updated_at = now()
       WHERE id IN (
         SELECT id FROM delivery_jobs
          WHERE status = 'pending' AND next_attempt_at <= now()
          ORDER BY next_attempt_at ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
       )
      RETURNING id
    `);
    const ids = (Array.isArray(claimed) ? claimed : (claimed as { rows?: unknown[] }).rows || []).map(
      r => (r as { id: string }).id,
    );
    if (ids.length === 0) return { processed: 0, succeeded: 0 };

    const jobs = await db.select().from(deliveryJobs).where(inArray(deliveryJobs.id, ids));
    const results = await Promise.allSettled(jobs.map(job => this.runJob(job)));
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value === 'success').length;
    return { processed: jobs.length, succeeded };
  }

  private async runJob(job: Job): Promise<'success' | 'skipped' | 'retry' | 'dead'> {
    let outcome: Outcome;
    try {
      outcome = await this.execute(job);
    } catch (err) {
      outcome = { status: 'failed', retryable: true, error: err instanceof Error ? err.message : String(err) };
    }

    const attempts = job.attempts + 1;
    if (outcome.status === 'success') {
      await db
        .update(deliveryJobs)
        .set({ status: 'success', attempts, externalId: outcome.externalId ?? null, lastError: null, updatedAt: new Date() })
        .where(eq(deliveryJobs.id, job.id));
      return 'success';
    }
    if (outcome.status === 'skipped') {
      await db
        .update(deliveryJobs)
        .set({ status: 'skipped', attempts, lastError: outcome.reason, updatedAt: new Date() })
        .where(eq(deliveryJobs.id, job.id));
      return 'skipped';
    }

    const exhausted = !outcome.retryable || attempts >= job.maxAttempts;
    if (exhausted) {
      log.warn({ jobId: job.id, kind: job.kind, provider: job.provider, error: outcome.error }, 'Delivery job dead-lettered');
      await db
        .update(deliveryJobs)
        .set({ status: 'dead_letter', attempts, lastError: outcome.error, updatedAt: new Date() })
        .where(eq(deliveryJobs.id, job.id));
      return 'dead';
    }
    const delay = DELIVERY_RETRY_DELAYS_SECONDS[Math.min(attempts, DELIVERY_RETRY_DELAYS_SECONDS.length) - 1]!;
    await db
      .update(deliveryJobs)
      .set({
        attempts,
        lastError: outcome.error,
        nextAttemptAt: new Date(Date.now() + delay * 1000),
        updatedAt: new Date(),
      })
      .where(eq(deliveryJobs.id, job.id));
    return 'retry';
  }

  private async execute(job: Job): Promise<Outcome> {
    const payload = job.payload as { lead: FlatLeadWebhookPayload; recipients?: string[] };

    if (job.kind === 'lead_email_alert') {
      const result = await sendMail(buildLeadAlertMail(payload.lead, payload.recipients ?? []));
      if (!result.sent) return { status: 'skipped', reason: 'SMTP is not configured (set SMTP_HOST).' };
      return { status: 'success', externalId: result.messageId };
    }

    if (job.kind === 'crm_sync') {
      const provider = CRM_PROVIDERS[job.provider];
      if (!provider) return { status: 'skipped', reason: `Unsupported CRM provider: ${job.provider}` };
      const [integration] = await db
        .select()
        .from(integrations)
        .where(and(eq(integrations.companyId, job.companyId), eq(integrations.provider, job.provider)));
      if (!integration || integration.status !== 'active') {
        return { status: 'skipped', reason: `${job.provider} integration is not active.` };
      }
      const config = integrationsService.decryptConfig(integration.config as Record<string, unknown>);
      const res = await provider.syncLead(payload.lead, config);
      if (res.ok) return { status: 'success', externalId: res.externalId };
      if (res.skipped) return { status: 'skipped', reason: res.reason };
      return { status: 'failed', retryable: res.retryable, error: res.error };
    }

    return { status: 'skipped', reason: `Unknown job kind: ${job.kind}` };
  }
}

export const deliveryJobsService = new DeliveryJobsService();
