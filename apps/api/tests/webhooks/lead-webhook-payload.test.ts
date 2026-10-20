import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { eq } from 'drizzle-orm';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createTestCompany } from '../helpers/test-fixtures.js';
import { chatbots, domainEvents, webhookEndpoints, webhookLogs } from '../../src/db/schema/index.js';
import { leadsService } from '../../src/modules/leads/leads.service.js';
import { outboxProcessorService } from '../../src/modules/webhooks/outbox-processor.service.js';
import { flattenLeadPayload } from '../../src/modules/webhooks/lead-webhook-payload.js';

describe('lead_captured webhook payload (flat, PascalCase UTMs)', () => {
  it('maps UTMs exactly as specced, with SharedURL mirroring sub_source', () => {
    const flat = flattenLeadPayload({
      lead: {
        id: 'L1',
        chatbotId: 'B1',
        source: 'chat',
        phoneVerified: true,
        visitCount: 2,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        lastSeenAt: new Date('2026-01-02T00:00:00Z'),
        pageUrl: 'https://x.test/p',
        utmParams: {
          utm_source: 'google',
          utm_medium: 'cpc',
          utm_campaign: 'spring',
          utm_sub_source: 'newsletter',
          utm_agencypartner: 'acme',
        },
      },
      contact: { firstName: 'Asha', lastName: 'Patel', phone: '+919876543210', email: 'a@b.com' },
      chatbotName: 'Bot',
    });
    expect(flat).toMatchObject({
      Name: 'Asha Patel',
      Phone: '+919876543210',
      Email: 'a@b.com',
      UTMSource: 'google',
      UTMMedium: 'cpc',
      UTMCampaign: 'spring',
      UTMSubSource: 'newsletter',
      SharedURL: 'newsletter',
      UTMAgencyPartner: 'acme',
      UTMTerm: '',
      UTMContent: '',
    });
    // Flat: no nested objects at the root
    expect(Object.values(flat).every(v => typeof v !== 'object')).toBe(true);
  });

  describe('delivery', () => {
    let companyId: string;
    let botId: string;
    const servers: http.Server[] = [];
    const received: { path: string; body: string; at: number }[] = [];

    const startServer = (delayMs: number, path: string) =>
      new Promise<number>(resolve => {
        const srv = http.createServer((req, res) => {
          let body = '';
          req.on('data', c => (body += c));
          req.on('end', () => {
            setTimeout(() => {
              received.push({ path, body, at: Date.now() });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end('{}');
            }, delayMs);
          });
        });
        servers.push(srv);
        srv.listen(0, '127.0.0.1', () => resolve((srv.address() as { port: number }).port));
      });

    beforeAll(async () => {
      const company = await createTestCompany();
      companyId = company.id;
      const [bot] = await testDb
        .insert(chatbots)
        .values({ companyId, name: 'Hook Bot', type: 'web', status: 'active', publicKey: `pb_hook_${Date.now()}`, config: {} })
        .returning();
      botId = bot!.id;
      const slow = await startServer(600, '/slow');
      const fast = await startServer(0, '/fast');
      await testDb.insert(webhookEndpoints).values([
        { companyId, name: 'slow', url: `http://127.0.0.1:${slow}/slow`, secret: 'whsec_slow_secret_123456', subscribedEvents: ['lead_captured'], isActive: true },
        { companyId, name: 'fast', url: `http://127.0.0.1:${fast}/fast`, secret: 'whsec_fast_secret_123456', subscribedEvents: ['lead_captured'], isActive: true },
      ]);
    });

    afterAll(async () => {
      await Promise.all(servers.map(s => new Promise<void>(r => s.close(() => r()))));
      await cleanupTestDatabase([companyId]);
    });

    it('delivers real lead data in parallel to every enabled endpoint and logs each', async () => {
      const { lead } = await leadsService.captureOrUpdateLead(companyId, {
        chatbotId: botId,
        name: 'Webhook Buyer',
        phone: '9870000021',
        email: 'wb@example.com',
        utmParams: { utm_source: 'meta', utm_sub_source: 'story', utm_agencypartner: 'zeta' },
      });
      // Drive the enqueue for exactly this lead's event (a concurrent sweep in another file may have
      // claimed the event already; claiming is idempotent only per consumer, so mark it processed first).
      const [evt] = await testDb.select().from(domainEvents).where(eq(domainEvents.companyId, companyId));
      await testDb.update(domainEvents).set({ processedAt: new Date() }).where(eq(domainEvents.id, evt!.id));
      await outboxProcessorService.processSingleEventWebhooks(evt!.id, companyId, 'lead_created', evt!.payload as Record<string, unknown>);
      expect(lead.id).toBeTruthy();

      const started = Date.now();
      const { retriedCount } = await outboxProcessorService.processScheduledRetries(25, companyId);
      const elapsed = Date.now() - started;
      expect(retriedCount).toBe(2);
      expect(received).toHaveLength(2);
      // slow (600ms) + fast (0ms) in parallel, so well under the sequential sum plus overhead
      expect(elapsed).toBeLessThan(1500);

      for (const r of received) {
        const env = JSON.parse(r.body);
        expect(env.event).toBe('lead_captured');
        expect(env.data).toMatchObject({
          Name: 'Webhook Buyer',
          Phone: '+919870000021',
          Email: 'wb@example.com',
          UTMSource: 'meta',
          UTMSubSource: 'story',
          SharedURL: 'story',
          UTMAgencyPartner: 'zeta',
          Source: 'chat',
        });
      }

      const logs = await testDb.select().from(webhookLogs).where(eq(webhookLogs.companyId, companyId));
      expect(logs).toHaveLength(2);
      for (const l of logs) {
        expect(l.status).toBe('success');
        expect(l.statusCode).toBe(200);
        expect(l.durationMs).not.toBeNull();
        expect(l.responseBody).toBe('{}');
        expect(l.requestPayload).toBeTruthy();
      }
    });
  });
});
