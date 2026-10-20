import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { domainEvents, webhookEndpoints, webhookLogs, leads, contacts } from '../../db/schema/index.js';
import type { WebhookEventType } from '@propbot/shared';
import {
  webhookDispatcherService,
  webhookLogger,
  WEBHOOK_MAX_ATTEMPTS,
} from './webhook-dispatcher.service.js';
import { buildLeadCapturedPayload } from './lead-webhook-payload.js';

export class OutboxProcessorService {
  /**
   * Maps internal domain event types to public webhook event types.
   */
  mapDomainEventType(type: string, payload: Record<string, unknown>): WebhookEventType | null {
    switch (type) {
      case 'lead_created':
        return 'lead_captured';
      case 'lead_updated':
        return 'lead_updated';
      case 'lead_status_changed': {
        const newStatus = String(payload.new_status || '');
        if (newStatus === 'qualified' || newStatus === 'site_visit_scheduled') {
          return 'lead_qualified';
        }
        return 'lead_updated';
      }
      case 'lead_hot':
        return 'hot_lead';
      case 'intent_changed': {
        const newScore = Number(payload.new_score || 0);
        if (newScore >= 70) return 'hot_lead';
        if (newScore >= 50) return 'lead_qualified';
        return 'lead_updated';
      }
      case 'visit_booked':
        return 'appointment_booked';
      case 'visit_changed':
        return 'appointment_changed';
      case 'brochure_opened':
        return 'brochure_requested';
      case 'handoff_requested':
        return 'handoff_requested';
      case 'payment_received':
        return 'payment_received';
      default:
        return null;
    }
  }

  /**
   * Dispatches webhooks for a single event without updating outbox row status.
   */
  async processSingleEventWebhooks(
    eventId: string,
    companyId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<number> {
    const webhookEvent = this.mapDomainEventType(type, payload);
    if (!webhookEvent) return 0;

    const leadId = (payload.lead_id || payload.leadId) as string | undefined;
    let leadName: string | null = (payload.name as string) || null;
    let chatbotId: string | null = (payload.chatbot_id || payload.chatbotId) as string | null;

    if (leadId) {
      const [leadRow] = await db
        .select({
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          chatbotId: leads.chatbotId,
        })
        .from(leads)
        .innerJoin(contacts, eq(leads.contactId, contacts.id))
        .where(eq(leads.id, leadId));

      if (leadRow) {
        const resolvedName = [leadRow.firstName, leadRow.lastName].filter(Boolean).join(' ').trim();
        if (resolvedName) leadName = resolvedName;
        if (!chatbotId) chatbotId = leadRow.chatbotId;
      }
    }

    const endpoints = await db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.companyId, companyId),
          eq(webhookEndpoints.isActive, true),
          sql`${webhookEvent} = ANY(${webhookEndpoints.subscribedEvents})`,
        ),
      );

    // lead_captured is delivered as a flat, PascalCase payload (UTMSource, SharedURL, ...).
    let data: Record<string, unknown> = payload;
    if (webhookEvent === 'lead_captured' && leadId) {
      const flat = await buildLeadCapturedPayload(leadId);
      if (flat) data = { ...flat };
    }

    // Enqueue only: the HTTP calls happen in processScheduledRetries(), outside the outbox
    // transaction, in parallel and with retries. Saving the lead never waits for a webhook.
    const targets = endpoints.filter(ep => !(ep.chatbotId && chatbotId && ep.chatbotId !== chatbotId));
    if (targets.length === 0) return 0;

    await db.insert(webhookLogs).values(
      targets.map(ep => ({
        companyId,
        endpointId: ep.id,
        leadId: leadId || null,
        leadName,
        chatbotId,
        eventId,
        eventType: webhookEvent,
        status: 'retrying' as const,
        statusCode: null,
        attempt: 0, // queued: no HTTP attempt made yet
        maxAttempts: WEBHOOK_MAX_ATTEMPTS,
        requestPayload: data,
        requestHeaders: {},
        nextRetryAt: new Date(),
      })),
    );

    return targets.length;
  }

  /**
   * Processes a single batch of pending outbox domain_events.
   */
  async processPendingEvents(batchSize = 50): Promise<{ processedCount: number; dispatchedCount: number }> {
    const pendingEvents = await db
      .select()
      .from(domainEvents)
      .where(isNull(domainEvents.processedAt))
      .orderBy(domainEvents.createdAt)
      .limit(batchSize);

    if (pendingEvents.length === 0) {
      return { processedCount: 0, dispatchedCount: 0 };
    }

    let processedCount = 0;
    let dispatchedCount = 0;

    for (const event of pendingEvents) {
      const payload = (event.payload as Record<string, unknown>) || {};
      const count = await this.processSingleEventWebhooks(event.id, event.companyId, event.type, payload);
      dispatchedCount += count;

      // Mark outbox event as processed
      await db
        .update(domainEvents)
        .set({
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(domainEvents.id, event.id));

      processedCount++;
    }

    return { processedCount, dispatchedCount };
  }

  /**
   * Processes scheduled webhook retries that are due.
   */
  /** `companyId` limits the run to one tenant (tests; also useful for manual replays). */
  async processScheduledRetries(batchSize = 25, companyId?: string): Promise<{ retriedCount: number }> {
    // Claim due rows atomically (SKIP LOCKED) and lease them for 2 minutes, so parallel workers never
    // double-send and a crashed worker's rows simply become due again after the lease.
    const claimedIds = await db.transaction(async tx => {
      const claimed = await tx.execute(sql`
        UPDATE webhook_logs SET next_retry_at = now() + interval '2 minutes', updated_at = now()
        WHERE id IN (
          SELECT wl.id FROM webhook_logs wl
          JOIN webhook_endpoints we ON we.id = wl.endpoint_id
          WHERE wl.status = 'retrying' AND wl.next_retry_at <= now() AND we.is_active = true
            AND (${companyId ?? null}::uuid IS NULL OR wl.company_id = ${companyId ?? null}::uuid)
          ORDER BY wl.next_retry_at ASC
          LIMIT ${batchSize}
          FOR UPDATE OF wl SKIP LOCKED
        )
        RETURNING id
      `);
      const rows = (Array.isArray(claimed) ? claimed : (claimed as { rows?: unknown[] }).rows || []) as Array<{
        id: string;
      }>;
      return rows.map(r => r.id);
    });

    if (claimedIds.length === 0) return { retriedCount: 0 };

    const due = await db
      .select({ log: webhookLogs, endpoint: webhookEndpoints })
      .from(webhookLogs)
      .innerJoin(webhookEndpoints, eq(webhookLogs.endpointId, webhookEndpoints.id))
      .where(inArray(webhookLogs.id, claimedIds));

    // Deliver every due webhook in parallel; one slow endpoint must not delay the others.
    const results = await Promise.allSettled(
      due.map(async item => {
        const attemptedBefore = item.log.attempt;
        const nextAttempt = attemptedBefore + 1;
        const stored = item.log.requestPayload as Record<string, unknown>;
        // Queued rows hold the raw data; failed-attempt rows hold the full envelope that was sent.
        const data =
          attemptedBefore > 0 && stored && typeof stored.data === 'object' && 'event' in stored
            ? (stored.data as Record<string, unknown>)
            : stored;

        const common = {
          companyId: item.log.companyId,
          endpointId: item.endpoint.id,
          endpointUrl: item.endpoint.url,
          endpointSecret: item.endpoint.secret,
          endpointHeaders: (item.endpoint.headers as Record<string, string>) || {},
          eventType: item.log.eventType as WebhookEventType,
          eventId: item.log.eventId || undefined,
          leadId: item.log.leadId,
          leadName: item.log.leadName,
          chatbotId: item.log.chatbotId,
          data,
          attempt: nextAttempt,
          maxAttempts: item.log.maxAttempts,
        };

        if (attemptedBefore === 0) {
          // The queued row becomes the record of attempt 1.
          await webhookDispatcherService.dispatch({ ...common, existingLogId: item.log.id });
        } else {
          // Every attempt keeps its own audit row: close the failed one, log the new one separately.
          await db
            .update(webhookLogs)
            .set({ status: 'failed', nextRetryAt: null, updatedAt: new Date() })
            .where(eq(webhookLogs.id, item.log.id));
          await webhookDispatcherService.dispatch(common);
        }
      }),
    );

    for (const r of results) {
      if (r.status === 'rejected') {
        webhookLogger.warn({ err: r.reason }, 'Scheduled webhook attempt crashed');
      }
    }

    return { retriedCount: due.length };
  }
}

export const outboxProcessorService = new OutboxProcessorService();
