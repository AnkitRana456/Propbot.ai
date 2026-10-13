import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { domainEvents, webhookEndpoints, webhookLogs, leads, contacts } from '../../db/schema/index.js';
import type { WebhookEventType } from '@propbot/shared';
import { webhookDispatcherService, webhookLogger } from './webhook-dispatcher.service.js';

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

    let dispatched = 0;
    for (const ep of endpoints) {
      if (ep.chatbotId && chatbotId && ep.chatbotId !== chatbotId) {
        continue;
      }

      try {
        await webhookDispatcherService.dispatch({
          companyId,
          endpointId: ep.id,
          endpointUrl: ep.url,
          endpointSecret: ep.secret,
          endpointHeaders: (ep.headers as Record<string, string>) || {},
          eventType: webhookEvent,
          eventId,
          leadId: leadId || null,
          leadName,
          chatbotId,
          data: payload,
          attempt: 1,
        });
        dispatched++;
      } catch (dispatchErr) {
        webhookLogger.warn({ dispatchErr, endpointId: ep.id }, 'Outbox webhook dispatch failed');
      }
    }

    return dispatched;
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
  async processScheduledRetries(batchSize = 25): Promise<{ retriedCount: number }> {
    const now = new Date();

    const dueRetries = await db
      .select({
        log: webhookLogs,
        endpoint: webhookEndpoints,
      })
      .from(webhookLogs)
      .innerJoin(webhookEndpoints, eq(webhookLogs.endpointId, webhookEndpoints.id))
      .where(
        and(
          eq(webhookLogs.status, 'retrying'),
          lte(webhookLogs.nextRetryAt, now),
          eq(webhookEndpoints.isActive, true),
        ),
      )
      .limit(batchSize);

    let retriedCount = 0;

    for (const item of dueRetries) {
      const nextAttempt = item.log.attempt + 1;
      const payload = item.log.requestPayload as Record<string, unknown>;

      await webhookDispatcherService.dispatch({
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
        data: payload,
        attempt: nextAttempt,
        maxAttempts: item.log.maxAttempts,
        existingLogId: item.log.id,
      });

      retriedCount++;
    }

    return { retriedCount };
  }
}

export const outboxProcessorService = new OutboxProcessorService();
