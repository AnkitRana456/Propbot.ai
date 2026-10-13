import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  chatbots,
  leads,
  contacts,
  domainEvents,
  webhookEndpoints,
  webhookLogs,
} from '../../src/db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { outboxProcessorService } from '../../src/modules/webhooks/outbox-processor.service.js';
import { webhooksService } from '../../src/modules/webhooks/webhooks.service.js';

describe('Webhook 3-Attempt Retry Policy & Dead-Letter Handling', () => {
  const companyId = '99999999-9999-9999-9999-999999999911';
  const userId = '00000000-0000-0000-0000-000000000099';
  const botId = '77777777-7777-7777-7777-777777777711';
  const endpointSecret = 'whsec_retry_test_secret_abcdef123456';

  let mockFailingServer: http.Server;
  let mockPort: number;
  let requestAttempts = 0;
  let shouldFail = true;

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    // Start mock server that responds with 500 when shouldFail is true
    mockFailingServer = http.createServer((_req, res) => {
      requestAttempts++;
      if (shouldFail) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'recovered' }));
      }
    });

    await new Promise<void>(resolve => {
      mockFailingServer.listen(0, '127.0.0.1', () => {
        const address = mockFailingServer.address() as { port: number };
        mockPort = address.port;
        resolve();
      });
    });

    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Retry Policy Realty',
        slug: 'webhook-retry-p10',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userId,
        companyId,
        name: 'Retry Admin',
        email: 'admin@webhook-retry.com',
        role: 'company_admin',
        status: 'active',
        passwordHash: 'dummy',
      })
      .onConflictDoNothing();

    await testDb
      .insert(chatbots)
      .values({
        id: botId,
        companyId,
        name: 'Prestige Retry Bot',
        type: 'web',
        status: 'active',
        publicKey: 'pb_pub_wh_11',
      })
      .onConflictDoNothing();

    await testDb
      .insert(webhookEndpoints)
      .values({
        companyId,
        chatbotId: botId,
        name: 'Failing Third-Party Endpoint',
        url: `http://127.0.0.1:${mockPort}/fail-hook`,
        secret: endpointSecret,
        subscribedEvents: ['lead_captured'],
        isActive: true,
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await new Promise<void>(resolve => mockFailingServer.close(() => resolve()));
    await cleanupTestDatabase([companyId]);
  });

  it('Failing endpoint retries up to 3 times with exponential backoff and transitions to dead_letter', async () => {
    // 1. Create contact and lead and emit domain event
    const [contact] = await testDb
      .insert(contacts)
      .values({
        companyId,
        firstName: 'Deepak',
        lastName: 'Varma',
        phone: '+919876500011',
      })
      .returning();

    const [lead] = await testDb
      .insert(leads)
      .values({
        companyId,
        contactId: contact.id,
        chatbotId: botId,
        name: 'Deepak Varma',
        phone: '+919876500011',
        source: 'chat',
      })
      .returning();

    await testDb.insert(domainEvents).values({
      companyId,
      type: 'lead_created',
      payload: { lead_id: lead.id, name: lead.name, phone: lead.phone },
    });

    // Attempt 1: Initial dispatch via outbox
    await outboxProcessorService.processPendingEvents();

    const [log1] = await testDb
      .select()
      .from(webhookLogs)
      .where(and(eq(webhookLogs.companyId, companyId), eq(webhookLogs.leadId, lead.id)));

    expect(log1).toBeDefined();
    expect(log1.attempt).toBe(1);
    expect(log1.status).toBe('retrying');
    expect(log1.statusCode).toBe(500);
    expect(log1.nextRetryAt).toBeDefined();

    // Fast-forward next_retry_at to past so scheduled retry fires
    await testDb
      .update(webhookLogs)
      .set({ nextRetryAt: new Date(Date.now() - 1000) })
      .where(eq(webhookLogs.id, log1.id));

    // Attempt 2: Scheduled retry 1
    const { retriedCount: retry1Count } = await outboxProcessorService.processScheduledRetries();
    expect(retry1Count).toBe(1);

    const [log2] = await testDb
      .select()
      .from(webhookLogs)
      .where(eq(webhookLogs.id, log1.id));

    expect(log2.attempt).toBe(2);
    expect(log2.status).toBe('retrying');

    // Fast-forward next_retry_at again
    await testDb
      .update(webhookLogs)
      .set({ nextRetryAt: new Date(Date.now() - 1000) })
      .where(eq(webhookLogs.id, log1.id));

    // Attempt 3: Final attempt (reaches maxAttempts = 3)
    const { retriedCount: retry2Count } = await outboxProcessorService.processScheduledRetries();
    expect(retry2Count).toBe(1);

    const [log3] = await testDb
      .select()
      .from(webhookLogs)
      .where(eq(webhookLogs.id, log1.id));

    expect(log3.attempt).toBe(3);
    expect(log3.status).toBe('dead_letter');
    expect(log3.statusCode).toBe(500);

    // 2. Manual Replay when destination recovers
    shouldFail = false;
    const replayed = await webhooksService.replayWebhook(companyId, log3.id);
    expect(replayed.status).toBe('success');
    expect(replayed.statusCode).toBe(200);
    expect(requestAttempts).toBeGreaterThanOrEqual(3);
  });
});
