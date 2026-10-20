import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser } from '../helpers/test-fixtures.js';
import { chatbots, contacts, contactIdentities, conversations, leads, messages, notifications, channelConnections, forms } from '../../src/db/schema/index.js';
import { encryptSecret, packEncryptedSecret } from '../../src/utils/crypto-vault.js';
import { parseCsv, mapLead } from '../../src/modules/lead-sources/lead-source-mappers.js';
import { templateVariables } from '../../src/modules/inbox/channels.service.js';
import { whatsappWindowExpired } from '../../src/modules/inbox/channel-dispatch.js';

describe('P4: omnichannel inbox, lead sources, channels', () => {
  const app = createApp();
  let a: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let b: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let agent: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let botId = '';
  let publicKey = '';
  const api = (method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, who = a) => request(app)[method](url).set('Authorization', who.authHeader);

  async function seedConversation(opts: { channel: string; first: string; phone: string; visitorAgoMs?: number; messagesText?: string[] }) {
    const [contact] = await testDb.insert(contacts).values({ companyId: a.company.id, firstName: opts.first, lastName: 'Test', phone: opts.phone, email: `${opts.first.toLowerCase()}@example.com` }).returning();
    const [conv] = await testDb.insert(conversations).values({ companyId: a.company.id, chatbotId: botId, contactId: contact!.id, channel: opts.channel, status: 'bot' }).returning();
    const when = new Date(Date.now() - (opts.visitorAgoMs ?? 60_000));
    for (const [i, text] of (opts.messagesText ?? ['Is the 3BHK available?']).entries()) {
      await testDb.insert(messages).values({ companyId: a.company.id, conversationId: conv!.id, senderType: 'visitor', content: text, createdAt: new Date(when.getTime() + i * 1000) });
    }
    return { conv: conv!, contact: contact! };
  }

  beforeAll(async () => {
    a = await createAuthenticatedUser('company_admin');
    b = await createAuthenticatedUser('company_admin');
    agent = await createAuthenticatedUser('agent', { id: a.company.id } as never);
    publicKey = `pb_omni_${crypto.randomBytes(5).toString('hex')}`;
    const [bot] = await testDb.insert(chatbots).values({ companyId: a.company.id, name: 'Omni Bot', type: 'web', status: 'active', publicKey, config: {} }).returning();
    botId = bot!.id;
  });
  afterAll(async () => {
    delete process.env.META_SOCIAL_VERIFY_TOKEN;
    await cleanupTestDatabase([a.company.id, b.company.id]);
  });

  describe('helpers', () => {
    it('parses CSV with quotes and CRLF', () => {
      const rows = parseCsv('Name,Phone,Note\r\n"Rao, Asha",+919800000010,"said ""hi"""\r\nVik,9800000011,\r\n');
      expect(rows).toEqual([
        { name: 'Rao, Asha', phone: '+919800000010', note: 'said "hi"' },
        { name: 'Vik', phone: '9800000011', note: '' },
      ]);
    });
    it('maps vendor payloads and finds aliases', () => {
      const meta = mapLead('meta_lead_ads', {}, { campaign_name: 'Diwali', field_data: [{ name: 'full_name', values: ['Asha Rao'] }, { name: 'phone_number', values: ['+919800000012'] }, { name: 'email', values: ['a@x.com'] }] });
      expect(meta).toMatchObject({ name: 'Asha Rao', phone: '+919800000012', email: 'a@x.com', utm: { utm_campaign: 'Diwali' } });
      const google = mapLead('google_ads', {}, { user_column_data: [{ column_id: 'FULL_NAME', string_value: 'Vik' }, { column_id: 'PHONE_NUMBER', string_value: '9800000013' }], campaign_id: '77' });
      expect(google).toMatchObject({ name: 'Vik', phone: '9800000013' });
      const portal = mapLead('99acres', {}, { buyer_name: 'Mira', buyer_mobile: '9800000014', project_name: 'Lakeside' });
      expect(portal).toMatchObject({ name: 'Mira', phone: '9800000014', location: 'Lakeside' });
      expect(mapLead('generic', {}, { name: 'No phone' })).toBeNull();
    });
    it('counts template variables and the WhatsApp window', () => {
      expect(templateVariables({ header: 'Hi {{1}}', body: 'Visit on {{2}} at {{2}}' })).toEqual([1, 2]);
      expect(whatsappWindowExpired(new Date(Date.now() - 23 * 3600_000))).toBe(false);
      expect(whatsappWindowExpired(new Date(Date.now() - 25 * 3600_000))).toBe(true);
      expect(whatsappWindowExpired(null)).toBe(true);
    });
  });

  describe('inbox', () => {
    let web: Awaited<ReturnType<typeof seedConversation>>;
    let wa: Awaited<ReturnType<typeof seedConversation>>;
    let waOld: Awaited<ReturnType<typeof seedConversation>>;

    beforeAll(async () => {
      web = await seedConversation({ channel: 'web', first: 'Webby', phone: '+919811100001', messagesText: ['hello', 'any 3BHK?'] });
      wa = await seedConversation({ channel: 'whatsapp', first: 'Wanda', phone: '+919811100002' });
      waOld = await seedConversation({ channel: 'whatsapp', first: 'Olga', phone: '+919811100003', visitorAgoMs: 30 * 3600_000 });
    });

    it('lists conversations newest first with awaiting-reply counts, and filters', async () => {
      const res = await api('get', '/api/inbox');
      expect(res.status).toBe(200);
      const names = res.body.data.items.map((i: { contactName: string }) => i.contactName);
      expect(names.slice(0, 2)).toEqual(['Webby Test', 'Wanda Test']);
      expect(res.body.data.items.find((i: { id: string }) => i.id === web.conv.id).awaitingReply).toBe(2);
      expect((await api('get', '/api/inbox').query({ channel: 'whatsapp' })).body.data.total).toBe(2);
      expect((await api('get', '/api/inbox').query({ search: 'olga' })).body.data.items).toHaveLength(1);
      expect((await api('get', '/api/inbox').query({ search: '%' })).body.data.items).toHaveLength(0); // wildcards are escaped
      expect((await api('get', '/api/inbox').query({ assignee: 'unassigned' })).body.data.total).toBe(3);
    });
    it('isolates tenants and permissions', async () => {
      expect((await api('get', '/api/inbox', b)).body.data.items).toEqual([]);
      expect((await api('get', `/api/inbox/${web.conv.id}`, b)).status).toBe(404);
      expect((await api('post', `/api/inbox/${web.conv.id}/reply`, b).send({ content: 'x' })).status).toBe(404);
    });
    it('shows detail with messages, window state and contact data', async () => {
      const d = (await api('get', `/api/inbox/${waOld.conv.id}`)).body.data;
      expect(d.messages).toHaveLength(1);
      expect(d.serviceWindowExpired).toBe(true);
      expect((await api('get', `/api/inbox/${wa.conv.id}`)).body.data.serviceWindowExpired).toBe(false);
      expect(d.contact.email).toBe('olga@example.com');
    });

    it('replying takes the conversation, pauses the AI, records first response and delivers', async () => {
      const res = await api('post', `/api/inbox/${wa.conv.id}/reply`).send({ content: 'Yes, 3BHKs are available.' });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      const d = res.body.data;
      expect(d.status).toBe('open');
      expect(d.aiPaused).toBe(true);
      expect(d.assigneeId).toBe(a.user.id);
      expect(d.firstResponseAt).toBeTruthy();
      expect(d.awaitingReply).toBe(0);
      const last = d.messages.at(-1);
      expect(last.senderType).toBe('agent');
      expect(last.metadata.deliveryStatus).toBeTruthy();
    });
    it('blocks free-form WhatsApp replies after 24h but allows approved templates only', async () => {
      const blocked = await api('post', `/api/inbox/${waOld.conv.id}/reply`).send({ content: 'Hello again' });
      expect(blocked.status).toBe(400);
      expect(blocked.body.error.code).toBe('WINDOW_EXPIRED');

      const missing = await api('post', `/api/inbox/${waOld.conv.id}/reply`).send({ content: 'x', templateName: 'does_not_exist' });
      expect(missing.body.error.code).toBe('TEMPLATE_UNKNOWN');

      const tpl = await api('post', '/api/channels/templates').send({ name: 'visit_followup', content: { body: 'Hi {{1}}, thanks for visiting {{2}}!' }, sampleValues: ['Asha', 'Lakeside'] });
      expect(tpl.status).toBe(201);
      const draft = await api('post', `/api/inbox/${waOld.conv.id}/reply`).send({ content: 'x', templateName: 'visit_followup' });
      expect(draft.body.error.code).toBe('TEMPLATE_NOT_APPROVED');
      expect((await api('post', `/api/channels/templates/${tpl.body.data.id}/submit`)).body.data.status).toBe('approved');
      const ok = await api('post', `/api/inbox/${waOld.conv.id}/reply`).send({ content: 'Hi Olga, thanks for visiting Lakeside!', templateName: 'visit_followup' });
      expect(ok.status).toBe(200);
      expect(ok.body.data.messages.at(-1).metadata.templateName).toBe('visit_followup');
    });
    it('stays silent in web chat once a teammate has taken over, and speaks again after hand-back', async () => {
      const s = await request(app).post('/public/session').send({ publicKey, visitorId: 'v_inbox_1' });
      const { sessionToken, conversationId } = s.body.data;
      const first = await request(app).post('/public/message').set('Authorization', `Bearer ${sessionToken}`).send({ conversationId, message: 'hi there' });
      expect(first.status).toBe(200);
      expect(first.body.data.humanHandling).toBeUndefined();

      await api('post', `/api/inbox/${conversationId}/take-control`);
      const quiet = await request(app).post('/public/message').set('Authorization', `Bearer ${sessionToken}`).send({ conversationId, message: 'are you there?' });
      expect(quiet.status).toBe(200);
      expect(quiet.body.data.reply).toBe('');
      const detail = (await api('get', `/api/inbox/${conversationId}`)).body.data;
      expect(detail.messages.filter((m: { senderType: string }) => m.senderType === 'bot').length).toBe(1);
      expect(detail.awaitingReply).toBe(1);

      const back = await api('post', `/api/inbox/${conversationId}/hand-back`);
      expect(back.body.data.aiPaused).toBe(false);
      expect(back.body.data.status).toBe('bot');
    });
    it('updates status, priority, tags and assignee (team members only)', async () => {
      const res = await api('patch', `/api/inbox/${web.conv.id}`).send({ priority: 'urgent', tags: ['Hot', 'hot', 'site-visit'], assigneeId: agent.user.id });
      expect(res.body.data).toMatchObject({ priority: 'urgent', tags: ['hot', 'site-visit'], assigneeId: agent.user.id });
      expect((await api('get', '/api/inbox').query({ assignee: agent.user.id })).body.data.total).toBe(1);
      expect((await api('get', '/api/inbox').query({ tag: 'hot' })).body.data.total).toBe(1);
      const bad = await api('patch', `/api/inbox/${web.conv.id}`).send({ assigneeId: b.user.id });
      expect(bad.status).toBe(400);
      const resolved = await api('patch', `/api/inbox/${web.conv.id}`).send({ status: 'resolved' });
      expect(resolved.body.data.status).toBe('resolved');
      const closed = await api('patch', `/api/inbox/${web.conv.id}`).send({ status: 'closed' });
      expect(closed.body.data.status).toBe('closed');
      expect((await api('post', `/api/inbox/${web.conv.id}/reply`).send({ content: 'late' })).status).toBe(409);
    });
    it('stores internal notes and notifies only mentioned teammates of the same company', async () => {
      const res = await api('post', `/api/inbox/${wa.conv.id}/notes`).send({ body: 'Budget is 1.2 Cr, call after 6pm', mentions: [agent.user.id, b.user.id] });
      expect(res.status).toBe(201);
      expect(res.body.data.mentions).toEqual([agent.user.id]);
      const notes = await testDb.select().from(notifications).where(eq(notifications.userId, agent.user.id));
      expect(notes.some(n => n.type === 'mention')).toBe(true);
      expect(await testDb.select().from(notifications).where(and(eq(notifications.userId, b.user.id), eq(notifications.type, 'mention')))).toHaveLength(0);
      expect((await api('get', `/api/inbox/${wa.conv.id}`)).body.data.notes).toHaveLength(1);
      // notes are internal: never part of the message thread
      expect((await api('get', `/api/inbox/${wa.conv.id}`)).body.data.messages.some((m: { content: string }) => m.content.includes('Budget is 1.2 Cr'))).toBe(false);
    });
    it('reports counts per status', async () => {
      const counts = (await api('get', '/api/inbox/counts')).body.data;
      expect(counts.closed).toBe(1);
      expect(counts.open).toBeGreaterThanOrEqual(1);
    });
  });

  describe('lead sources', () => {
    let id = '';
    let key = '';
    const ingest = (k: string | undefined, body: unknown) => {
      const r = request(app).post('/api/public/omni/lead-sources/ingest');
      return (k ? r.set('x-api-key', k) : r).send(body as object);
    };

    it('creates a source, shows the key once and never stores it in plain text', async () => {
      const res = await api('post', '/api/lead-sources').send({ name: 'Website form', sourceType: 'generic', fieldMapping: { fullname: 'name', mobile: 'phone', hint: 'attribute:notes' }, attribution: { utm_agencypartner: 'acme' } });
      expect(res.status).toBe(201);
      id = res.body.data.source.id;
      key = res.body.data.apiKey;
      expect(key).toMatch(/^pbls_[0-9a-f]{8}_[0-9a-f]{40}$/);
      expect(JSON.stringify((await api('get', '/api/lead-sources')).body)).not.toContain(key);
      expect((await api('get', '/api/lead-sources', b)).body.data).toEqual([]);
      expect((await api('get', '/api/lead-sources', agent)).status).toBe(403);
    });
    it('rejects bad, missing and other keys', async () => {
      expect((await ingest(undefined, { name: 'x', phone: '9811100010' })).status).toBe(401);
      expect((await ingest('pbls_00000000_' + 'a'.repeat(40), { phone: '9811100010' })).status).toBe(401);
      expect((await ingest(key.slice(0, -1) + (key.endsWith('0') ? '1' : '0'), { phone: '9811100010' })).status).toBe(401);
    });
    it('creates a lead with attribution, de-duplicates repeats and logs both', async () => {
      const first = await ingest(key, { fullname: 'Ravi Kumar', mobile: '+919811100020', utm_campaign: 'summer' });
      expect(first.status, JSON.stringify(first.body)).toBe(200);
      expect(first.body.data.status).toBe('processed');
      const [lead] = await testDb.select().from(leads).where(eq(leads.id, first.body.data.leadId));
      expect(lead!.utmParams).toMatchObject({ utm_agencypartner: 'acme', utm_campaign: 'summer' });
      const again = await ingest(key, { fullname: 'Ravi K', mobile: '9811100020' });
      expect(again.body.data.status).toBe('duplicate');
      expect(again.body.data.leadId).toBe(first.body.data.leadId);
      const events = (await api('get', `/api/lead-sources/${id}/events`)).body.data;
      expect(events.map((e: { status: string }) => e.status).sort()).toEqual(['duplicate', 'processed']);
      expect((await api('get', '/api/lead-sources')).body.data[0].totalReceived).toBe(2);
    });
    it('rejects payloads without a usable phone (422) and logs why', async () => {
      const none = await ingest(key, { fullname: 'No Phone' });
      expect(none.status).toBe(422);
      const bad = await ingest(key, { fullname: 'Bad', mobile: '123' });
      expect(bad.status).toBe(422);
      expect(bad.body.data.status).toBe('rejected');
    });
    it('fills form attributes on the lead when a form is attached', async () => {
      const [form] = await testDb.insert(forms).values({ companyId: a.company.id, key: 'src_form', name: 'Src form', purpose: 'lead_attributes' }).returning();
      const { formFields } = await import('../../src/db/schema/index.js');
      await testDb.insert(formFields).values({ formId: form!.id, companyId: a.company.id, key: 'notes', label: 'Notes', type: 'text', position: 0 });
      await api('put', `/api/lead-sources/${id}`).send({ formId: form!.id });
      const res = await ingest(key, { fullname: 'Form Person', mobile: '9811100030', hint: 'wants east facing' });
      const [lead] = await testDb.select().from(leads).where(eq(leads.id, res.body.data.leadId));
      expect((lead!.customFields as { attributes?: Record<string, unknown> }).attributes).toMatchObject({ notes: 'wants east facing' });
      expect((await api('put', `/api/lead-sources/${id}`).send({ formId: crypto.randomUUID() })).status).toBe(400);
    });
    it('imports a CSV and reports per-row results', async () => {
      const csv = 'fullname,mobile\nCsv One,9811100041\nCsv Two,9811100042\nBroken,\nCsv One again,9811100041\n';
      const res = await api('post', `/api/lead-sources/${id}/import-csv`).send({ csv });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ total: 4, processed: 2, duplicate: 1, rejected: 1 });
      expect(res.body.data.errors[0].row).toBe(4);
    });
    it('ingests Meta Lead Ads payloads through a typed source', async () => {
      const src = await api('post', '/api/lead-sources').send({ name: 'Meta', sourceType: 'meta_lead_ads' });
      const out = await ingest(src.body.data.apiKey, { campaign_name: 'Monsoon', field_data: [{ name: 'full_name', values: ['Meta Lead'] }, { name: 'phone_number', values: ['+919811100050'] }] });
      expect(out.body.data.status).toBe('processed');
      const [lead] = await testDb.select().from(leads).where(eq(leads.id, out.body.data.leadId));
      expect(lead!.utmParams).toMatchObject({ utm_campaign: 'Monsoon' });
    });
    it('rotating the key kills the old one; disabling blocks ingestion', async () => {
      const rotated = await api('post', `/api/lead-sources/${id}/rotate-key`);
      expect((await ingest(key, { fullname: 'X', mobile: '9811100060' })).status).toBe(401);
      const newKey = rotated.body.data.apiKey;
      expect((await ingest(newKey, { fullname: 'X', mobile: '9811100060' })).status).toBe(200);
      await api('put', `/api/lead-sources/${id}`).send({ isActive: false });
      expect((await ingest(newKey, { fullname: 'Y', mobile: '9811100061' })).status).toBe(403);
    });
  });

  describe('channels, templates, widgets', () => {
    it('stores connection secrets encrypted and never returns them', async () => {
      const res = await api('post', '/api/channels/connections').send({ channel: 'instagram', name: 'IG', externalAccountId: 'ig_acct_1', secrets: { accessToken: 'EAAB-secret-token', appSecret: 'shh' } });
      expect(res.status).toBe(201);
      expect(res.body.data.secretKeys.sort()).toEqual(['accessToken', 'appSecret']);
      expect(JSON.stringify(res.body)).not.toContain('EAAB-secret-token');
      const [row] = await testDb.select().from(channelConnections).where(eq(channelConnections.id, res.body.data.id));
      expect(row!.secrets.accessToken).toMatch(/^vault:v1:/);
      expect((await api('post', '/api/channels/connections', b).send({ channel: 'instagram', name: 'Steal', externalAccountId: 'ig_acct_1' })).status).toBe(409);
      expect((await api('post', `/api/channels/connections/${res.body.data.id}/test`)).body.data.status).toBe('connected');
      const noToken = await api('post', '/api/channels/connections').send({ channel: 'messenger', name: 'FB', externalAccountId: 'pg_1' });
      expect((await api('post', `/api/channels/connections/${noToken.body.data.id}/test`)).body.data.status).toBe('error');
    });

    it('validates templates and reviews them', async () => {
      expect((await api('post', '/api/channels/templates').send({ name: 'Bad Name', content: { body: 'x' } })).status).toBe(400);
      expect((await api('post', '/api/channels/templates').send({ name: 'gap_vars', content: { body: 'Hi {{1}} and {{3}}' } })).status).toBe(400);
      expect((await api('post', '/api/channels/templates').send({ name: 'starts_var', content: { body: '{{1}} hello' } })).status).toBe(400);
      const noSamples = await api('post', '/api/channels/templates').send({ name: 'needs_samples', content: { body: 'Hi {{1}}, welcome' } });
      expect(noSamples.status).toBe(201);
      expect((await api('post', `/api/channels/templates/${noSamples.body.data.id}/submit`)).status).toBe(400);
      const risky = await api('post', '/api/channels/templates').send({ name: 'risky_offer', content: { body: 'Invest now for guaranteed returns of 20%' } });
      const rejected = await api('post', `/api/channels/templates/${risky.body.data.id}/submit`);
      expect(rejected.body.data.status).toBe('rejected');
      expect(rejected.body.data.rejectionReason).toContain('guaranteed returns');
      const fixed = await api('put', `/api/channels/templates/${risky.body.data.id}`).send({ content: { body: 'New launch in Whitefield. Reply for details.' } });
      expect(fixed.body.data.status).toBe('draft');
      expect((await api('post', `/api/channels/templates/${risky.body.data.id}/submit`)).body.data.status).toBe('approved');
      expect((await api('put', `/api/channels/templates/${risky.body.data.id}`).send({ category: 'marketing' })).status).toBe(409); // approved = locked
      expect((await api('post', '/api/channels/templates').send({ name: 'risky_offer', content: { body: 'dup' } })).status).toBe(409);
    });

    it('serves widget config only to allowed origins', async () => {
      const created = await api('post', '/api/channels/widgets').send({ name: 'Main site', chatbotId: botId, allowedDomains: ['https://www.Example.com/path', 'example.org'], nudges: [{ id: 'n1', message: 'Looking at pricing?', urlContains: '/pricing', delaySeconds: 20 }], sections: { quickActions: ['Book a visit'] } });
      expect(created.status).toBe(201);
      expect(created.body.data.allowedDomains).toEqual(['www.example.com', 'example.org']);
      const id = created.body.data.id;
      const ok = await request(app).get(`/api/public/omni/widgets/${id}`).set('Origin', 'https://www.example.com');
      expect(ok.status).toBe(200);
      expect(ok.body.data.publicKey).toBe(publicKey);
      expect(ok.body.data.nudges[0].urlContains).toBe('/pricing');
      expect((await request(app).get(`/api/public/omni/widgets/${id}`).set('Origin', 'https://shop.example.org')).status).toBe(200);
      expect((await request(app).get(`/api/public/omni/widgets/${id}`).set('Origin', 'https://evil.com')).status).toBe(403);
      expect((await request(app).get(`/api/public/omni/widgets/${id}`)).status).toBe(403);
      expect((await api('post', '/api/channels/widgets').send({ name: 'Bad', allowedDomains: ['not a domain'] })).status).toBe(400);
      await api('delete', `/api/channels/widgets/${id}`);
      expect((await request(app).get(`/api/public/omni/widgets/${id}`).set('Origin', 'https://www.example.com')).status).toBe(404);
    });
  });

  describe('Instagram / Messenger inbound', () => {
    const secret = 'ig-app-secret';
    const payload = (mid: string, text: string, sender = 'igsid_777') => ({ object: 'instagram', entry: [{ id: 'ig_acct_social', messaging: [{ sender: { id: sender }, recipient: { id: 'ig_acct_social' }, message: { mid, text } }] }] });
    const post = (body: object, secretUsed = secret) => {
      const raw = JSON.stringify(body);
      const sig = 'sha256=' + crypto.createHmac('sha256', secretUsed).update(raw).digest('hex');
      return request(app).post('/api/public/omni/webhooks/meta-social').set('Content-Type', 'application/json').set('X-Hub-Signature-256', sig).send(raw);
    };

    beforeAll(async () => {
      await testDb.insert(channelConnections).values({ companyId: a.company.id, channel: 'instagram', name: 'IG social', status: 'connected', externalAccountId: 'ig_acct_social', chatbotId: botId, secrets: { appSecret: packEncryptedSecret(encryptSecret(secret)), accessToken: packEncryptedSecret(encryptSecret('tok')) } });
    });

    it('answers the verification handshake only with the configured token', async () => {
      delete process.env.META_SOCIAL_VERIFY_TOKEN;
      expect((await request(app).get('/api/public/omni/webhooks/meta-social').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'x', 'hub.challenge': '123' })).status).toBe(403);
      process.env.META_SOCIAL_VERIFY_TOKEN = 'verify-me';
      const ok = await request(app).get('/api/public/omni/webhooks/meta-social').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '123' });
      expect(ok.text).toBe('123');
      expect((await request(app).get('/api/public/omni/webhooks/meta-social').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '123' })).status).toBe(403);
    });
    it('rejects unsigned or wrongly signed deliveries', async () => {
      expect((await request(app).post('/api/public/omni/webhooks/meta-social').send(payload('m0', 'hi'))).status).toBe(401);
      expect((await post(payload('m0', 'hi'), 'wrong-secret')).status).toBe(401);
    });
    it('stores messages in the inbox, creates the identity once, ignores duplicates, and the team can reply', async () => {
      const first = await post(payload('mid_1', 'Price of 2BHK?'));
      expect(first.status, JSON.stringify(first.body)).toBe(200);
      expect(first.body.data.stored).toBe(1);
      expect((await post(payload('mid_1', 'Price of 2BHK?'))).body.data).toMatchObject({ stored: 0, ignored: 1 });
      await post(payload('mid_2', 'And possession date?'));
      const identities = await testDb.select().from(contactIdentities).where(and(eq(contactIdentities.companyId, a.company.id), eq(contactIdentities.channel, 'instagram')));
      expect(identities).toHaveLength(1);

      const list = (await api('get', '/api/inbox').query({ channel: 'instagram' })).body.data.items;
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ status: 'needs_human', awaitingReply: 2, contactName: 'Instagram user _777', contactPhone: null });
      const reply = await api('post', `/api/inbox/${list[0].id}/reply`).send({ content: 'Starts at 85 L. Possession Dec 2027.' });
      expect(reply.status, JSON.stringify(reply.body)).toBe(200);
      expect(reply.body.data.messages.at(-1).metadata.provider).toBe('mock_instagram');
    });
    it('drops events for unknown accounts without error', async () => {
      const out = await post({ object: 'instagram', entry: [{ id: 'unknown_acct', messaging: [{ sender: { id: 'x' }, message: { mid: 'q', text: 'hi' } }] }] });
      expect(out.status).toBe(200);
      expect(out.body.data.ignored).toBe(1);
    });
  });
});
