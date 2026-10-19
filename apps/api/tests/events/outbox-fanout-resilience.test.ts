import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, domainEvents, eventConsumerCheckpoints } from '../../src/db/schema/index.js';
import { OutboxDispatcherService } from '../../src/modules/events/outbox-dispatcher.service.js';
import { eq } from 'drizzle-orm';

describe('Phase 15A: Transactional Outbox, Consumer Fan-out, Checkpoints & Replay', () => {
  const companyId = '88888888-8888-8888-8888-888888888815';

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb.insert(companies).values({
      id: companyId,
      name: 'Outbox Test Realty',
      slug: 'outbox-test-realty',
      plan: 'pro',
      status: 'active',
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('1. Claims pending events and executes fan-out consumers', async () => {
    const dispatcher = new OutboxDispatcherService();
    let consumerACalled = 0;
    let consumerBCalled = 0;

    dispatcher.registerConsumer('test_consumer_a', async (event) => {
      if (event.companyId === companyId) {
        consumerACalled++;
      }
    });
    dispatcher.registerConsumer('test_consumer_b', async (event) => {
      if (event.companyId === companyId) {
        consumerBCalled++;
      }
    });

    const [event] = await testDb
      .insert(domainEvents)
      .values({
        companyId,
        type: 'test_event_dispatched',
        payload: { message: 'hello outbox' },
        attempts: 0,
        isDead: false,
      })
      .returning();

    const { processedCount, errorsCount } = await dispatcher.processBatch();

    expect(processedCount).toBeGreaterThanOrEqual(1);
    expect(errorsCount).toBe(0);
    expect(consumerACalled).toBe(1);
    expect(consumerBCalled).toBe(1);

    // Verify checkpoints stored for both consumers
    const checkpoints = await testDb
      .select()
      .from(eventConsumerCheckpoints)
      .where(eq(eventConsumerCheckpoints.eventId, event!.id));

    expect(checkpoints.length).toBe(8);
    expect(checkpoints.map(c => c.consumerName).sort()).toEqual([
      'analytics_rollups',
      'next_best_action',
      'notifications',
      'test_consumer_a',
      'test_consumer_b',
      'voice_callback',
      'webhooks',
      'workflows',
    ]);

    // Verify domain event marked processed
    const [updatedEvent] = await testDb
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.id, event!.id));

    expect(updatedEvent?.processedAt).toBeDefined();
    expect(updatedEvent?.isDead).toBe(false);
  });

  it('2. Enforces checkpoint idempotency (does not re-execute already completed consumers)', async () => {
    const dispatcher = new OutboxDispatcherService();
    let consumerExecutions = 0;

    dispatcher.registerConsumer('idempotent_consumer', async (event) => {
      if (event.companyId === companyId) {
        consumerExecutions++;
      }
    });

    const [event] = await testDb
      .insert(domainEvents)
      .values({
        companyId,
        type: 'idempotency_event',
        payload: { key: 'val' },
        attempts: 0,
        isDead: false,
      })
      .returning();

    // First run
    await dispatcher.processBatch();
    expect(consumerExecutions).toBe(1);

    // Reset processedAt directly in DB to simulate crash before marking complete
    await testDb
      .update(domainEvents)
      .set({ processedAt: null })
      .where(eq(domainEvents.id, event!.id));

    // Second run
    await dispatcher.processBatch();
    // Consumer should NOT have executed again because checkpoint exists
    expect(consumerExecutions).toBe(1);
  });

  it('3. Increments retry attempts on consumer failure and parks into dead-letter after 5 attempts', async () => {
    const dispatcher = new OutboxDispatcherService();
    dispatcher.registerConsumer('failing_consumer', async (event) => {
      if (event.companyId === companyId) {
        throw new Error('Downstream network timeout');
      }
    });

    const [event] = await testDb
      .insert(domainEvents)
      .values({
        companyId,
        type: 'event_will_fail',
        payload: { test: true },
        attempts: 4, // 4 prior attempts
        isDead: false,
      })
      .returning();

    const result = await dispatcher.processBatch();
    expect(result.errorsCount).toBeGreaterThanOrEqual(1);

    const [deadEvent] = await testDb
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.id, event!.id));

    expect(deadEvent?.attempts).toBe(5);
    expect(deadEvent?.isDead).toBe(true);
    expect(deadEvent?.processedAt).toBeNull();
    expect(deadEvent?.lastError).toContain('Downstream network timeout');
  });

  it('4. Dead-letter events are skipped by subsequent batch dispatches', async () => {
    const dispatcher = new OutboxDispatcherService();
    let executedForCompany = false;

    dispatcher.registerConsumer('should_not_run', async (event) => {
      if (event.companyId === companyId) {
        executedForCompany = true;
      }
    });

    await dispatcher.processBatch();
    expect(executedForCompany).toBe(false);
  });

  it('5. Admin event replay resets dead-letter event and allows successful re-processing', async () => {
    const dispatcher = new OutboxDispatcherService();
    let replayedExecution = 0;

    dispatcher.registerConsumer('replay_consumer', async (event) => {
      if (event.companyId === companyId) {
        replayedExecution++;
      }
    });

    // Find the dead event from test 3
    const [deadEvent] = await testDb
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.type, 'event_will_fail'));

    expect(deadEvent?.isDead).toBe(true);

    // Replay the event via admin API service
    await dispatcher.replayEvent(companyId, deadEvent!.id);

    const [resetEvent] = await testDb
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.id, deadEvent!.id));

    expect(resetEvent?.isDead).toBe(false);
    expect(resetEvent?.attempts).toBe(0);
    expect(resetEvent?.processedAt).toBeNull();
    expect(resetEvent?.lastError).toBeNull();

    // Dispatcher should now process it successfully
    const result = await dispatcher.processBatch();
    expect(result.processedCount).toBeGreaterThanOrEqual(1);
    expect(replayedExecution).toBe(1);
  });

  it('6. Admin listEvents filters by status (pending, processed, dead)', async () => {
    const dispatcher = new OutboxDispatcherService();

    const allEvents = await dispatcher.listEvents(companyId, { page: 1, limit: 10, status: 'all' });
    expect(allEvents.items.length).toBeGreaterThan(0);
    expect(allEvents.pagination.total).toBeGreaterThan(0);

    const processedEvents = await dispatcher.listEvents(companyId, { status: 'processed' });
    expect(processedEvents.items.every(e => e.processedAt !== null)).toBe(true);
  });
});
