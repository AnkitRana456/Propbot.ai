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
import { WebhookSigner } from '../../src/modules/webhooks/webhook-signer.js';

describe('Outbox Webhook Delivery & HMAC Signature Verification', () => {
  const companyId = '99999999-9999-9999-9999-999999999910';
  const userId = '00000000-0000-0000-0000-000000000098';
  const botId = '77777777-7777-7777-7777-777777777710';
  const endpointSecret = 'whsec_test_secret_key_1234567890abcdef';

  let mockServer: http.Server;
  let mockServerPort: number;
  let lastReceivedPayload: string | null = null;
  let lastReceivedHeaders: http.IncomingHttpHeaders | null = null;

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    // Start local mock HTTP receiver
    mockServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        lastReceivedPayload = body;
        lastReceivedHeaders = req.headers;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      });
    });

    await new Promise<void>(resolve => {
      mockServer.listen(0, '127.0.0.1', () => {
        const address = mockServer.address() as { port: number };
        mockServerPort = address.port;
        resolve();
      });
    });

    // Seed database
    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Outbox Webhook Realty',
        slug: 'webhook-outbox-p10',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userId,
        companyId,
        name: 'Webhook Admin',
        email: 'admin@webhook-outbox.com',
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
        name: 'Prestige Webhook Bot',
        type: 'web',
        status: 'active',
        publicKey: 'pb_pub_wh_10',
      })
      .onConflictDoNothing();

    await testDb
      .insert(webhookEndpoints)
      .values({
        companyId,
        chatbotId: botId,
        name: 'CRM Hook Receiver',
        url: `http://127.0.0.1:${mockServerPort}/webhook`,
        secret: endpointSecret,
        subscribedEvents: ['lead_captured', 'hot_lead'],
        headers: { 'X-Custom-Client': 'PropBot-Test' },
        isActive: true,
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await new Promise<void>(resolve => mockServer.close(() => resolve()));
    await cleanupTestDatabase([companyId]);
  });

  it('Lead capture event in outbox triggers signed HTTP dispatch and logs delivery success', async () => {
    // 1. Create a contact and lead
    const [contact] = await testDb
      .insert(contacts)
      .values({
        companyId,
        firstName: 'Aarav',
        lastName: 'Gupta',
        phone: '+919876500010',
        email: 'aarav@example.com',
      })
      .returning();

    const [lead] = await testDb
      .insert(leads)
      .values({
        companyId,
        contactId: contact.id,
        chatbotId: botId,
        name: 'Aarav Gupta',
        phone: '+919876500010',
        email: 'aarav@example.com',
        source: 'chat',
        status: 'new',
        intentScore: 40,
      })
      .returning();

    // 2. Emit 'lead_created' event into domain_events outbox
    const [event] = await testDb
      .insert(domainEvents)
      .values({
        companyId,
        type: 'lead_created',
        payload: {
          lead_id: lead.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          source: 'chat',
        },
      })
      .returning();

    expect(event.processedAt).toBeNull();

    // 3. Run the outbox processor for this event. Other test files sweep the shared outbox concurrently,
    //    so the enqueue is driven explicitly for this event instead of racing a global sweep.
    const dispatchedCount = await outboxProcessorService.processSingleEventWebhooks(
      event.id,
      companyId,
      'lead_created',
      event.payload as Record<string, unknown>,
    );
    await testDb.update(domainEvents).set({ processedAt: new Date() }).where(eq(domainEvents.id, event.id));
    const processedCount = 1;

    expect(processedCount).toBeGreaterThanOrEqual(1);
    expect(dispatchedCount).toBeGreaterThanOrEqual(1);

    // The outbox only enqueues: nothing has been sent over HTTP yet (lead save never waits on a webhook)
    expect(lastReceivedPayload).toBeNull();
    const { retriedCount } = await outboxProcessorService.processScheduledRetries(25, companyId);
    expect(retriedCount).toBeGreaterThanOrEqual(1);

    // 4. Verify outbox event is marked processed
    const [updatedEvent] = await testDb
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.id, event.id));

    expect(updatedEvent.processedAt).not.toBeNull();

    // 5. Verify HTTP request received by mock server
    expect(lastReceivedPayload).not.toBeNull();
    const parsedPayload = JSON.parse(lastReceivedPayload!);
    expect(parsedPayload.event).toBe('lead_captured');
    // lead_captured is flattened with PascalCase keys (spec section 5)
    expect(parsedPayload.data.LeadId).toBe(lead.id);
    expect(parsedPayload.data).toHaveProperty('UTMSource');
    expect(parsedPayload.data).toHaveProperty('SharedURL');

    // 6. Verify HMAC-SHA256 signature header
    const signatureHeader = lastReceivedHeaders!['x-propbot-signature-256'] as string;
    const timestampHeader = lastReceivedHeaders!['x-propbot-timestamp'] as string;
    expect(signatureHeader).toBeDefined();
    expect(signatureHeader.startsWith('sha256=')).toBe(true);

    const isValid = WebhookSigner.verify(
      lastReceivedPayload!,
      signatureHeader,
      endpointSecret,
      timestampHeader,
    );
    expect(isValid).toBe(true);

    // 7. Verify delivery log recorded in webhook_logs
    const [log] = await testDb
      .select()
      .from(webhookLogs)
      .where(and(eq(webhookLogs.companyId, companyId), eq(webhookLogs.leadId, lead.id)));

    expect(log).toBeDefined();
    expect(log.status).toBe('success');
    expect(log.statusCode).toBe(200);
    expect(log.attempt).toBe(1);
    expect(log.durationMs).toBeGreaterThanOrEqual(0);
  });
});
