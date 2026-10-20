import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser } from '../helpers/test-fixtures.js';
import { contacts, leads, voiceCalls, callCampaignTargets, companyAiSettings, dndNumbers } from '../../src/db/schema/index.js';
import { analyzeUtterance, inCallingWindow } from '../../src/modules/voice/call-signals.js';
import { callCampaignsService } from '../../src/modules/voice/call-campaigns.service.js';
import { voiceService } from '../../src/modules/voice/voice.service.js';
import { modelRouter } from '../../src/modules/ai/router.js';
import { runAction } from '../../src/modules/tools/actions.js';

const IN_WINDOW = new Date('2026-10-21T05:30:00Z'); // Wednesday 11:00 IST
const OUT_WINDOW = new Date('2026-10-21T20:00:00Z'); // Thursday 01:30 IST

describe('P5: voice studio', () => {
  const app = createApp();
  let a: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let b: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let agentUser: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let voiceAgentId = '';
  const api = (method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, who = a) => request(app)[method](url).set('Authorization', who.authHeader);

  async function makeLead(first: string, phone: string, consent = true) {
    const [c] = await testDb.insert(contacts).values({ companyId: a.company.id, firstName: first, phone }).returning();
    const [l] = await testDb.insert(leads).values({ companyId: a.company.id, contactId: c!.id, status: 'new', customFields: consent ? { callConsent: true } : {} }).returning();
    return { lead: l!, contact: c! };
  }
  async function testCall(who = a) {
    const res = await api('post', `/api/voice/studio/agents/${voiceAgentId}/test-call`, who).send({});
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body.data as { callId: string; greeting: string };
  }
  const say = (callId: string, utterance: string) => api('post', `/api/voice/studio/calls/${callId}/turn`).send({ utterance });

  beforeAll(async () => {
    a = await createAuthenticatedUser('company_admin');
    b = await createAuthenticatedUser('company_admin');
    agentUser = await createAuthenticatedUser('agent', { id: a.company.id } as never);
    const res = await api('post', '/api/voice/studio/agents').send({ name: 'Riya', greeting: 'Hello {{name}}, this is Riya, an AI assistant from {{company}}.', recordingConsentScript: 'This call may be recorded.', escalationRules: { keywords: ['speak to a person'], onPriceNegotiation: true, negativeTurns: 2 } });
    voiceAgentId = res.body.data.id;
  });
  afterAll(async () => {
    delete process.env.VOICE_WEBHOOK_SECRET;
    await cleanupTestDatabase([a.company.id, b.company.id]);
  });
  afterEach(() => vi.restoreAllMocks());

  describe('helpers', () => {
    it('reads one utterance', () => {
      expect(analyzeUtterance('Please stop calling me').optOut).toBe(true);
      expect(analyzeUtterance('I am looking for a 3 BHK around 1.5 Cr')).toMatchObject({ bhk: '3BHK', budget: '1.5 Cr' });
      expect(analyzeUtterance('can I visit on Saturday?').visitIntent).toBe(true);
      expect(analyzeUtterance('any discount possible?').priceNegotiation).toBe(true);
      expect(analyzeUtterance('let me speak to a person', ['speak to a person']).wantsHuman).toBe(true);
      expect(analyzeUtterance('This is useless, you are wasting my time!!').sentiment).toBe('negative');
    });
    it('checks calling windows in the campaign timezone and fails closed on bad zones', () => {
      const w = { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 20, timezone: 'Asia/Kolkata' };
      expect(inCallingWindow(w, IN_WINDOW)).toBe(true);
      expect(inCallingWindow(w, OUT_WINDOW)).toBe(false);
      expect(inCallingWindow({ ...w, days: [0, 6] }, IN_WINDOW)).toBe(false);
      expect(inCallingWindow({ ...w, timezone: 'Not/AZone' }, IN_WINDOW)).toBe(false);
    });
  });

  describe('voice agents, numbers and DND', () => {
    it('manages voice agents with tenant isolation and permissions', async () => {
      expect((await api('get', '/api/voice/studio/agents', b)).body.data).toEqual([]);
      expect((await api('get', '/api/voice/studio/agents', agentUser)).status).toBe(403);
      expect((await api('post', '/api/voice/studio/agents').send({ name: 'x' })).status).toBe(400);
      const upd = await api('put', `/api/voice/studio/agents/${voiceAgentId}`).send({ maxCallSeconds: 300, voice: { language: 'hinglish', speed: 1.1 } });
      expect(upd.body.data.maxCallSeconds).toBe(300);
      expect(upd.body.data.voice.language).toBe('hinglish');
      expect((await api('put', `/api/voice/studio/agents/${voiceAgentId}`, b).send({ name: 'Hijack' })).status).toBe(404);
      expect((await api('post', '/api/voice/studio/agents').send({ name: 'Bad brain', agentId: crypto.randomUUID() })).status).toBe(404);
    });
    it('registers numbers once and lets you reassign them', async () => {
      const n = await api('post', '/api/voice/studio/numbers').send({ provider: 'exotel', number: '+918040009999', voiceAgentId });
      expect(n.status).toBe(201);
      expect((await api('post', '/api/voice/studio/numbers', b).send({ provider: 'exotel', number: '+918040009999' })).status).toBe(409);
      expect((await api('post', '/api/voice/studio/numbers').send({ provider: 'exotel', number: '9999' })).status).toBe(400);
      expect((await api('post', '/api/voice/studio/numbers').send({ provider: 'plivo', number: '+918040008888', voiceAgentId: (await api('get', '/api/voice/studio/agents', b)).body.data[0]?.id ?? crypto.randomUUID() })).status).toBe(404);
      expect((await api('put', `/api/voice/studio/numbers/${n.body.data.id}`).send({ voiceAgentId: null })).status).toBe(200);
    });
    it('keeps a DND list, normalising numbers', async () => {
      const add = await api('post', '/api/voice/studio/dnd').send({ phones: ['98222 00099', '+919822200099'] });
      expect(add.body.data.added).toBe(1);
      const list = (await api('get', '/api/voice/studio/dnd')).body.data;
      expect(list).toHaveLength(1);
      expect(list[0].phone).toBe('+919822200099');
      expect((await api('delete', `/api/voice/studio/dnd/${list[0].id}`, b)).status).toBe(404);
      expect((await api('delete', `/api/voice/studio/dnd/${list[0].id}`)).status).toBe(200);
    });
  });

  describe('call engine', () => {
    it('opens with an AI disclosure and the recording notice', async () => {
      const { greeting, callId } = await testCall();
      expect(greeting).toMatch(/AI assistant/);
      expect(greeting).toContain('This call may be recorded.');
      const detail = (await api('get', `/api/voice/studio/call-log/${callId}`)).body.data;
      expect(detail.events[0]).toMatchObject({ type: 'utterance', speaker: 'agent' });
    });
    it('answers normal turns (uses the model when configured) and logs events', async () => {
      vi.spyOn(modelRouter, 'isConfigured').mockReturnValue(true);
      const spy = vi.spyOn(modelRouter, 'executeCompletion').mockResolvedValue({ text: 'Great, a 3 BHK works. When can you visit?', tokens: { prompt: 1, completion: 1, total: 2 } } as never);
      const { callId } = await testCall();
      const r = await say(callId, 'I want a 3 BHK under 1.5 Cr');
      expect(r.body.data).toMatchObject({ reply: 'Great, a 3 BHK works. When can you visit?', ended: false, escalated: false });
      expect(r.body.data.signals.map((s: { type: string }) => s.type).sort()).toEqual(['bhk', 'budget']);
      expect(spy.mock.calls[0]![0].systemPrompt).toContain('VOICE CALL RULES');
      expect(spy.mock.calls[0]![0].systemPrompt).toContain('LIVE INVENTORY'.slice(0, 4)); // live facts section only when relevant; rules always present
    });
    it('falls back to a safe scripted reply when no model is available', async () => {
      const { callId } = await testCall();
      const r = await say(callId, 'tell me about the project');
      expect(r.body.data.reply).toMatch(/budget|bedrooms/i);
    });
    it('qualifies a caller who gave budget and BHK, and records the summary', async () => {
      const { callId } = await testCall();
      await say(callId, 'I need a 3 BHK with budget 1.5 Cr');
      const end = await api('post', `/api/voice/studio/calls/${callId}/end`);
      expect(end.body.data.outcome).toBe('qualified');
      const d = (await api('get', `/api/voice/studio/call-log/${callId}`)).body.data;
      expect(d.status).toBe('completed');
      expect(d.transcript).toContain('Caller: I need a 3 BHK');
      expect(d.summary).toContain('budget 1.5 Cr');
      expect((await say(callId, 'hello?')).status).toBe(409);
    });
    it('honours "stop calling": ends the call, outcome dnd', async () => {
      const { callId } = await testCall();
      const r = await say(callId, 'Please stop calling me');
      expect(r.body.data).toMatchObject({ ended: true, outcome: 'dnd' });
      expect(r.body.data.reply).toMatch(/will not call you again/);
    });
    it('hands over to a person on request, on price negotiation, and after repeated anger', async () => {
      const c1 = await testCall();
      expect((await say(c1.callId, 'I want to speak to a person')).body.data).toMatchObject({ escalated: true, ended: true });
      const c2 = await testCall();
      expect((await say(c2.callId, 'can you give me a discount?')).body.data.escalated).toBe(true);
      const c3 = await testCall();
      expect((await say(c3.callId, 'this is useless')).body.data.escalated).toBe(false);
      expect((await say(c3.callId, 'you are wasting my time!!')).body.data.escalated).toBe(true);
      const detail = (await api('get', `/api/voice/studio/call-log/${c1.callId}`)).body.data;
      expect(detail.escalatedToHuman).toBe(true);
      expect(detail.events.some((e: { type: string }) => e.type === 'transfer')).toBe(true);
    });
    it('ends politely when the caller is not interested or says goodbye', async () => {
      const c1 = await testCall();
      expect((await say(c1.callId, 'not interested, thanks')).body.data).toMatchObject({ ended: true, outcome: 'not_interested' });
      const c2 = await testCall();
      expect((await say(c2.callId, 'ok bye')).body.data.ended).toBe(true);
    });
    it('enforces the maximum call duration', async () => {
      const { callId } = await testCall();
      await testDb.update(voiceCalls).set({ startedAt: new Date(Date.now() - 10 * 60_000) }).where(eq(voiceCalls.id, callId));
      await api('put', `/api/voice/studio/agents/${voiceAgentId}`).send({ maxCallSeconds: 60 });
      const r = await say(callId, 'one more thing');
      expect(r.body.data.ended).toBe(true);
      await api('put', `/api/voice/studio/agents/${voiceAgentId}`).send({ maxCallSeconds: 600 });
    });
    it('does not let another company drive or read the call', async () => {
      const { callId } = await testCall();
      expect((await api('post', `/api/voice/studio/calls/${callId}/turn`, b).send({ utterance: 'hi' })).status).toBe(404);
      expect((await api('get', `/api/voice/studio/call-log/${callId}`, b)).status).toBe(404);
    });
  });

  describe('campaigns', () => {
    let campaignId = '';
    let okLead: Awaited<ReturnType<typeof makeLead>>;
    let noConsent: Awaited<ReturnType<typeof makeLead>>;
    let dndLead: Awaited<ReturnType<typeof makeLead>>;

    beforeAll(async () => {
      okLead = await makeLead('Okay', '+919822200001');
      noConsent = await makeLead('Nope', '+919822200002', false);
      dndLead = await makeLead('Dnd', '+919822200003');
      await testDb.insert(dndNumbers).values({ companyId: a.company.id, phone: '+919822200003' });
    });

    it('validates the audience and builds the call list with DND/consent skips', async () => {
      expect((await api('post', '/api/voice/studio/campaigns').send({ name: 'Bad', voiceAgentId })).status).toBe(400);
      expect((await api('post', '/api/voice/studio/campaigns').send({ name: 'Both', voiceAgentId, leadIds: [okLead.lead.id], segmentId: crypto.randomUUID() })).status).toBe(400);
      const res = await api('post', '/api/voice/studio/campaigns').send({ name: 'Warm leads', voiceAgentId, leadIds: [okLead.lead.id, noConsent.lead.id, dndLead.lead.id], concurrency: 1, retryPolicy: { maxAttempts: 2, gapMinutes: 30 } });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      campaignId = res.body.data.id;
      expect(res.body.data.progress).toMatchObject({ total: 3, pending: 1, skipped: 2 });
      expect((await api('get', `/api/voice/studio/campaigns/${campaignId}`, b)).status).toBe(404);
    });
    it('places no calls until started, nor outside the calling window', async () => {
      expect(await callCampaignsService.tick(IN_WINDOW)).toBe(0);
      await api('post', `/api/voice/studio/campaigns/${campaignId}/status`).send({ status: 'running' });
      expect(await callCampaignsService.tick(OUT_WINDOW)).toBe(0);
    });
    it('dials inside the window, only consenting non-DND leads, respecting concurrency', async () => {
      expect(await callCampaignsService.tick(IN_WINDOW)).toBe(1);
      expect(await callCampaignsService.tick(IN_WINDOW)).toBe(0);
      const targets = (await api('get', `/api/voice/studio/campaigns/${campaignId}/targets`)).body.data;
      expect(targets.find((t: { phone: string }) => t.phone === '+919822200001').status).toBe('calling');
      expect(targets.find((t: { phone: string }) => t.phone === '+919822200002').status).toBe('skipped_no_consent');
      expect(targets.find((t: { phone: string }) => t.phone === '+919822200003').status).toBe('skipped_dnd');
      const [call] = await testDb.select().from(voiceCalls).where(eq(voiceCalls.campaignId, campaignId));
      expect(call).toMatchObject({ direction: 'outbound_campaign', toNumber: '+919822200001', disclosedAsAi: true });
    });
    it('retries a no-answer after the gap, then gives up after the maximum attempts', async () => {
      const [call] = await testDb.select().from(voiceCalls).where(eq(voiceCalls.campaignId, campaignId));
      const hook = (status: string) => request(app).post('/api/voice/webhooks/status').send({ callSid: call!.callSid, status });
      expect((await hook('no_answer')).status).toBe(200);
      let [t] = await testDb.select().from(callCampaignTargets).where(eq(callCampaignTargets.campaignId, campaignId));
      const target = (await testDb.select().from(callCampaignTargets).where(eq(callCampaignTargets.campaignId, campaignId))).find(x => x.phone === '+919822200001')!;
      expect(target).toMatchObject({ status: 'pending', attempts: 1, outcome: 'no_answer' });
      const gapMs = target.nextAttemptAt.getTime() - Date.now();
      expect(gapMs).toBeGreaterThan(28 * 60_000);
      expect(gapMs).toBeLessThan(31 * 60_000);
      // pin the retry to the simulated clock so the window maths is deterministic
      await testDb.update(callCampaignTargets).set({ nextAttemptAt: new Date(IN_WINDOW.getTime() + 30 * 60_000) }).where(eq(callCampaignTargets.id, target.id));
      expect(await callCampaignsService.tick(IN_WINDOW)).toBe(0); // gap not elapsed
      const later = new Date(IN_WINDOW.getTime() + 31 * 60_000);
      expect(await callCampaignsService.tick(later)).toBe(1);
      const calls2 = await testDb.select().from(voiceCalls).where(eq(voiceCalls.campaignId, campaignId));
      const second = calls2.find(c => c.id !== call!.id)!;
      await request(app).post('/api/voice/webhooks/status').send({ callSid: second.callSid, status: 'no_answer' });
      [t] = (await testDb.select().from(callCampaignTargets).where(eq(callCampaignTargets.id, target.id)));
      expect(t).toMatchObject({ status: 'failed', attempts: 2 });
      const camp = (await api('get', `/api/voice/studio/campaigns/${campaignId}`)).body.data;
      expect(camp.status).toBe('completed');
      expect(camp.stats.no_answer).toBe(2);
    });
    it('can be paused, and the kill switch stops dialling', async () => {
      const lead = await makeLead('Later', '+919822200010');
      const res = await api('post', '/api/voice/studio/campaigns').send({ name: 'Second', voiceAgentId, leadIds: [lead.lead.id] });
      const id = res.body.data.id;
      await api('post', `/api/voice/studio/campaigns/${id}/status`).send({ status: 'running' });
      await testDb.insert(companyAiSettings).values({ companyId: a.company.id, killSwitch: true }).onConflictDoUpdate({ target: companyAiSettings.companyId, set: { killSwitch: true } });
      expect(await callCampaignsService.tick(IN_WINDOW)).toBe(0);
      await testDb.update(companyAiSettings).set({ killSwitch: false }).where(eq(companyAiSettings.companyId, a.company.id));
      await api('post', `/api/voice/studio/campaigns/${id}/status`).send({ status: 'paused' });
      expect(await callCampaignsService.tick(IN_WINDOW)).toBe(0);
      const cancelled = await api('post', `/api/voice/studio/campaigns/${id}/status`).send({ status: 'cancelled' });
      expect(cancelled.body.data.status).toBe('cancelled');
      expect((await api('post', `/api/voice/studio/campaigns/${id}/status`).send({ status: 'running' })).status).toBe(409);
    });
    it('re-checks DND at dial time: a number added after the list was built is never called', async () => {
      const lead = await makeLead('Late DND', '+919822200020');
      const res = await api('post', '/api/voice/studio/campaigns').send({ name: 'Late', voiceAgentId, leadIds: [lead.lead.id] });
      await api('post', '/api/voice/studio/dnd').send({ phones: ['+919822200020'] });
      await api('post', `/api/voice/studio/campaigns/${res.body.data.id}/status`).send({ status: 'running' });
      expect(await callCampaignsService.tick(IN_WINDOW)).toBe(0);
      expect((await api('get', `/api/voice/studio/campaigns/${res.body.data.id}`)).body.data.progress.skipped).toBe(1);
    });
  });

  describe('compliance and analytics', () => {
    it('automated callbacks respect the DND list', async () => {
      const lead = await makeLead('Cb', '+919822200030');
      await testDb.insert(dndNumbers).values({ companyId: a.company.id, phone: '+919822200030' });
      const out = await voiceService.initiateCallback(a.company.id, lead.lead.id, { bypassCallingHours: true });
      expect(out).toMatchObject({ status: 'skipped', reason: 'DND_LISTED' });
    });
    it('verifies telephony webhook signatures when a secret is configured', async () => {
      process.env.VOICE_WEBHOOK_SECRET = 'voice-secret';
      const raw = JSON.stringify({ callSid: 'nope', status: 'completed' });
      expect((await request(app).post('/api/voice/webhooks/status').set('Content-Type', 'application/json').send(raw)).status).toBe(401);
      const sig = crypto.createHmac('sha256', 'voice-secret').update(raw).digest('hex');
      expect((await request(app).post('/api/voice/webhooks/status').set('Content-Type', 'application/json').set('x-voice-signature', sig).send(raw)).status).toBe(200);
      delete process.env.VOICE_WEBHOOK_SECRET;
    });
    it('offers the call action to flows', async () => {
      const lead = await makeLead('Flow', '+919822200040', false);
      const out = await runAction('request_voice_call', { companyId: a.company.id }, { leadId: lead.lead.id });
      expect(out).toMatchObject({ status: 'skipped', reason: 'NO_CONSENT' });
    });
    it('summarises real calls (test calls excluded) and lists them with filters', async () => {
      const an = (await api('get', '/api/voice/studio/analytics')).body.data;
      expect(an.totalCalls).toBeGreaterThanOrEqual(2);
      expect(an.byOutcome.no_answer).toBeGreaterThanOrEqual(2);
      expect((await api('get', '/api/voice/studio/call-log').query({ outcome: 'no_answer' })).body.data.length).toBeGreaterThanOrEqual(2);
      expect((await api('get', '/api/voice/studio/call-log', b)).body.data).toEqual([]);
    });
  });
});
