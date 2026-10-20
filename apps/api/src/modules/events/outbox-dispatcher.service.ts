import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { domainEvents, eventConsumerCheckpoints, notifications, users } from '../../db/schema/index.js';
import { outboxProcessorService } from '../webhooks/outbox-processor.service.js';
import { workflowEngineService } from '../workflows/workflow-engine.service.js';
import { voiceCallbackConsumer } from '../voice/voice-callback.consumer.js';
import { notificationsService } from '../controls/controls.service.js';
import { handleFlowEvent } from '../flows/flow-events.js';
import { deliveryJobsService } from '../delivery/delivery-jobs.service.js';
import { pino } from 'pino';

export const outboxLogger = pino({
  name: 'outbox-dispatcher',
  level: process.env.LOG_LEVEL ?? 'info',
});

export type ConsumerHandler = (event: {
  id: string;
  companyId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}) => Promise<void>;

export class OutboxDispatcherService {
  private consumers: Map<string, ConsumerHandler> = new Map();

  constructor() {
    this.registerDefaultConsumers();
  }

  /**
   * Registers an event consumer handler by name.
   */
  registerConsumer(name: string, handler: ConsumerHandler): void {
    this.consumers.set(name, handler);
  }

  private registerDefaultConsumers(): void {
    // 1. Webhook consumer
    this.registerConsumer('webhooks', async (event) => {
      await outboxProcessorService.processSingleEventWebhooks(event.id, event.companyId, event.type, event.payload);
    });

    // 2. Notification consumer (hot leads, handoff requests, bookings)
    this.registerConsumer('notifications', async (event) => {
      // Company notification rules take over when they exist for this event; otherwise the built-in alert below runs
      if (await notificationsService.deliver({ companyId: event.companyId, type: event.type, payload: event.payload })) return;
      if (event.type === 'lead_hot' || event.type === 'handoff_requested' || event.type === 'visit_booked') {
        const payload = event.payload;
        const [adminUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.companyId, event.companyId), eq(users.role, 'company_admin')))
          .limit(1);

        if (adminUser) {
          const title =
            event.type === 'lead_hot'
              ? '🔥 Hot Lead Alert'
              : event.type === 'handoff_requested'
                ? '👤 Agent Takeover Requested'
                : '📅 Site Visit Booked';

          const message =
            typeof payload.summary === 'string'
              ? payload.summary
              : `Event ${event.type} received for lead ${(payload.leadId || payload.lead_id) || 'unknown'}`;

          await db.insert(notifications).values({
            companyId: event.companyId,
            userId: adminUser.id,
            type: event.type,
            title,
            message,
            metadata: payload,
          });
        }
      }
    });

    // 2b. Lead e-mail alert + CRM sync: enqueue durable delivery jobs only (no network I/O in this transaction)
    this.registerConsumer('delivery_jobs', async (event) => {
      if (event.type === 'lead_created') {
        await deliveryJobsService.enqueueForLeadCreated(event);
      }
    });

    // 3. Workflows consumer
    this.registerConsumer('workflows', async (event) => {
      await workflowEngineService.handleTriggerEvent(event);
    });

    // Flow builder triggers (new lead, stage change, visit booked, form submitted)
    this.registerConsumer('flows', async (event) => {
      await handleFlowEvent(event);
    });

    // 4. Voice callback consumer (automated ~30s callback on lead_created)
    this.registerConsumer('voice_callback', async (event) => {
      await voiceCallbackConsumer.handleEvent(event);
    });

    // 5. Next Best Action consumer
    this.registerConsumer('next_best_action', async (event) => {
      const relevantTypes = [
        'intent_changed',
        'lead_hot',
        'visit_booked',
        'room_viewed',
        'message_received',
        'lead_status_changed',
      ];
      if (relevantTypes.includes(event.type)) {
        const { nextBestActionService } = await import('../crm/next-best-action.service.js');
        await nextBestActionService.handleEvent(event);
      }
    });

    // 6. Analytics rollups consumer
    this.registerConsumer('analytics_rollups', async (event) => {
      const rollupEventTypes = ['lead_created', 'lead_status_changed', 'visit_booked', 'message_received'];
      if (rollupEventTypes.includes(event.type)) {
        const { rollupService } = await import('../analytics/rollup.service.js');
        const todayStr = event.createdAt.toISOString().split('T')[0]!;
        await rollupService.rollupDayForCompany(event.companyId, todayStr);
      }
    });
  }

  /**
   * Claims and processes a batch of unprocessed domain events using
   * SELECT ... FOR UPDATE SKIP LOCKED inside an atomic transaction.
   */
  async processBatch(batchSize = 50): Promise<{ processedCount: number; errorsCount: number }> {
    let processedCount = 0;
    let errorsCount = 0;

    await db.transaction(async (tx) => {
      // 1. Claim unprocessed rows with SKIP LOCKED
      const claimedRows = await tx.execute(sql`
        SELECT id, company_id, type, payload, attempts, created_at
        FROM domain_events
        WHERE processed_at IS NULL AND is_dead = false
        ORDER BY created_at ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `);

      const rawRows = claimedRows as unknown as { rows?: Array<unknown> } | Array<unknown>;
      const events = (Array.isArray(rawRows) ? rawRows : (rawRows?.rows || [])) as Array<{
        id: string;
        company_id: string;
        type: string;
        payload: Record<string, unknown>;
        attempts: number;
        created_at: string;
      }>;

      if (!events || events.length === 0) {
        return;
      }

      for (const eventRow of events) {
        const eventId = eventRow.id;
        const companyId = eventRow.company_id;
        const type = eventRow.type;
        const payload = (eventRow.payload as Record<string, unknown>) || {};
        const createdAt = new Date(eventRow.created_at);

        let eventError: string | null = null;

        // Fan out to each registered consumer with idempotency checking
        for (const [consumerName, handler] of this.consumers.entries()) {
          try {
            // Checkpoint check
            const [checkpoint] = await tx
              .select({ id: eventConsumerCheckpoints.id })
              .from(eventConsumerCheckpoints)
              .where(
                and(
                  eq(eventConsumerCheckpoints.eventId, eventId),
                  eq(eventConsumerCheckpoints.consumerName, consumerName),
                ),
              )
              .limit(1);

            if (checkpoint) {
              // Already processed by this consumer; skip
              continue;
            }

            // Run consumer
            await handler({
              id: eventId,
              companyId,
              type,
              payload,
              createdAt,
            });

            // Record consumer checkpoint
            await tx.insert(eventConsumerCheckpoints).values({
              eventId,
              consumerName,
            });
          } catch (consumerErr: unknown) {
            const errMessage = consumerErr instanceof Error ? consumerErr.message : String(consumerErr);
            outboxLogger.warn({ eventId, consumerName, err: errMessage }, 'Consumer execution failed for event');
            eventError = errMessage;
          }
        }

        if (eventError) {
          errorsCount++;
          const newAttempts = (eventRow.attempts || 0) + 1;
          const isDead = newAttempts >= 5;

          await tx
            .update(domainEvents)
            .set({
              attempts: newAttempts,
              lastError: eventError,
              isDead,
              updatedAt: new Date(),
            })
            .where(eq(domainEvents.id, eventId));

          if (isDead) {
            outboxLogger.error({ eventId, type, attempts: newAttempts }, 'Domain event marked DEAD after 5 attempts');
          }
        } else {
          // All consumers passed; mark processed
          await tx
            .update(domainEvents)
            .set({
              processedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(domainEvents.id, eventId));

          processedCount++;
        }
      }
    });

    return { processedCount, errorsCount };
  }

  /**
   * Replays an event by clearing processedAt, isDead, attempts, and its checkpoints.
   */
  async replayEvent(companyId: string, eventId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(domainEvents)
        .where(and(eq(domainEvents.id, eventId), eq(domainEvents.companyId, companyId)))
        .limit(1);

      if (!existing) {
        throw new Error('Domain event not found or unauthorized.');
      }

      // Delete past consumer checkpoints so consumers will re-execute
      await tx
        .delete(eventConsumerCheckpoints)
        .where(eq(eventConsumerCheckpoints.eventId, eventId));

      // Reset event state for dispatcher pickup
      await tx
        .update(domainEvents)
        .set({
          processedAt: null,
          isDead: false,
          attempts: 0,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(domainEvents.id, eventId));
    });

    outboxLogger.info({ eventId, companyId }, 'Domain event successfully reset for replay');
  }

  /**
   * Lists domain events for admin inspection.
   */
  async listEvents(
    companyId: string,
    options: { page?: number; limit?: number; type?: string; status?: 'all' | 'pending' | 'processed' | 'dead' } = {},
  ) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [eq(domainEvents.companyId, companyId)];
    if (options.type) {
      conditions.push(eq(domainEvents.type, options.type));
    }
    if (options.status === 'pending') {
      conditions.push(sql`${domainEvents.processedAt} IS NULL AND ${domainEvents.isDead} = false`);
    } else if (options.status === 'processed') {
      conditions.push(sql`${domainEvents.processedAt} IS NOT NULL`);
    } else if (options.status === 'dead') {
      conditions.push(eq(domainEvents.isDead, true));
    }

    const items = await db
      .select()
      .from(domainEvents)
      .where(and(...conditions))
      .orderBy(sql`${domainEvents.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(domainEvents)
      .where(and(...conditions));

    const total = countResult?.total ?? 0;

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const outboxDispatcherService = new OutboxDispatcherService();
