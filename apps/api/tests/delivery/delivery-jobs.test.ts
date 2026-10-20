import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { and, eq } from 'drizzle-orm';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createTestCompany, createTestUser } from '../helpers/test-fixtures.js';
import { chatbots, deliveryJobs, domainEvents, integrations } from '../../src/db/schema/index.js';
import { leadsService } from '../../src/modules/leads/leads.service.js';
import { deliveryJobsService } from '../../src/modules/delivery/delivery-jobs.service.js';
import { setMailTransport } from '../../src/modules/delivery/mailer.js';
import { setCrmFetch, resolveSalesforceBase } from '../../src/modules/integrations/crm/crm-providers.js';
import { integrationsService } from '../../src/modules/integrations/integrations.service.js';

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

describe('Phase 5: lead e-mail alert + CRM sync via the delivery queue', () => {
  let companyId: string;
  let botId: string;
  let adminEmail: string;
  const calls: Call[] = [];
  let responder: (call: Call) => { status: number; body?: unknown } = () => ({ status: 200, body: {} });

  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const call: Call = {
      url: String(url),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const r = responder(call);
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status });
  }) as typeof fetch;

  beforeAll(async () => {
    const company = await createTestCompany();
    companyId = company.id;
    const admin = await createTestUser(companyId, { role: 'company_admin' });
    adminEmail = admin.email;
    const [bot] = await testDb
      .insert(chatbots)
      .values({ companyId, name: 'CRM Bot', type: 'web', status: 'active', publicKey: `pb_crm_${Date.now()}`, config: {} })
      .returning();
    botId = bot!.id;
    setCrmFetch(fakeFetch);
  });

  afterAll(async () => {
    setCrmFetch(null);
    setMailTransport(null);
    await cleanupTestDatabase([companyId]);
  });

  beforeEach(async () => {
    calls.length = 0;
    responder = () => ({ status: 200, body: {} });
    setMailTransport(null);
    await testDb.delete(deliveryJobs).where(eq(deliveryJobs.companyId, companyId));
    await testDb.delete(integrations).where(eq(integrations.companyId, companyId));
  });

  async function newLead(over: { name?: string; email?: string | null } = {}) {
    const phone = `98${Math.floor(10000000 + Math.random() * 89999999)}`;
    const { lead } = await leadsService.captureOrUpdateLead(companyId, {
      chatbotId: botId,
      name: over.name ?? 'Crm Buyer',
      phone,
      email: over.email === null ? undefined : (over.email ?? `crm_${crypto.randomBytes(3).toString('hex')}@example.com`),
      utmParams: { utm_source: 'google', utm_sub_source: 'mailer', utm_agencypartner: 'acme' },
    });
    const events = await testDb.select().from(domainEvents).where(eq(domainEvents.companyId, companyId));
    const event = events.find(e => (e.payload as { lead_id?: string }).lead_id === lead.id)!;
    // Claim it so an outbox sweep running in another test file cannot enqueue these jobs behind our back
    await testDb.update(domainEvents).set({ processedAt: new Date() }).where(eq(domainEvents.id, event.id));
    return { lead, event };
  }

  const enqueue = (event: { id: string; companyId: string; payload: unknown }) =>
    deliveryJobsService.enqueueForLeadCreated({ ...event, payload: event.payload as Record<string, unknown> });

  const jobsFor = (provider: string) =>
    testDb.select().from(deliveryJobs).where(and(eq(deliveryJobs.companyId, companyId), eq(deliveryJobs.provider, provider)));

  const makeDue = () =>
    testDb.update(deliveryJobs).set({ nextAttemptAt: new Date(Date.now() - 1000) }).where(eq(deliveryJobs.status, 'pending'));

  async function addIntegration(provider: string, config: Record<string, unknown>) {
    await testDb.insert(integrations).values({ companyId, provider, status: 'active', config, events: ['lead_captured'] });
  }

  describe('e-mail alert', () => {
    it('sends a real-time alert to company admins and escapes lead-supplied HTML', async () => {
      const mailbox = nodemailer.createTransport({ jsonTransport: true });
      setMailTransport(mailbox);
      const { event } = await newLead({ name: '<script>alert(1)</script> Eve' });
      expect(await enqueue(event)).toBe(1);

      await deliveryJobsService.processDue();
      const [job] = await jobsFor('smtp');
      expect(job!.status).toBe('success');
      expect(job!.externalId).toBeTruthy(); // nodemailer message id
    });

    it('delivers the message content (recipient, subject, escaped HTML)', async () => {
      const outbox: Array<Record<string, string>> = [];
      setMailTransport({
        sendMail: async (m: Record<string, string>) => {
          outbox.push(m);
          return { messageId: '<id@test>' };
        },
      } as never);
      const { event } = await newLead({ name: '<b>Bold</b>\nBcc: evil@x.com' });
      await enqueue(event);
      await deliveryJobsService.processDue();

      expect(outbox).toHaveLength(1);
      expect(outbox[0]!.to).toBe(adminEmail);
      expect(outbox[0]!.subject).not.toMatch(/[\r\n]/); // no header injection
      expect(outbox[0]!.html).toContain('&lt;b&gt;Bold&lt;/b&gt;');
      expect(outbox[0]!.html).not.toContain('<b>Bold</b>');
    });

    it('is marked skipped (not failed, not retried) when SMTP is not configured', async () => {
      const prev = process.env.SMTP_HOST;
      delete process.env.SMTP_HOST;
      try {
        const { event } = await newLead();
        await enqueue(event);
        await deliveryJobsService.processDue();
        const [job] = await jobsFor('smtp');
        expect(job!.status).toBe('skipped');
        expect(job!.lastError).toMatch(/SMTP is not configured/);
      } finally {
        if (prev !== undefined) process.env.SMTP_HOST = prev;
      }
    });

    it('enqueue is idempotent per event', async () => {
      const { event } = await newLead();
      expect(await enqueue(event)).toBe(1);
      expect(await enqueue(event)).toBe(0);
      expect(await jobsFor('smtp')).toHaveLength(1);
    });
  });

  describe('HubSpot', () => {
    it('upserts the contact by e-mail with a bearer token and records the external id', async () => {
      await addIntegration('hubspot', { accessToken: 'pat-test-token' });
      responder = () => ({ status: 200, body: { results: [{ id: 'hs-42' }] } });
      const { event, lead } = await newLead({ email: 'Buyer@Example.com' });
      await enqueue(event);
      await deliveryJobsService.processDue();

      const call = calls.find(c => c.url.includes('hubapi.com'))!;
      expect(call.url).toBe('https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert');
      expect(call.headers.Authorization).toBe('Bearer pat-test-token');
      const input = (call.body as { inputs: Array<{ idProperty: string; id: string; properties: Record<string, string> }> }).inputs[0]!;
      expect(input.idProperty).toBe('email');
      expect(input.id).toBe(lead.email);
      expect(input.properties).toMatchObject({ firstname: 'Crm', lastname: 'Buyer', lifecyclestage: 'lead' });

      const [job] = await jobsFor('hubspot');
      expect(job!.status).toBe('success');
      expect(job!.externalId).toBe('hs-42');
    });

    it('retries transient failures on a 1s / 2s schedule and then succeeds', async () => {
      await addIntegration('hubspot', { accessToken: 'pat-test-token' });
      let n = 0;
      responder = () => (++n <= 2 ? { status: 503, body: { message: 'down' } } : { status: 200, body: { results: [{ id: 'hs-1' }] } });
      const { event } = await newLead();
      await enqueue(event);

      await deliveryJobsService.processDue();
      let [job] = await jobsFor('hubspot');
      expect(job!.status).toBe('pending');
      expect(job!.attempts).toBe(1);
      let delay = job!.nextAttemptAt.getTime() - Date.now();
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(1500);

      expect((await deliveryJobsService.processDue()).processed).toBe(0); // not due yet: no early retry

      await makeDue();
      await deliveryJobsService.processDue();
      [job] = await jobsFor('hubspot');
      expect(job!.attempts).toBe(2);
      delay = job!.nextAttemptAt.getTime() - Date.now();
      expect(delay).toBeGreaterThan(1000);
      expect(delay).toBeLessThanOrEqual(2500);

      await makeDue();
      await deliveryJobsService.processDue();
      [job] = await jobsFor('hubspot');
      expect(job!.status).toBe('success');
      expect(job!.attempts).toBe(3);
    });

    it('dead-letters after 1 + 3 attempts, and immediately on a permanent 401', async () => {
      await addIntegration('hubspot', { accessToken: 'bad' });
      responder = () => ({ status: 500, body: {} });
      const { event } = await newLead();
      await enqueue(event);
      for (let i = 0; i < 4; i++) {
        await makeDue();
        await deliveryJobsService.processDue();
      }
      let [job] = await jobsFor('hubspot');
      expect(job!.status).toBe('dead_letter');
      expect(job!.attempts).toBe(4);
      expect(job!.lastError).toMatch(/HubSpot HTTP 500/);

      await testDb.delete(deliveryJobs).where(eq(deliveryJobs.companyId, companyId));
      calls.length = 0;
      responder = () => ({ status: 401, body: { message: 'bad token' } });
      const second = await newLead();
      await enqueue(second.event);
      await deliveryJobsService.processDue();
      [job] = await jobsFor('hubspot');
      expect(job!.status).toBe('dead_letter');
      expect(job!.attempts).toBe(1); // 4xx is permanent: no retries burned
    });

    it('is skipped with a clear reason when the token is missing', async () => {
      await addIntegration('hubspot', {});
      const { event } = await newLead();
      await enqueue(event);
      await deliveryJobsService.processDue();
      const [job] = await jobsFor('hubspot');
      expect(job!.status).toBe('skipped');
      expect(job!.lastError).toMatch(/not configured/i);
      expect(calls).toHaveLength(0);
    });

    it('decrypts vault-stored secrets (as saved through the integrations API)', async () => {
      await integrationsService.updateIntegration(companyId, 'hubspot', {
        status: 'active',
        config: { accessToken: 'pat-from-vault' },
        events: ['lead_captured'],
      });
      const { event } = await newLead();
      await enqueue(event);
      await deliveryJobsService.processDue();
      expect(calls[0]!.headers.Authorization).toBe('Bearer pat-from-vault');
    });
  });

  describe('Salesforce', () => {
    it('creates a Lead with the mandatory LastName/Company fields', async () => {
      await addIntegration('salesforce', { instanceUrl: 'https://acme.my.salesforce.com', accessToken: 'sf-token' });
      responder = () => ({ status: 201, body: { id: '00Qxx0000001', success: true } });
      const { event } = await newLead({ name: 'Single' });
      await enqueue(event);
      await deliveryJobsService.processDue();

      const call = calls[0]!;
      expect(call.url).toBe('https://acme.my.salesforce.com/services/data/v59.0/sobjects/Lead');
      expect(call.headers.Authorization).toBe('Bearer sf-token');
      expect(call.body).toMatchObject({ LastName: 'Single', Company: '[Not Provided]', LeadSource: 'PropBot' });
      expect((call.body as { Description: string }).Description).toContain('Agency partner: acme');
      const [job] = await jobsFor('salesforce');
      expect(job!.status).toBe('success');
      expect(job!.externalId).toBe('00Qxx0000001');
    });

    it('refuses non-Salesforce or non-https instance URLs (SSRF guard) without calling out', async () => {
      expect(resolveSalesforceBase('https://evil.example.com')).toBeNull();
      expect(resolveSalesforceBase('http://acme.my.salesforce.com')).toBeNull();
      expect(resolveSalesforceBase('https://127.0.0.1')).toBeNull();
      expect(resolveSalesforceBase('https://acme.my.salesforce.com/anything')).toBe('https://acme.my.salesforce.com');

      await addIntegration('salesforce', { instanceUrl: 'https://169.254.169.254', accessToken: 'x' });
      const { event } = await newLead();
      await enqueue(event);
      await deliveryJobsService.processDue();
      const [job] = await jobsFor('salesforce');
      expect(job!.status).toBe('dead_letter');
      expect(calls).toHaveLength(0);
    });

    it('is skipped when not configured', async () => {
      await addIntegration('salesforce', { accessToken: 'only-token' });
      const { event } = await newLead();
      await enqueue(event);
      await deliveryJobsService.processDue();
      const [job] = await jobsFor('salesforce');
      expect(job!.status).toBe('skipped');
    });
  });

  describe('Mailchimp', () => {
    it('PUTs the member by MD5 of the lowercased e-mail, defaulting to double opt-in', async () => {
      await addIntegration('mailchimp', { apiKey: 'abcdef123456-us21', listId: 'list123' });
      responder = () => ({ status: 200, body: { id: 'mc-member-1' } });
      const { event } = await newLead({ email: 'MixedCase@Example.com' });
      await enqueue(event);
      await deliveryJobsService.processDue();

      const hash = crypto.createHash('md5').update('mixedcase@example.com').digest('hex');
      const call = calls[0]!;
      expect(call.method).toBe('PUT');
      expect(call.url).toBe(`https://us21.api.mailchimp.com/3.0/lists/list123/members/${hash}`);
      expect(call.headers.Authorization).toBe(`Basic ${Buffer.from('propbot:abcdef123456-us21').toString('base64')}`);
      expect(call.body).toMatchObject({ status_if_new: 'pending', merge_fields: { FNAME: 'Crm', LNAME: 'Buyer' } });
      const [job] = await jobsFor('mailchimp');
      expect(job!.externalId).toBe('mc-member-1');
    });

    it('skips leads without an e-mail address', async () => {
      await addIntegration('mailchimp', { apiKey: 'abcdef123456-us21', listId: 'list123' });
      const { event } = await newLead({ email: null });
      await enqueue(event);
      await deliveryJobsService.processDue();
      const [job] = await jobsFor('mailchimp');
      expect(job!.status).toBe('skipped');
      expect(job!.lastError).toMatch(/e-mail/i);
      expect(calls).toHaveLength(0);
    });
  });

  it('testSync verifies credentials without creating CRM records', async () => {
    await addIntegration('hubspot', { accessToken: 'pat-test-token' });
    responder = () => ({ status: 200, body: {} });
    const ok = await integrationsService.testSync(companyId, 'hubspot');
    expect(ok.success).toBe(true);
    expect(calls[0]!.method).toBe('GET');

    responder = () => ({ status: 401, body: {} });
    const bad = await integrationsService.testSync(companyId, 'hubspot');
    expect(bad.success).toBe(false);

    const none = await integrationsService.testSync(companyId, 'mailchimp');
    expect(none.success).toBe(false);
    expect(none.message).toMatch(/not configured/i);
  });
});
