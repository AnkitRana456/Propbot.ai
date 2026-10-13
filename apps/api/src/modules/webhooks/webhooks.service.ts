import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  webhookEndpoints,
  webhookLogs,
  chatbots,
  leads,
  domainEvents,
  whatsappConfigs,
} from '../../db/schema/index.js';
import type {
  CreateWebhookEndpointInput,
  UpdateWebhookEndpointInput,
  WebhookEndpointItem,
  WebhookLogItem,
  WebhookLogsFilter,
  WebhookKpis,
  InboundLeadWebhookInput,
  WebhookEventType,
} from '@propbot/shared';
import { WebhookSigner } from './webhook-signer.js';
import { webhookDispatcherService } from './webhook-dispatcher.service.js';
import { leadsService } from '../leads/leads.service.js';
import { whatsappAdapter } from '../whatsapp/whatsapp.adapter.js';

export class WebhooksService {
  /**
   * Lists all webhook endpoints for a tenant.
   */
  async listEndpoints(companyId: string): Promise<WebhookEndpointItem[]> {
    const rows = await db
      .select({
        endpoint: webhookEndpoints,
        chatbotName: chatbots.name,
      })
      .from(webhookEndpoints)
      .leftJoin(chatbots, eq(webhookEndpoints.chatbotId, chatbots.id))
      .where(eq(webhookEndpoints.companyId, companyId))
      .orderBy(desc(webhookEndpoints.createdAt));

    return rows.map(({ endpoint, chatbotName }) => ({
      id: endpoint.id,
      companyId: endpoint.companyId,
      name: endpoint.name,
      chatbotId: endpoint.chatbotId,
      chatbotName: chatbotName || null,
      url: endpoint.url,
      maskedSecret: WebhookSigner.maskSecret(endpoint.secret),
      subscribedEvents: endpoint.subscribedEvents as WebhookEventType[],
      headers: (endpoint.headers as Record<string, string>) || {},
      payloadTemplate: endpoint.payloadTemplate,
      isActive: endpoint.isActive,
      createdAt: endpoint.createdAt.toISOString(),
      updatedAt: endpoint.updatedAt.toISOString(),
    }));
  }

  /**
   * Retrieves single endpoint details.
   */
  async getEndpoint(companyId: string, endpointId: string): Promise<WebhookEndpointItem | null> {
    const [row] = await db
      .select({
        endpoint: webhookEndpoints,
        chatbotName: chatbots.name,
      })
      .from(webhookEndpoints)
      .leftJoin(chatbots, eq(webhookEndpoints.chatbotId, chatbots.id))
      .where(and(eq(webhookEndpoints.companyId, companyId), eq(webhookEndpoints.id, endpointId)));

    if (!row) return null;

    return {
      id: row.endpoint.id,
      companyId: row.endpoint.companyId,
      name: row.endpoint.name,
      chatbotId: row.endpoint.chatbotId,
      chatbotName: row.chatbotName || null,
      url: row.endpoint.url,
      maskedSecret: WebhookSigner.maskSecret(row.endpoint.secret),
      subscribedEvents: row.endpoint.subscribedEvents as WebhookEventType[],
      headers: (row.endpoint.headers as Record<string, string>) || {},
      payloadTemplate: row.endpoint.payloadTemplate,
      isActive: row.endpoint.isActive,
      createdAt: row.endpoint.createdAt.toISOString(),
      updatedAt: row.endpoint.updatedAt.toISOString(),
    };
  }

  /**
   * Creates a new outbound webhook endpoint.
   */
  async createEndpoint(
    companyId: string,
    input: CreateWebhookEndpointInput,
  ): Promise<WebhookEndpointItem> {
    const secret = WebhookSigner.generateSecret();

    const [created] = await db
      .insert(webhookEndpoints)
      .values({
        companyId,
        name: input.name || 'Webhook Endpoint',
        chatbotId: input.chatbotId || null,
        url: input.url,
        secret,
        subscribedEvents: input.subscribedEvents,
        headers: input.headers || {},
        payloadTemplate: input.payloadTemplate || null,
        isActive: input.isActive ?? true,
      })
      .returning();

    if (!created) throw new Error('Failed to create webhook endpoint');

    return (await this.getEndpoint(companyId, created.id))!;
  }

  /**
   * Updates an existing webhook endpoint.
   */
  async updateEndpoint(
    companyId: string,
    endpointId: string,
    input: UpdateWebhookEndpointInput,
  ): Promise<WebhookEndpointItem> {
    const existing = await this.getEndpoint(companyId, endpointId);
    if (!existing) {
      const err = new Error('Webhook endpoint not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    await db
      .update(webhookEndpoints)
      .set({
        name: input.name !== undefined ? input.name : existing.name,
        chatbotId: input.chatbotId !== undefined ? input.chatbotId : existing.chatbotId,
        url: input.url !== undefined ? input.url : existing.url,
        subscribedEvents:
          input.subscribedEvents !== undefined ? input.subscribedEvents : existing.subscribedEvents,
        headers: input.headers !== undefined ? input.headers : existing.headers,
        payloadTemplate:
          input.payloadTemplate !== undefined ? input.payloadTemplate : existing.payloadTemplate,
        isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(webhookEndpoints.companyId, companyId), eq(webhookEndpoints.id, endpointId)));

    return (await this.getEndpoint(companyId, endpointId))!;
  }

  /**
   * Deletes a webhook endpoint.
   */
  async deleteEndpoint(companyId: string, endpointId: string): Promise<boolean> {
    const res = await db
      .delete(webhookEndpoints)
      .where(and(eq(webhookEndpoints.companyId, companyId), eq(webhookEndpoints.id, endpointId)))
      .returning({ id: webhookEndpoints.id });

    return res.length > 0;
  }

  /**
   * Sends a synthetic test event to verify endpoint connectivity.
   */
  async sendTestEvent(
    companyId: string,
    endpointId: string,
  ): Promise<{ success: boolean; statusCode: number | null; durationMs: number; status: string }> {
    const [endpoint] = await db
      .select()
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.companyId, companyId), eq(webhookEndpoints.id, endpointId)));

    if (!endpoint) {
      const err = new Error('Webhook endpoint not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const testPayload = {
      test: true,
      message: 'PropBot Pro synthetic test ping',
      endpoint_name: endpoint.name,
      subscribed_events: endpoint.subscribedEvents,
    };

    const result = await webhookDispatcherService.dispatch({
      companyId,
      endpointId: endpoint.id,
      endpointUrl: endpoint.url,
      endpointSecret: endpoint.secret,
      endpointHeaders: (endpoint.headers as Record<string, string>) || {},
      eventType: 'lead_captured',
      eventId: `test_${Date.now()}`,
      leadName: 'Test Buyer',
      data: testPayload,
      attempt: 1,
      maxAttempts: 1,
    });

    return {
      success: result.success,
      statusCode: result.statusCode,
      durationMs: result.durationMs,
      status: result.status,
    };
  }

  /**
   * Calculates 4 KPI metrics for the Webhook Logs page.
   */
  async getKpis(companyId: string): Promise<WebhookKpis> {
    const [row] = await db
      .select({
        total: sql<number>`count(*)::int`,
        successCount: sql<number>`count(case when ${webhookLogs.status} = 'success' then 1 end)::int`,
        failedCount: sql<number>`count(case when ${webhookLogs.status} in ('failed', 'dead_letter') then 1 end)::int`,
        avgDuration: sql<number>`coalesce(avg(${webhookLogs.durationMs}), 0)::int`,
      })
      .from(webhookLogs)
      .where(eq(webhookLogs.companyId, companyId));

    const total = Number(row?.total || 0);
    const success = Number(row?.successCount || 0);
    const failed = Number(row?.failedCount || 0);
    const avgDurationMs = Math.round(Number(row?.avgDuration || 0));
    const successRate = total > 0 ? Number(((success / total) * 100).toFixed(1)) : 100;

    return {
      totalWebhooks: total,
      successRate,
      failedCount: failed,
      avgDurationMs,
    };
  }

  /**
   * Retrieves delivery logs matching filters.
   */
  async getLogs(
    companyId: string,
    filter: WebhookLogsFilter,
  ): Promise<{ items: WebhookLogItem[]; total: number; page: number; limit: number }> {
    const conditions = [eq(webhookLogs.companyId, companyId)];

    if (filter.endpointId) {
      conditions.push(eq(webhookLogs.endpointId, filter.endpointId));
    }

    if (filter.leadId) {
      conditions.push(eq(webhookLogs.leadId, filter.leadId));
    }

    if (filter.status && filter.status !== 'all') {
      conditions.push(eq(webhookLogs.status, filter.status));
    }

    if (filter.eventType) {
      conditions.push(eq(webhookLogs.eventType, filter.eventType));
    }

    if (filter.startDate) {
      conditions.push(sql`${webhookLogs.createdAt} >= ${filter.startDate}::timestamptz`);
    }

    if (filter.endDate) {
      conditions.push(sql`${webhookLogs.createdAt} <= ${filter.endDate}::timestamptz`);
    }

    const whereClause = and(...conditions);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(webhookLogs)
      .where(whereClause);

    const total = Number(countRow?.count || 0);
    const page = filter.page || 1;
    const limit = filter.limit || 25;
    const offset = (page - 1) * limit;

    const rows = await db
      .select({
        log: webhookLogs,
        endpointName: webhookEndpoints.name,
        endpointUrl: webhookEndpoints.url,
        chatbotName: chatbots.name,
      })
      .from(webhookLogs)
      .innerJoin(webhookEndpoints, eq(webhookLogs.endpointId, webhookEndpoints.id))
      .leftJoin(chatbots, eq(webhookLogs.chatbotId, chatbots.id))
      .where(whereClause)
      .orderBy(desc(webhookLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const items: WebhookLogItem[] = rows.map(r => ({
      id: r.log.id,
      companyId: r.log.companyId,
      endpointId: r.log.endpointId,
      endpointName: r.endpointName,
      endpointUrl: r.endpointUrl,
      leadId: r.log.leadId,
      leadName: r.log.leadName,
      chatbotId: r.log.chatbotId,
      chatbotName: r.chatbotName || null,
      eventId: r.log.eventId,
      eventType: r.log.eventType,
      status: r.log.status as WebhookLogItem['status'],
      statusCode: r.log.statusCode,
      attempt: r.log.attempt,
      maxAttempts: r.log.maxAttempts,
      requestPayload: r.log.requestPayload as Record<string, unknown>,
      requestHeaders: (r.log.requestHeaders as Record<string, string>) || {},
      responseBody: r.log.responseBody,
      responseHeaders: (r.log.responseHeaders as Record<string, string>) || {},
      durationMs: r.log.durationMs,
      errorMessage: r.log.errorMessage,
      nextRetryAt: r.log.nextRetryAt ? r.log.nextRetryAt.toISOString() : null,
      createdAt: r.log.createdAt.toISOString(),
      updatedAt: r.log.updatedAt.toISOString(),
    }));

    return { items, total, page, limit };
  }

  /**
   * Retrieves single log detail.
   */
  async getLogById(companyId: string, logId: string): Promise<WebhookLogItem | null> {
    const [r] = await db
      .select({
        log: webhookLogs,
        endpointName: webhookEndpoints.name,
        endpointUrl: webhookEndpoints.url,
        chatbotName: chatbots.name,
      })
      .from(webhookLogs)
      .innerJoin(webhookEndpoints, eq(webhookLogs.endpointId, webhookEndpoints.id))
      .leftJoin(chatbots, eq(webhookLogs.chatbotId, chatbots.id))
      .where(and(eq(webhookLogs.companyId, companyId), eq(webhookLogs.id, logId)));

    if (!r) return null;

    return {
      id: r.log.id,
      companyId: r.log.companyId,
      endpointId: r.log.endpointId,
      endpointName: r.endpointName,
      endpointUrl: r.endpointUrl,
      leadId: r.log.leadId,
      leadName: r.log.leadName,
      chatbotId: r.log.chatbotId,
      chatbotName: r.chatbotName || null,
      eventId: r.log.eventId,
      eventType: r.log.eventType,
      status: r.log.status as WebhookLogItem['status'],
      statusCode: r.log.statusCode,
      attempt: r.log.attempt,
      maxAttempts: r.log.maxAttempts,
      requestPayload: r.log.requestPayload as Record<string, unknown>,
      requestHeaders: (r.log.requestHeaders as Record<string, string>) || {},
      responseBody: r.log.responseBody,
      responseHeaders: (r.log.responseHeaders as Record<string, string>) || {},
      durationMs: r.log.durationMs,
      errorMessage: r.log.errorMessage,
      nextRetryAt: r.log.nextRetryAt ? r.log.nextRetryAt.toISOString() : null,
      createdAt: r.log.createdAt.toISOString(),
      updatedAt: r.log.updatedAt.toISOString(),
    };
  }

  /**
   * Replays a previously failed or dead-lettered webhook.
   */
  async replayWebhook(companyId: string, logId: string): Promise<WebhookLogItem> {
    const logItem = await this.getLogById(companyId, logId);
    if (!logItem) {
      const err = new Error('Webhook log not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const [endpoint] = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, logItem.endpointId));

    if (!endpoint) {
      const err = new Error('Associated webhook endpoint no longer exists');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    await webhookDispatcherService.dispatch({
      companyId,
      endpointId: endpoint.id,
      endpointUrl: endpoint.url,
      endpointSecret: endpoint.secret,
      endpointHeaders: (endpoint.headers as Record<string, string>) || {},
      eventType: logItem.eventType as WebhookEventType,
      eventId: logItem.eventId || `replay_${Date.now()}`,
      leadId: logItem.leadId,
      leadName: logItem.leadName,
      chatbotId: logItem.chatbotId,
      data: logItem.requestPayload,
      attempt: 1,
      maxAttempts: logItem.maxAttempts,
      existingLogId: logItem.id,
    });

    return (await this.getLogById(companyId, logId))!;
  }

  /**
   * Ingests an inbound lead from real estate portals or ad forms.
   */
  async processInboundLead(
    companyId: string,
    input: InboundLeadWebhookInput,
  ): Promise<{ success: boolean; leadId: string; contactId: string }> {
    const activeChatbot = await db.query.chatbots.findFirst({
      where: and(eq(chatbots.companyId, companyId), isNull(chatbots.deletedAt)),
    });

    // 1. Capture or update lead in CRM
    const captureResult = await leadsService.captureOrUpdateLead(companyId, {
      chatbotId: activeChatbot?.id,
      name: input.name,
      phone: input.phone,
      email: input.email,
      budget: input.budget,
      metadata: {
        portal: input.portal,
        externalLeadId: input.externalLeadId,
        project: input.project,
        budget: input.budget,
        configuration: input.configuration,
        ...input.metadata,
      },
    });

    const leadId = captureResult.lead.id;
    const contactId = captureResult.lead.contactId;

    // Ensure lead source matches the portal name
    await db
      .update(leads)
      .set({ source: input.portal })
      .where(eq(leads.id, leadId));

    // 2. Emit 'lead_created' event to transactional outbox
    await db.insert(domainEvents).values({
      companyId,
      type: 'lead_created',
      payload: {
        lead_id: leadId,
        contact_id: contactId,
        source: input.portal,
        name: input.name,
        phone: input.phone,
        email: input.email,
        project: input.project,
        budget: input.budget,
      },
    });

    // 3. Trigger Instant WhatsApp Welcome Message if WhatsApp is configured
    try {
      const [waConfig] = await db
        .select()
        .from(whatsappConfigs)
        .where(
          and(
            eq(whatsappConfigs.companyId, companyId),
            eq(whatsappConfigs.status, 'connected'),
            eq(whatsappConfigs.enableAutomation, true),
          ),
        );

      if (waConfig) {
        const welcomeText = `Hello ${input.name}, thank you for inquiring about ${input.project || 'our residences'}. How can we assist you with configurations and pricing?`;
        await whatsappAdapter.send(
          companyId,
          input.phone,
          { type: 'text', text: welcomeText },
          {
            phoneNumberId: waConfig.phoneNumberId || undefined,
            accessToken: waConfig.accessToken || undefined,
          },
        );
      }
    } catch {
      // Non-blocking welcome error
    }

    return {
      success: true,
      leadId,
      contactId,
    };
  }
}

export const webhooksService = new WebhooksService();
