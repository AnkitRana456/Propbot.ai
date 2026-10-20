import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createTestCompany } from '../helpers/test-fixtures.js';
import { signedMetaPost } from '../helpers/meta-webhook.js';
import { chatbots, contacts, leads, whatsappConfigs, conversations } from '../../src/db/schema/index.js';
import { graphApiVersion } from '../../src/modules/whatsapp/whatsapp.adapter.js';
import { whatsappService } from '../../src/modules/whatsapp/whatsapp.service.js';

describe('Phase 6: WhatsApp Cloud API', () => {
  const app = createApp();
  let companyId: string;
  let botId: string;
  const phoneNumberId = `pn_${Date.now()}`;
  const verifyToken = `verify_${Date.now()}`;
  const ownSecret = 'per_company_app_secret_123456';
  const savedSecret = process.env.META_APP_SECRET;

  const payload = (from: string, id: string, text: string, profile = 'Priya Menon') => ({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '919800000000', phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: profile }, wa_id: from }],
              messages: [
                { from, id, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: text } },
              ],
            },
          },
        ],
      },
    ],
  });

  beforeAll(async () => {
    delete process.env.META_APP_SECRET;
    const company = await createTestCompany();
    companyId = company.id;
    const [bot] = await testDb
      .insert(chatbots)
      .values({ companyId, name: 'WA Bot', type: 'whatsapp', status: 'active', publicKey: `pb_wa6_${Date.now()}` })
      .returning();
    botId = bot!.id;
    await testDb.insert(whatsappConfigs).values({
      companyId,
      chatbotId: botId,
      phoneNumberId,
      businessPhoneNumber: '+919800000000',
      accessToken: 'EAAG_test',
      verifyToken,
      status: 'connected',
      enableAutomation: false, // no AI reply needed for these assertions
      aiAutoReplies: false,
    });
  });

  afterAll(async () => {
    if (savedSecret !== undefined) process.env.META_APP_SECRET = savedSecret;
    await cleanupTestDatabase([companyId]);
  });

  afterEach(() => {
    delete process.env.META_APP_SECRET;
  });

  it('GET verification handshake echoes hub.challenge only for the right hub.verify_token', async () => {
    const ok = await request(app)
      .get('/api/webhooks/meta')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': verifyToken, 'hub.challenge': 'abc123' });
    expect(ok.status).toBe(200);
    expect(ok.text).toBe('abc123');

    const bad = await request(app)
      .get('/api/webhooks/meta')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'abc123' });
    expect(bad.status).toBe(403);
  });

  it('refuses unsigned deliveries when no app secret is configured anywhere (no silent skip)', async () => {
    const res = await request(app).post('/api/webhooks/meta').send(payload('919811111111', 'wamid.nosecret1', 'hello'));
    expect(res.status).toBe(401);
    const created = await testDb.select().from(contacts).where(eq(contacts.companyId, companyId));
    expect(created).toHaveLength(0);
  });

  it('accepts a correctly signed delivery using META_APP_SECRET, and rejects a wrongly signed one', async () => {
    process.env.META_APP_SECRET = ownSecret;
    const bad = await signedMetaPost(app, payload('919811111112', 'wamid.badsig', 'hello'), 'not-the-secret');
    expect(bad.status).toBe(401);
    const good = await signedMetaPost(app, payload('919811111112', 'wamid.goodsig', 'hello'), ownSecret);
    expect(good.status).toBe(200);
    expect(good.body.processedCount).toBe(1);
  });

  it('first-time sender becomes "WhatsApp User <last4>" with source whatsapp and keeps the profile name as metadata', async () => {
    process.env.META_APP_SECRET = ownSecret;
    const res = await signedMetaPost(app, payload('919822223333', 'wamid.first1', 'Hi there'), ownSecret);
    expect(res.status).toBe(200);

    const contact = await testDb.query.contacts.findFirst({
      where: and(eq(contacts.companyId, companyId), eq(contacts.phone, '+919822223333')),
    });
    expect(`${contact!.firstName} ${contact!.lastName}`).toBe('WhatsApp User 3333');
    const lead = await testDb.query.leads.findFirst({ where: eq(leads.contactId, contact!.id) });
    expect(lead!.source).toBe('whatsapp');
    expect(lead!.customFields).toMatchObject({ whatsappProfileName: 'Priya Menon' });
  });

  it('a later message never overwrites a real name already on file', async () => {
    process.env.META_APP_SECRET = ownSecret;
    const contact = await testDb.query.contacts.findFirst({
      where: and(eq(contacts.companyId, companyId), eq(contacts.phone, '+919822223333')),
    });
    await testDb.update(contacts).set({ firstName: 'Priya', lastName: 'Menon' }).where(eq(contacts.id, contact!.id));

    const res = await signedMetaPost(app, payload('919822223333', 'wamid.second1', 'Any update?'), ownSecret);
    expect(res.status).toBe(200);
    const after = await testDb.query.contacts.findFirst({ where: eq(contacts.id, contact!.id) });
    expect(`${after!.firstName} ${after!.lastName}`).toBe('Priya Menon');
    const leadRows = await testDb.select().from(leads).where(eq(leads.contactId, contact!.id));
    expect(leadRows).toHaveLength(1); // still one lead
    expect(leadRows[0]!.visitCount).toBe(2);
  });

  it('accepts senders from countries outside the validation table (generic E.164) without crashing', async () => {
    process.env.META_APP_SECRET = ownSecret;
    const res = await signedMetaPost(app, payload('4915112345678', 'wamid.de1', 'Hallo', 'Hans'), ownSecret);
    expect(res.status).toBe(200);
    const contact = await testDb.query.contacts.findFirst({
      where: and(eq(contacts.companyId, companyId), eq(contacts.phone, '+4915112345678')),
    });
    expect(contact).toBeDefined();
  });

  it('frustrated WhatsApp messages flag the conversation for a human (shared detector)', async () => {
    process.env.META_APP_SECRET = ownSecret;
    await testDb.update(whatsappConfigs).set({ frustrationHandoff: true }).where(eq(whatsappConfigs.companyId, companyId));
    const res = await signedMetaPost(app, payload('919833334444', 'wamid.angry1', 'this is USELESS!! not working'), ownSecret);
    expect(res.status).toBe(200);
    const contact = await testDb.query.contacts.findFirst({
      where: and(eq(contacts.companyId, companyId), eq(contacts.phone, '+919833334444')),
    });
    const conv = await testDb.query.conversations.findFirst({ where: eq(conversations.contactId, contact!.id) });
    expect(conv!.status).toBe('needs_human');
  });

  it('Graph API version is an env var with a safe default', () => {
    const prev = process.env.META_GRAPH_API_VERSION;
    try {
      delete process.env.META_GRAPH_API_VERSION;
      expect(graphApiVersion()).toBe('v21.0');
      process.env.META_GRAPH_API_VERSION = 'v22.0';
      expect(graphApiVersion()).toBe('v22.0');
      process.env.META_GRAPH_API_VERSION = 'not-a-version/../x';
      expect(graphApiVersion()).toBe('v21.0'); // never interpolates junk into the URL
    } finally {
      if (prev === undefined) delete process.env.META_GRAPH_API_VERSION;
      else process.env.META_GRAPH_API_VERSION = prev;
    }
  });

  it('the demo sandbox connector (mock tokens, fixed phone-number id) is disabled in production', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(whatsappService.quickConnectSandbox(companyId)).rejects.toMatchObject({ statusCode: 403 });
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
