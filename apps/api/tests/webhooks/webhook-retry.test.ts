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

    // processedAt is set up front so a concurrent outbox sweep in another test file cannot enqueue it too;
    // this test drives the enqueue explicitly below.
    const [evt] = await testDb
      .insert(domainEvents)
      .values({
        companyId,
        type: 'lead_created',
        payload: { lead_id: lead.id, name: lead.name, phone: lead.phone },
        processedAt: new Date(),
      })
      .returning();

    const logsForLead = () =>
      testDb
        .select()
        .from(webhookLogs)
        .where(and(eq(webhookLogs.companyId, companyId), eq(webhookLogs.leadId, lead.id)))
        .orderBy(webhookLogs.attempt);
    const makeDue = () =>
      testDb
        .update(webhookLogs)
        .set({ nextRetryAt: new Date(Date.now() - 1000) })
        .where(and(eq(webhookLogs.leadId, lead.id), eq(webhookLogs.status, 'retrying')));

    // Outbox only enqueues the delivery (attempt 0, nothing sent yet)
    await outboxProcessorService.processSingleEventWebhooks(evt!.id, companyId, 'lead_created', {
      lead_id: lead.id,
      name: lead.name,
      phone: lead.phone,
    });
    const [queued] = await logsForLead();
    expect(queued!.attempt).toBe(0);
    expect(queued!.status).toBe('retrying');
    expect(requestAttempts).toBe(0);

    // Attempt 1 (initial): fails, retry scheduled ~1s out
    await outboxProcessorService.processScheduledRetries(25, companyId);
    let rows = await logsForLead();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.attempt).toBe(1);
    expect(rows[0]!.status).toBe('retrying');
    expect(rows[0]!.statusCode).toBe(500);
    const delay1 = rows[0]!.nextRetryAt!.getTime() - Date.now();
    expect(delay1).toBeGreaterThan(0);
    expect(delay1).toBeLessThanOrEqual(1500); // 1s backoff

    // Not due yet -> nothing is sent early
    const early = await outboxProcessorService.processScheduledRetries(25, companyId);
    expect(early.retriedCount).toBe(0);

    // Attempt 2 (retry 1): its own audit row, 2s backoff
    await makeDue();
    await outboxProcessorService.processScheduledRetries(25, companyId);
    rows = await logsForLead();
    expect(rows.map(r => r.attempt)).toEqual([1, 2]);
    expect(rows[0]!.status).toBe('failed');
    expect(rows[1]!.status).toBe('retrying');
    const delay2 = rows[1]!.nextRetryAt!.getTime() - Date.now();
    expect(delay2).toBeGreaterThan(1000);
    expect(delay2).toBeLessThanOrEqual(2500);

    // Attempt 3 (retry 2): 4s backoff
    await makeDue();
    await outboxProcessorService.processScheduledRetries(25, companyId);
    rows = await logsForLead();
    expect(rows.map(r => r.attempt)).toEqual([1, 2, 3]);
    const delay3 = rows[2]!.nextRetryAt!.getTime() - Date.now();
    expect(delay3).toBeGreaterThan(3000);
    expect(delay3).toBeLessThanOrEqual(4500);

    // Attempt 4 (retry 3): final -> dead_letter. 1 initial + 3 retries = 4 attempts, 4 audit rows.
    await makeDue();
    await outboxProcessorService.processScheduledRetries(25, companyId);
    rows = await logsForLead();
    expect(rows.map(r => r.attempt)).toEqual([1, 2, 3, 4]);
    expect(rows[3]!.status).toBe('dead_letter');
    expect(rows[3]!.statusCode).toBe(500);
    expect(rows[3]!.nextRetryAt).toBeNull();
    expect(requestAttempts).toBe(4);
    // Every attempt kept its payload (the envelope that was sent, with flattened data)
    for (const r of rows) {
      expect((r.requestPayload as { data: { LeadId: string } }).data.LeadId).toBe(lead.id);
    }

    // Dead-lettered rows are not retried again
    expect((await outboxProcessorService.processScheduledRetries(25, companyId)).retriedCount).toBe(0);

    // 2. Manual Replay when destination recovers
    shouldFail = false;
    const replayed = await webhooksService.replayWebhook(companyId, rows[3]!.id);
    expect(replayed.status).toBe('success');
    expect(replayed.statusCode).toBe(200);
  });
});
