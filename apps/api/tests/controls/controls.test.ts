import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser } from '../helpers/test-fixtures.js';
import { accessLogs, apiKeys, chatbots, contacts, conversations, dndNumbers, leads, llmCalls, messages, notifications, usageLedger, voiceCalls } from '../../src/db/schema/index.js';
import { maskEmail, maskPhone, notificationsService } from '../../src/modules/controls/controls.service.js';
import { policiesService } from '../../src/modules/controls/policies.service.js';
import { recordLlmCall } from '../../src/modules/ai/llm-call-log.js';

const waitFor = async <T,>(fn: () => Promise<T | undefined | false>, ms = 3000): Promise<T> => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v as T;
    if (Date.now() > end) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, 40));
  }
};

describe('P7: enterprise controls and developer platform', () => {
  const app = createApp();
  let a: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let b: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let agent: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let viewer: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let botId = '';
  let convId = '';
  let contactId = '';
  let leadId = '';
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, who = a) => request(app)[method](url).set('Authorization', who.authHeader);

  beforeAll(async () => {
    a = await createAuthenticatedUser('company_admin');
    b = await createAuthenticatedUser('company_admin');
    agent = await createAuthenticatedUser('agent', { id: a.company.id } as never);
    viewer = await createAuthenticatedUser('viewer', { id: a.company.id } as never);
    const [bot] = await testDb.insert(chatbots).values({ companyId: a.company.id, name: 'Ctl Bot', type: 'web', status: 'active', publicKey: `pb_ctl_${crypto.randomBytes(5).toString('hex')}`, config: {} }).returning();
    botId = bot!.id;
    const [c] = await testDb.insert(contacts).values({ companyId: a.company.id, firstName: 'Meera', lastName: 'Shah', phone: '+919844400001', email: 'meera@example.com' }).returning();
    contactId = c!.id;
    const [l] = await testDb.insert(leads).values({ companyId: a.company.id, contactId, chatbotId: botId, customFields: { attributes: { budget: 9000000 } } }).returning();
    leadId = l!.id;
    const [conv] = await testDb.insert(conversations).values({ companyId: a.company.id, chatbotId: botId, contactId, leadId, channel: 'web' }).returning();
    convId = conv!.id;
    await testDb.insert(messages).values({ companyId: a.company.id, conversationId: convId, senderType: 'visitor', content: 'Is the 3BHK available? Call me on 9844400001' });
  });
  afterAll(async () => {
    await cleanupTestDatabase([a.company.id, b.company.id]);
  });

  describe('masking helpers', () => {
    it('hides the middle of phones and e-mails', () => {
      expect(maskPhone('+919844400001')).toBe('+91••••••0001');
      expect(maskPhone(null)).toBeNull();
      expect(maskEmail('meera@example.com')).toBe('m••••@example.com');
    });
  });

  describe('teams', () => {
    it('creates teams from your own people only', async () => {
      const t = await api('post', '/api/controls/teams').send({ name: 'Whitefield sales', memberIds: [agent.user.id], leadUserId: a.user.id });
      expect(t.status, JSON.stringify(t.body)).toBe(201);
      expect(t.body.data.members.map((m: { id: string }) => m.id)).toEqual([agent.user.id]);
      expect((await api('post', '/api/controls/teams').send({ name: 'whitefield SALES' })).status).toBe(409);
      expect((await api('post', '/api/controls/teams').send({ name: 'Spy team', memberIds: [b.user.id] })).status).toBe(400);
      expect((await api('get', '/api/controls/teams', b)).body.data).toEqual([]);
      expect((await api('post', '/api/controls/teams', agent).send({ name: 'Nope team' })).status).toBe(403);
      const upd = await api('put', `/api/controls/teams/${t.body.data.id}`).send({ memberIds: [agent.user.id, viewer.user.id] });
      expect(upd.body.data.members).toHaveLength(2);
    });
  });

  describe('policies', () => {
    let policyId = '';
    it('keeps people ungoverned until a policy is assigned (roles stay the baseline)', async () => {
      const d = await policiesService.evaluate(a.company.id, { userId: agent.user.id, role: 'agent' }, 'inbox', 'add');
      expect(d).toMatchObject({ governed: false, allowed: true });
      expect((await api('post', `/api/inbox/${convId}/take-control`, agent)).status).toBe(200);
    });
    it('denies what a governing policy does not grant, and records every change', async () => {
      const p = await api('post', '/api/controls/policies').send({ name: 'Read-only inbox', rules: [{ module: 'inbox', actions: ['view'] }, { module: 'contacts', actions: ['view'] }] });
      expect(p.status, JSON.stringify(p.body)).toBe(201);
      policyId = p.body.data.id;
      expect((await api('post', '/api/controls/policies').send({ name: 'read-ONLY inbox', rules: [{ module: 'inbox', actions: ['view'] }] })).status).toBe(409);
      const asg = await api('post', `/api/controls/policies/${policyId}/assignments`).send({ subjectType: 'user', subjectId: agent.user.id });
      expect(asg.body.data.assignments[0]).toMatchObject({ subjectType: 'user', label: agent.user.name });

      expect((await api('get', '/api/inbox', agent)).status).toBe(200);
      const denied = await api('post', `/api/inbox/${convId}/reply`, agent).send({ content: 'hello' });
      expect(denied.status).toBe(403);
      expect(denied.body.error.code).toBe('POLICY_DENIED');
      expect((await api('post', `/api/inbox/${convId}/reply`)).status).toBe(400); // the admin is not governed: validation runs, no policy block

      const changes = (await api('get', '/api/controls/policy-changes')).body.data.map((c: { action: string }) => c.action);
      expect(changes).toEqual(expect.arrayContaining(['created', 'assigned']));
    });
    it('rejects assignments to people, roles or keys that do not exist for you', async () => {
      expect((await api('post', `/api/controls/policies/${policyId}/assignments`).send({ subjectType: 'user', subjectId: b.user.id })).status).toBe(400);
      expect((await api('post', `/api/controls/policies/${policyId}/assignments`).send({ subjectType: 'role', subjectId: 'ps-owner' })).status).toBe(400);
      expect((await api('post', `/api/controls/policies/${policyId}/assignments`, b).send({ subjectType: 'role', subjectId: 'agent' })).status).toBe(404);
    });
    it('applies rule conditions: business hours and team membership', async () => {
      const team = (await api('get', '/api/controls/teams')).body.data[0];
      const p = await api('post', '/api/controls/policies').send({
        name: 'Office hours exports',
        rules: [{ module: 'exports', actions: ['export'], conditions: { businessHours: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 18, timezone: 'Asia/Kolkata' }, teamIds: [team.id] } }],
      });
      await api('post', `/api/controls/policies/${p.body.data.id}/assignments`).send({ subjectType: 'user', subjectId: viewer.user.id });
      const weekdayNoon = new Date('2026-10-21T06:30:00Z'); // Wed 12:00 IST
      const night = new Date('2026-10-21T20:00:00Z');
      const sub = { userId: viewer.user.id, role: 'viewer' };
      expect((await policiesService.evaluate(a.company.id, sub, 'exports', 'export', weekdayNoon)).allowed).toBe(true); // viewer is in the team
      expect((await policiesService.evaluate(a.company.id, sub, 'exports', 'export', night)).allowed).toBe(false);
      expect((await policiesService.evaluate(a.company.id, sub, 'leads', 'export', weekdayNoon)).allowed).toBe(false);
      const outsider = await createAuthenticatedUser('viewer', { id: a.company.id } as never);
      await api('post', `/api/controls/policies/${p.body.data.id}/assignments`).send({ subjectType: 'user', subjectId: outsider.user.id });
      expect((await policiesService.evaluate(a.company.id, { userId: outsider.user.id, role: 'viewer' }, 'exports', 'export', weekdayNoon)).allowed).toBe(false);
    });
    it('applies role-level policies and lifts the restriction when unassigned', async () => {
      const p = (await api('get', '/api/controls/policies')).body.data.find((x: { id: string }) => x.id === policyId);
      const roleAsg = await api('post', `/api/controls/policies/${policyId}/assignments`).send({ subjectType: 'role', subjectId: 'viewer' });
      expect(roleAsg.status).toBe(201);
      const asg = roleAsg.body.data.assignments;
      for (const x of asg) await api('delete', `/api/controls/policies/${policyId}/assignments/${x.id}`);
      expect(p.rules).toHaveLength(2);
      expect((await api('post', `/api/inbox/${convId}/reply`, agent).send({ content: 'now allowed to try' })).status).not.toBe(403);
    });
    it('only company admins manage policies', async () => {
      expect((await api('get', '/api/controls/policies', agent)).status).toBe(403);
      expect((await api('get', '/api/controls/policies', b)).body.data).toEqual([]);
    });
  });

  describe('access logs and PII masking', () => {
    it('logs who opened what, filterable and admin-only', async () => {
      await api('get', `/api/inbox/${convId}`);
      await api('get', `/api/customer360/contacts/${contactId}`);
      const logs = await waitFor(async () => {
        const r = (await api('get', '/api/controls/access-logs').query({ action: 'view' })).body.data as Array<{ resourceType: string }>;
        return r.some(x => x.resourceType === 'conversation') && r.some(x => x.resourceType === 'contact_360') ? r : false;
      });
      expect(logs[0]).toHaveProperty('userName');
      expect((await api('get', '/api/controls/access-logs', agent)).status).toBe(403);
      expect((await api('get', '/api/controls/access-logs', b)).body.data).toEqual([]);
    });
    it('exports logs as safe CSV and logs the export itself', async () => {
      await testDb.insert(accessLogs).values({ companyId: a.company.id, userId: a.user.id, action: 'view', resourceType: '=HYPERLINK("http://evil")', resourceId: 'x' });
      const res = await api('get', '/api/controls/access-logs/export.csv');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain("\"'=HYPERLINK(");
      await waitFor(async () => (await testDb.select().from(accessLogs).where(and(eq(accessLogs.companyId, a.company.id), eq(accessLogs.action, 'export')))).length > 0);
    });
    it('masks phones and e-mails for the chosen roles only (viewers by default)', async () => {
      const viewer = await createAuthenticatedUser('viewer', { id: a.company.id } as never); // fresh: the shared one is governed by an export-only policy above
      const fullRes = await api('get', `/api/inbox/${convId}`);
      expect(fullRes.status, JSON.stringify(fullRes.body)).toBe(200);
      const full = fullRes.body.data;
      expect(full.contactPhone).toBe('+919844400001');
      const viewerRes = await api('get', `/api/inbox/${convId}`, viewer);
      expect(viewerRes.status, JSON.stringify(viewerRes.body)).toBe(200);
      const asViewer = viewerRes.body.data;
      expect(asViewer.contactPhone).toBe('+91••••••0001');
      expect(asViewer.contact.email).toBe('m••••@example.com');
      expect((await api('get', `/api/customer360/contacts/${contactId}`, viewer)).body.data.contact.phone).toBe('+91••••••0001');
      expect((await api('get', `/api/customer360/contacts/${contactId}`, agent)).body.data.contact.phone).toBe('+919844400001');
      await api('put', '/api/controls/privacy').send({ maskRoles: ['viewer', 'agent'] });
      expect((await api('get', `/api/customer360/contacts/${contactId}`, agent)).body.data.contact.email).toBe('m••••@example.com');
      expect((await api('get', '/api/inbox', agent)).body.data.items[0].contactPhone).toBe('+91••••••0001');
      expect((await api('get', `/api/customer360/contacts/${contactId}`)).body.data.contact.phone).toBe('+919844400001');
      await api('put', '/api/controls/privacy').send({ maskRoles: ['viewer'] });
      expect((await api('put', '/api/controls/privacy', agent).send({ maskRoles: [] })).status).toBe(403);
    });
  });

  describe('notifications', () => {
    it('falls back to the built-in alert when no rule exists', async () => {
      expect(await notificationsService.deliver({ companyId: a.company.id, type: 'lead_created', payload: {} })).toBe(false);
    });
    it('delivers by company rule, lets people override it, and keeps a personal centre', async () => {
      expect((await api('post', '/api/controls/notification-rules').send({ eventType: 'lead_created', channels: ['in_app'] })).status).toBe(201);
      expect((await api('post', '/api/controls/notification-rules').send({ eventType: 'lead_created', channels: ['in_app', 'email'], userId: b.user.id })).status).toBe(400);
      expect(await notificationsService.deliver({ companyId: a.company.id, type: 'lead_created', payload: { summary: 'Meera Shah just enquired' } })).toBe(true);
      const mine = (await api('get', '/api/controls/notifications')).body.data;
      expect(mine.unreadCount).toBeGreaterThanOrEqual(1);
      expect(mine.items[0]).toMatchObject({ type: 'lead_created', message: 'Meera Shah just enquired' });
      expect((await api('get', '/api/controls/notifications', agent)).body.data.items).toHaveLength(0); // agents only hear about what they opt into

      await api('post', '/api/controls/notification-rules').send({ eventType: 'lead_created', channels: ['in_app'], userId: agent.user.id });
      await notificationsService.deliver({ companyId: a.company.id, type: 'lead_created', payload: {} });
      expect((await api('get', '/api/controls/notifications', agent)).body.data.items).toHaveLength(1);

      const ids = mine.items.map((i: { id: string }) => i.id);
      expect((await api('post', '/api/controls/notifications/read', b).send({ ids })).body.data.updated).toBe(0); // not yours
      expect((await api('post', '/api/controls/notifications/read').send({})).body.data.updated).toBeGreaterThanOrEqual(1);
      expect((await api('get', '/api/controls/notifications').query({ unread: 'true' })).body.data.unreadCount).toBe(0);
    });
    it('switching a rule off stops its alerts', async () => {
      const rules = (await api('get', '/api/controls/notification-rules')).body.data as Array<{ id: string; userId: string | null }>;
      await api('post', '/api/controls/notification-rules').send({ eventType: 'lead_created', channels: ['in_app'], isActive: false });
      const before = (await testDb.select().from(notifications).where(eq(notifications.companyId, a.company.id))).length;
      await notificationsService.deliver({ companyId: a.company.id, type: 'lead_created', payload: {} });
      const after = (await testDb.select().from(notifications).where(eq(notifications.companyId, a.company.id))).length;
      expect(after - before).toBe(1); // only the personal agent rule is still active
      expect(rules.length).toBe(2);
    });
  });

  describe('usage metering', () => {
    it('summarises tokens, messages and call minutes, and keeps a ledger for future credits', async () => {
      await testDb.insert(llmCalls).values({ companyId: a.company.id, purpose: 'chat', model: 'gemini-3.8-flash', promptTokens: 100, completionTokens: 50, totalTokens: 150, latencyMs: 300, costUsd: '0.001', status: 'ok' } as never);
      await testDb.insert(messages).values({ companyId: a.company.id, conversationId: convId, senderType: 'bot', content: 'Yes, available.' });
      await testDb.insert(voiceCalls).values({ companyId: a.company.id, callSid: 'usage1', fromNumber: 'a', toNumber: 'b', status: 'completed', durationSeconds: 120, direction: 'outbound_campaign' });
      await testDb.insert(voiceCalls).values({ companyId: a.company.id, callSid: 'usage2', fromNumber: 'a', toNumber: 'b', status: 'completed', durationSeconds: 600, direction: 'test' });
      const u = (await api('get', '/api/controls/usage')).body.data;
      expect(u.llm).toMatchObject({ tokens: 150, calls: 1 });
      expect(u.llm.costUsd).toBeCloseTo(0.001, 4);
      expect(u.messages.byChannel.web).toBeGreaterThanOrEqual(1);
      expect(u.calls).toEqual({ minutes: 2, count: 1 }); // test calls are free and not counted
      expect((await api('get', '/api/controls/usage', b)).body.data.llm.tokens).toBe(0);

      recordLlmCall({ tier: 'fast', companyId: a.company.id, chatbotId: '', systemPrompt: '', userMessage: '' } as never, { text: 'x', provider: 'gemini', model: 'gemini-3.8-flash', tokens: { prompt: 10, completion: 5, total: 15 }, costUsd: 0, latencyMs: 5, circuitBreakerTripped: false });
      const row = await waitFor(async () => (await testDb.select().from(usageLedger).where(eq(usageLedger.companyId, a.company.id)))[0]);
      expect(row).toMatchObject({ kind: 'llm_tokens', unit: 'tokens' });
      expect(Number(row.quantity)).toBe(15);
    });
  });

  describe('consent and data requests', () => {
    it('keeps the latest consent per channel and purpose; withdrawing voice consent blocks calls', async () => {
      await api('post', '/api/controls/consent').send({ contactId, channel: 'whatsapp', purpose: 'marketing', granted: true, source: 'form' });
      await api('post', '/api/controls/consent').send({ contactId, channel: 'whatsapp', purpose: 'marketing', granted: false });
      await api('post', '/api/controls/consent').send({ contactId, channel: 'voice', purpose: 'service', granted: true });
      let list = (await api('get', `/api/controls/consent/${contactId}`)).body.data as Array<{ channel: string; granted: boolean }>;
      expect(list).toHaveLength(2);
      expect(list.find(c => c.channel === 'whatsapp')!.granted).toBe(false);
      await api('post', '/api/controls/consent').send({ contactId, channel: 'voice', purpose: 'service', granted: false });
      list = (await api('get', `/api/controls/consent/${contactId}`)).body.data;
      expect(list.find(c => c.channel === 'voice')!.granted).toBe(false);
      expect((await testDb.select().from(dndNumbers).where(eq(dndNumbers.companyId, a.company.id))).map(d => d.phone)).toContain('+919844400001');
      expect((await api('post', '/api/controls/consent', b).send({ contactId, channel: 'email', purpose: 'marketing', granted: true })).status).toBe(400);
    });
    it('exports everything held about a person as JSON, behind admin approval, and logs the download', async () => {
      const r = await api('post', '/api/controls/data-requests').send({ kind: 'export', contactId });
      expect(r.status).toBe(201);
      expect((await api('post', '/api/controls/data-requests').send({ kind: 'export', contactId })).status).toBe(409);
      expect((await api('get', `/api/controls/data-requests/${r.body.data.id}/download`)).status).toBe(409); // not approved yet
      const done = await api('post', `/api/controls/data-requests/${r.body.data.id}/decision`).send({ decision: 'approve' });
      expect(done.body.data.status).toBe('completed');
      const file = await api('get', `/api/controls/data-requests/${r.body.data.id}/download`);
      const bundle = JSON.parse(file.text);
      expect(bundle.contact.firstName).toBe('Meera');
      expect(bundle.conversations[0].messages.map((m: { text: string }) => m.text)).toContain('Is the 3BHK available? Call me on 9844400001');
      expect(bundle.consents.length).toBeGreaterThan(0);
      await waitFor(async () => (await testDb.select().from(accessLogs).where(and(eq(accessLogs.companyId, a.company.id), eq(accessLogs.action, 'download')))).length > 0);
      expect((await api('get', `/api/controls/data-requests/${r.body.data.id}/download`, b)).status).toBe(404);
      expect((await api('post', `/api/controls/data-requests/${r.body.data.id}/decision`).send({ decision: 'approve' })).status).toBe(409);
    });
    it('erases a person by anonymisation: details and message text go, the lead record and counts stay', async () => {
      const r = await api('post', '/api/controls/data-requests').send({ kind: 'delete', contactId });
      const rejected = await api('post', `/api/controls/data-requests/${r.body.data.id}/decision`).send({ decision: 'reject' });
      expect(rejected.body.data.status).toBe('rejected');
      expect((await testDb.select().from(contacts).where(eq(contacts.id, contactId)))[0]!.firstName).toBe('Meera');

      const r2 = await api('post', '/api/controls/data-requests').send({ kind: 'delete', contactId });
      expect((await api('post', `/api/controls/data-requests/${r2.body.data.id}/decision`, agent).send({ decision: 'approve' })).status).toBe(403);
      await api('post', `/api/controls/data-requests/${r2.body.data.id}/decision`).send({ decision: 'approve' });
      const [c] = await testDb.select().from(contacts).where(eq(contacts.id, contactId));
      expect(c).toMatchObject({ firstName: 'Deleted', lastName: null, email: null, lifecycleStage: 'deleted' });
      expect(c!.phone).toMatch(/^deleted:/);
      const msgs = await testDb.select().from(messages).where(eq(messages.conversationId, convId));
      expect(msgs.every(m => !m.content.includes('3BHK') && !m.content.includes('9844400001'))).toBe(true);
      const [l] = await testDb.select().from(leads).where(eq(leads.id, leadId));
      expect(l).toBeTruthy();
      expect(l!.customFields).toEqual({});
      expect((await testDb.select().from(dndNumbers).where(eq(dndNumbers.companyId, a.company.id))).map(d => d.phone)).toContain('+919844400001');
      expect((await api('get', '/api/controls/data-requests')).body.data.length).toBeGreaterThanOrEqual(3);
      expect((await api('get', '/api/controls/data-requests', b)).body.data).toEqual([]);
    });
  });

  describe('API keys and changelog', () => {
    it('creates keys with an expiry, shows usage, and expired keys are refused', async () => {
      const created = await api('post', '/api/settings/api-keys').send({ name: 'Portal sync', permissions: ['read:leads'], expiresInDays: 30 });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const key = created.body.data.apiKey as string;
      expect(created.body.data.expiresAt).toBeTruthy();
      const listed = (await api('get', '/api/settings/api-keys')).body.data.find((k: { id: string }) => k.id === created.body.data.id);
      expect(listed).toMatchObject({ usageCount: 0 });
      expect(listed.expiresAt).toBeTruthy();

      const call = () => request(app).get('/api/mcp/tools').set('Authorization', `Bearer ${key}`);
      expect((await call()).status).toBe(200);
      await waitFor(async () => (await testDb.select().from(apiKeys).where(eq(apiKeys.id, created.body.data.id)))[0]!.usageCount >= 1);
      await testDb.update(apiKeys).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(apiKeys.id, created.body.data.id));
      const expired = await call();
      expect(expired.status).toBe(401);
      expect(expired.body.error.code).toBe('KEY_EXPIRED');
      expect((await api('post', '/api/settings/api-keys').send({ name: 'Bad', permissions: ['read:leads'], expiresInDays: 0 })).status).toBe(400);
    });
    it('publishes a public changelog that only the platform owner can write', async () => {
      expect((await api('post', '/api/controls/changelog').send({ title: 'New inbox', bodyMd: 'Talk to buyers anywhere.' })).status).toBe(403);
      const owner = await createAuthenticatedUser('ps-owner');
      const pub = await api('post', '/api/controls/changelog', owner).send({ title: 'New inbox', bodyMd: 'Talk to buyers anywhere.', category: 'feature' });
      expect(pub.status, JSON.stringify(pub.body)).toBe(201);
      const list = await request(app).get('/api/public/controls/changelog');
      expect(list.status).toBe(200);
      expect(list.body.data[0].title).toBe('New inbox');
      await cleanupTestDatabase([owner.company.id]);
    }, 30_000);
  });
});
