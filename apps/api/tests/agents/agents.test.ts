import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser } from '../helpers/test-fixtures.js';
import { agents, agentVersions, chatbots, conversations, formSubmissions, knowledgeSources, leads, llmCalls } from '../../src/db/schema/index.js';
import { modelRouter } from '../../src/modules/ai/router.js';
import { retrievalService } from '../../src/modules/ai/retrieval.service.js';
import { setAttributeExtractor } from '../../src/modules/agents/agent-chat.js';

const waitFor = async <T>(fn: () => Promise<T | undefined | false>, ms = 4000): Promise<T> => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v as T;
    if (Date.now() > end) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, 40));
  }
};

describe('P1: agents, versions and runtime', () => {
  const app = createApp();
  let a: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let b: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let viewer: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  const api = (method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, who = a) =>
    request(app)[method](url).set('Authorization', who.authHeader);

  beforeAll(async () => {
    a = await createAuthenticatedUser('company_admin');
    b = await createAuthenticatedUser('company_admin');
    viewer = await createAuthenticatedUser('agent', { id: a.company.id } as never);
  });
  afterAll(async () => {
    await cleanupTestDatabase([a.company.id, b.company.id]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setAttributeExtractor(null);
  });

  it('exposes the Gemini model registry and the real-estate templates', async () => {
    const models = await api('get', '/api/agents/models');
    expect(models.body.data.default).toBe('gemini-3.8-flash');
    expect(models.body.data.models.map((m: { id: string }) => m.id)).toContain('gemini-3.1-flash-lite');
    const tpl = await api('get', '/api/agents/templates');
    expect(tpl.body.data.map((t: { id: string }) => t.id)).toEqual(expect.arrayContaining(['lead_qualifier', 'site_visit_booker', 'emi_helper', 'reengagement']));
  });

  describe('lifecycle', () => {
    let agentId: string;
    let v1: string;

    it('creates an agent from a template with a v1 draft; names are unique per company', async () => {
      const res = await api('post', '/api/agents').send({ name: 'Qualifier', template: 'lead_qualifier' });
      expect(res.status).toBe(201);
      agentId = res.body.data.agent.id;
      expect(res.body.data.versions).toHaveLength(1);
      expect(res.body.data.versions[0]).toMatchObject({ version: 1, status: 'draft', model: 'gemini-3.8-flash' });
      v1 = res.body.data.versions[0].id;
      expect(res.body.data.agent.activeVersion).toBeNull();

      const dupe = await api('post', '/api/agents').send({ name: 'qualifier' });
      expect(dupe.status).toBe(409);
      expect(dupe.body.error.code).toBe('AGENT_NAME_TAKEN');
      // other companies may reuse the name
      expect((await api('post', '/api/agents', b).send({ name: 'Qualifier' })).status).toBe(201);
    });

    it('edits the draft in place, validates content and rejects foreign references', async () => {
      const ok = await api('put', `/api/agents/${agentId}/draft`).send({ temperature: 0.4, model: 'gemini-3.1-flash-lite', changeNote: 'cheaper model' });
      expect(ok.status).toBe(200);
      expect(ok.body.data).toMatchObject({ id: v1, version: 1, temperature: 0.4, model: 'gemini-3.1-flash-lite' });

      expect((await api('put', `/api/agents/${agentId}/draft`).send({ model: 'gpt-4o' })).status).toBe(400);
      expect((await api('put', `/api/agents/${agentId}/draft`).send({ temperature: 3 })).status).toBe(400);
      expect((await api('put', `/api/agents/${agentId}/draft`).send({ variables: [{ key: 'Bad Key!' }] })).status).toBe(400);

      // a form / source that belongs to another company can never be referenced
      const otherForm = (await api('get', '/api/forms', b)).body.data[0].id;
      const foreignForm = await api('put', `/api/agents/${agentId}/draft`).send({ formId: otherForm });
      expect(foreignForm.status).toBe(400);
      expect(foreignForm.body.error.code).toBe('INVALID_FORM');
      const foreignSource = await api('put', `/api/agents/${agentId}/draft`).send({ knowledge: { sourceIds: [crypto.randomUUID()], referenceIds: [] } });
      expect(foreignSource.body.error.code).toBe('INVALID_SOURCE');
    });

    it('publishing needs a job description; then the version is live and immutable', async () => {
      await api('put', `/api/agents/${agentId}/draft`).send({ prompt: { jobDescription: '' } });
      const blocked = await api('post', `/api/agents/${agentId}/versions/${v1}/publish`).send({});
      expect(blocked.status).toBe(400);
      expect(blocked.body.error.code).toBe('MISSING_JOB');

      await api('put', `/api/agents/${agentId}/draft`).send({ prompt: { jobDescription: 'Qualify buyers for {{project_name}}.' } });
      const pub = await api('post', `/api/agents/${agentId}/versions/${v1}/publish`).send({ changeNote: 'first release' });
      expect(pub.status).toBe(200);
      expect(pub.body.data.agent).toMatchObject({ activeVersionId: v1, activeVersion: 1, hasUnpublishedDraft: false });
      expect((await api('post', `/api/agents/${agentId}/versions/${v1}/publish`).send({})).status).toBe(409);
    });

    it('editing after publishing starts a new draft; v1 stays untouched; publishing v2 archives v1', async () => {
      const draft = await api('put', `/api/agents/${agentId}/draft`).send({ prompt: { jobDescription: 'Version two job.' } });
      expect(draft.body.data).toMatchObject({ version: 2, status: 'draft' });
      const v2 = draft.body.data.id;
      const [v1row] = await testDb.select().from(agentVersions).where(eq(agentVersions.id, v1));
      expect((v1row!.prompt as { jobDescription: string }).jobDescription).toContain('{{project_name}}');
      expect(v1row!.status).toBe('published');

      const second = await api('put', `/api/agents/${agentId}/draft`).send({ temperature: 0.9 });
      expect(second.body.data.id).toBe(v2); // still the same draft

      await api('post', `/api/agents/${agentId}/versions/${v2}/publish`).send({});
      const got = await api('get', `/api/agents/${agentId}`);
      expect(got.body.data.agent.activeVersion).toBe(2);
      const statuses = Object.fromEntries(got.body.data.versions.map((v: { version: number; status: string }) => [v.version, v.status]));
      expect(statuses).toEqual({ 1: 'archived', 2: 'published' });
    });

    it('rollback publishes a new version that copies the old one (history stays linear)', async () => {
      const res = await api('post', `/api/agents/${agentId}/versions/${v1}/rollback`).send({});
      expect(res.status).toBe(200);
      expect(res.body.data.agent.activeVersion).toBe(3);
      const live = res.body.data.versions.find((v: { version: number }) => v.version === 3);
      expect(live.prompt.jobDescription).toContain('{{project_name}}');
      expect(live.changeNote).toBe('Rollback to v1');
      expect(res.body.data.versions).toHaveLength(3);
    });

    it('other companies and under-privileged roles are locked out', async () => {
      expect((await api('get', `/api/agents/${agentId}`, b)).status).toBe(404);
      expect((await api('put', `/api/agents/${agentId}/draft`, b).send({ temperature: 0.1 })).status).toBe(404);
      expect((await api('post', `/api/agents/${agentId}/test`, b).send({ messages: [{ role: 'visitor', content: 'hi' }] })).status).toBe(404);
      expect((await api('get', '/api/agents', viewer)).status).toBe(403);
      expect((await api('post', '/api/agents', viewer).send({ name: 'Nope' })).status).toBe(403);
      expect((await request(app).get('/api/agents')).status).toBe(401);
    });

    it('cannot be assigned before publishing, archived or deleted while a chatbot uses it', async () => {
      const draftOnly = await api('post', '/api/agents').send({ name: 'Draft only' });
      const [bot] = await testDb
        .insert(chatbots)
        .values({ companyId: a.company.id, name: 'Assign Bot', type: 'web', status: 'active', publicKey: `pb_as_${crypto.randomBytes(5).toString('hex')}`, config: {} })
        .returning();
      const early = await api('post', '/api/agents/assign').send({ chatbotId: bot!.id, agentId: draftOnly.body.data.agent.id });
      expect(early.status).toBe(409);
      expect(early.body.error.code).toBe('NOT_PUBLISHED');

      const ok = await api('post', '/api/agents/assign').send({ chatbotId: bot!.id, agentId });
      expect(ok.status).toBe(200);
      expect((await api('patch', `/api/agents/${agentId}`).send({ status: 'archived' })).body.error.code).toBe('AGENT_IN_USE');
      expect((await api('delete', `/api/agents/${agentId}`)).body.error.code).toBe('AGENT_IN_USE');

      await api('post', '/api/agents/assign').send({ chatbotId: bot!.id, agentId: null });
      expect((await api('patch', `/api/agents/${agentId}`).send({ status: 'archived' })).status).toBe(200);
      // a foreign chatbot cannot be assigned
      expect((await api('post', '/api/agents/assign', b).send({ chatbotId: bot!.id, agentId: null })).status).toBe(404);
    });
  });

  describe('chat uses the assigned agent', () => {
    let publicKey: string;
    let botId: string;
    let agentId: string;

    beforeAll(async () => {
      publicKey = `pb_ag_${crypto.randomBytes(6).toString('hex')}`;
      const [bot] = await testDb
        .insert(chatbots)
        .values({ companyId: a.company.id, name: 'Agent Bot', type: 'web', status: 'active', publicKey, config: {} })
        .returning();
      botId = bot!.id;
      const created = await api('post', '/api/agents').send({ name: 'Chat Agent', template: 'blank' });
      agentId = created.body.data.agent.id;
      const v = created.body.data.versions[0].id;
      await api('put', `/api/agents/${agentId}/draft`).send({
        prompt: { jobDescription: 'SECRET-JOB-MARKER for {{company_name}}', style: 'Reply in rhyme.' },
        variables: [{ key: 'company_name', source: 'company.name', defaultValue: 'x' }],
        conditions: [{ id: 'c1', field: 'visitor.message', operator: 'contains', value: 'loan', appendPrompt: 'LOAN-MARKER: be precise about EMI.' }],
        model: 'gemini-3.1-flash-lite',
        temperature: 0.25,
        maxOutputTokens: 321,
      });
      await api('post', `/api/agents/${agentId}/versions/${v}/publish`).send({});
      await api('post', '/api/agents/assign').send({ chatbotId: botId, agentId });
    });

    const session = async () => {
      const r = await request(app).post('/public/session').send({ publicKey, visitorId: `v_${crypto.randomBytes(4).toString('hex')}` });
      return { token: r.body.data.sessionToken as string, conversationId: r.body.data.conversationId as string };
    };
    const say = (s: { token: string; conversationId: string }, message: string) =>
      request(app).post('/public/message').set('Authorization', `Bearer ${s.token}`).send({ conversationId: s.conversationId, message });

    it('applies persona, variables, conditions, model, temperature, token cap and conversation memory', async () => {
      const spy = vi.spyOn(retrievalService, 'query');
      const s = await session();
      await say(s, 'Hello there');
      const first = spy.mock.calls[0]!;
      const opts = first[3]!;
      expect(opts.agentInstructions).toContain('SECRET-JOB-MARKER for ');
      expect(opts.agentInstructions).not.toContain('{{');
      expect(opts.agentInstructions).not.toContain('LOAN-MARKER');
      expect(opts).toMatchObject({ model: 'gemini-3.1-flash-lite', temperature: 0.25, maxTokens: 321 });
      expect(opts.history).toEqual([]);

      await say(s, 'I need a home loan');
      const second = spy.mock.calls[1]![3]!;
      expect(second.agentInstructions).toContain('LOAN-MARKER');
      // memory: the first exchange is passed along, the current visitor message is not duplicated
      expect(second.history?.[0]).toEqual({ role: 'visitor', content: 'Hello there' });
      expect(second.history?.some(h => h.content === 'I need a home loan')).toBe(false);
      expect(second.trace).toMatchObject({ agentId, conversationId: s.conversationId, channel: 'web', purpose: 'chat' });
    });

    it('a chatbot without an agent keeps the legacy path (no options)', async () => {
      const [bot2] = await testDb
        .insert(chatbots)
        .values({ companyId: a.company.id, name: 'Legacy', type: 'web', status: 'active', publicKey: `pb_lg_${crypto.randomBytes(5).toString('hex')}`, config: {} })
        .returning();
      const spy = vi.spyOn(retrievalService, 'query');
      const r = await request(app).post('/public/session').send({ publicKey: bot2!.publicKey, visitorId: 'v_legacy' });
      await request(app)
        .post('/public/message')
        .set('Authorization', `Bearer ${r.body.data.sessionToken}`)
        .send({ conversationId: r.body.data.conversationId, message: 'hello' });
      expect(spy.mock.calls[0]![3]).toBeUndefined();
    });

    it('scopes retrieval to the agent\'s sources and knowledge references', async () => {
      const [s1, s2] = await testDb
        .insert(knowledgeSources)
        .values([
          { companyId: a.company.id, chatbotId: botId, title: 'Brochure', type: 'text', status: 'ready', config: {} },
          { companyId: a.company.id, chatbotId: botId, title: 'Price list', type: 'text', status: 'ready', config: {} },
        ])
        .returning();
      const ref = await api('post', '/api/knowledge-references').send({ name: 'Pricing only', sourceIds: [s2!.id] });
      expect(ref.status).toBe(201);
      await api('put', `/api/agents/${agentId}/draft`).send({ knowledge: { sourceIds: [s1!.id], referenceIds: [ref.body.data.id] } });
      const draft = (await api('get', `/api/agents/${agentId}`)).body.data.versions[0];
      await api('post', `/api/agents/${agentId}/versions/${draft.id}/publish`).send({});

      const spy = vi.spyOn(retrievalService, 'query');
      const s = await session();
      await say(s, 'hi');
      expect([...(spy.mock.calls[0]![3]!.sourceIds ?? [])].sort()).toEqual([s1!.id, s2!.id].sort());

      // references are tenant scoped
      expect((await api('get', '/api/knowledge-references', b)).body.data).toEqual([]);
      expect((await api('post', '/api/knowledge-references', b).send({ name: 'x1', sourceIds: [s1!.id] })).status).toBe(400);
    });

    it('logs every model call in llm_calls with agent, version, conversation and outcome', async () => {
      const s = await session();
      await say(s, 'tell me about the project');
      const row = await waitFor(async () => {
        const rows = await testDb.select().from(llmCalls).where(eq(llmCalls.conversationId, s.conversationId));
        return rows[0];
      });
      expect(row).toMatchObject({ companyId: a.company.id, agentId, purpose: 'chat', channel: 'web' });
      expect(row.agentVersionId).toBeTruthy();
      expect(['ok', 'fallback']).toContain(row.status);
      expect(row.totalTokens).toBeGreaterThan(0);
    });

    it('collects form attributes from the conversation, validates them and attaches them to the lead', async () => {
      const forms = await api('get', '/api/forms');
      const buyer = forms.body.data.find((f: { key: string }) => f.key === 'buyer_profile');
      const created = await api('post', '/api/agents').send({ name: 'Collector', template: 'blank' });
      const cid = created.body.data.agent.id;
      await api('put', `/api/agents/${cid}/draft`).send({ prompt: { jobDescription: 'Collect buyer details.' }, formId: buyer.id });
      await api('post', `/api/agents/${cid}/versions/${created.body.data.versions[0].id}/publish`).send({});
      const [bot3] = await testDb
        .insert(chatbots)
        .values({ companyId: a.company.id, name: 'Collector Bot', type: 'web', status: 'active', publicKey: `pb_co_${crypto.randomBytes(5).toString('hex')}`, config: {} })
        .returning();
      await api('post', '/api/agents/assign').send({ chatbotId: bot3!.id, agentId: cid });

      let call = 0;
      setAttributeExtractor(async () => {
        call += 1;
        return call === 1
          ? { budget_max: '15000000', bhk: ['3bhk', 'Penthouse-XL'], purpose: 'Rent', evil_key: 'x' } // partly invalid
          : { budget_max: 15000000, bhk: ['3bhk'], loan_needed: 'yes' };
      });

      const r = await request(app).post('/public/session').send({ publicKey: bot3!.publicKey, visitorId: 'v_collect' });
      const token = r.body.data.sessionToken as string;
      const conversationId = r.body.data.conversationId as string;
      const post = (message: string) => request(app).post('/public/message').set('Authorization', `Bearer ${token}`).send({ conversationId, message });

      await post('My budget is 1.5 Cr for a 3BHK');
      // no lead yet: invalid values are rejected, valid ones wait on the conversation
      const meta = await waitFor(async () => {
        const [c] = await testDb.select().from(conversations).where(eq(conversations.id, conversationId));
        const collected = (c!.metadata as { collectedAttributes?: Record<string, unknown> }).collectedAttributes;
        return collected;
      });
      expect(meta).toEqual({ budget_max: 15000000 }); // bhk rejected (unknown choice), purpose rejected, evil_key dropped

      // the visitor shares contact details: pending attributes move to the new lead
      const lead = await request(app)
        .post('/public/lead')
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: 'Collect Me', phone: '9876543299', conversationId });
      expect(lead.status).toBe(200);
      const [row] = await testDb.select().from(leads).where(eq(leads.companyId, a.company.id)).then(r2 => r2.filter(l => (l.customFields as { attributes?: unknown }).attributes));
      expect((row!.customFields as { attributes: Record<string, unknown> }).attributes).toEqual({ budget_max: 15000000 });
      const subs = await testDb.select().from(formSubmissions).where(eq(formSubmissions.leadId, row!.id));
      expect(subs).toHaveLength(1);
      expect(subs[0]!.agentId).toBe(cid);

      // later messages write straight to the lead
      await post('Yes I will need a loan');
      const updated = await waitFor(async () => {
        const [l] = await testDb.select().from(leads).where(eq(leads.id, row!.id));
        const attrs = (l!.customFields as { attributes: Record<string, unknown> }).attributes;
        return attrs.loan_needed === true ? attrs : undefined;
      });
      expect(updated).toMatchObject({ budget_max: 15000000, bhk: ['3BHK'], loan_needed: true });
    });
  });

  describe('test panel and version comparison', () => {
    let agentId: string;
    let v1: string;
    let v2: string;
    beforeAll(async () => {
      const created = await api('post', '/api/agents').send({ name: 'Compare Me', template: 'lead_qualifier' });
      agentId = created.body.data.agent.id;
      v1 = created.body.data.versions[0].id;
      await api('post', `/api/agents/${agentId}/versions/${v1}/publish`).send({});
      const draft = await api('put', `/api/agents/${agentId}/draft`).send({ temperature: 0.2, changeNote: 'v2' });
      v2 = draft.body.data.id;
      await testDb.insert(chatbots).values({ companyId: a.company.id, name: 'KB Bot', type: 'web', status: 'active', publicKey: `pb_kb_${crypto.randomBytes(5).toString('hex')}`, config: {} });
    });

    it('runs a draft before publishing and reports prompt, tokens and model', async () => {
      const res = await api('post', `/api/agents/${agentId}/test`).send({ versionId: v2, messages: [{ role: 'visitor', content: 'What is the price?' }], variables: { visitor_name: 'Asha' } });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ version: 2, model: 'gemini-3.8-flash' });
      expect(typeof res.body.data.reply).toBe('string');
      expect(res.body.data.instructions).toContain('JOB');
      expect(res.body.data.instructions).toContain('Asha');
    });

    it('the last message must be the visitor\'s', async () => {
      const res = await api('post', `/api/agents/${agentId}/test`).send({ messages: [{ role: 'visitor', content: 'a' }, { role: 'assistant', content: 'b' }] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('LAST_MESSAGE_NOT_VISITOR');
    });

    it('compares two versions across several messages with separate histories', async () => {
      const res = await api('post', `/api/agents/${agentId}/compare`).send({ versionA: v1, versionB: v2, messages: ['hello', 'what about 3BHK?'] });
      expect(res.status).toBe(200);
      expect(res.body.data.rows).toHaveLength(2);
      expect(res.body.data.a).toMatchObject({ version: 1 });
      expect(res.body.data.b).toMatchObject({ version: 2 });
      expect(res.body.data.rows[1].a.reply).toBeTruthy();
    });

    it('saves, updates and deletes reusable test cases per agent', async () => {
      const c = await api('post', `/api/agents/${agentId}/test-cases`).send({ name: 'Budget flow', messages: ['hi', 'budget 1 Cr'] });
      expect(c.status).toBe(201);
      const upd = await api('put', `/api/agents/${agentId}/test-cases/${c.body.data.id}`).send({ name: 'Budget flow v2', messages: ['hi'] });
      expect(upd.body.data.name).toBe('Budget flow v2');
      expect((await api('get', `/api/agents/${agentId}/test-cases`)).body.data).toHaveLength(1);
      expect((await api('get', `/api/agents/${agentId}/test-cases`, b)).status).toBe(404);
      expect((await api('delete', `/api/agents/${agentId}/test-cases/${c.body.data.id}`)).status).toBe(200);
    });

    it('test calls are logged as purpose test / compare', async () => {
      const rows = await waitFor(async () => {
        const r = await testDb.select().from(llmCalls).where(and(eq(llmCalls.agentId, agentId)));
        return r.some(x => x.purpose === 'compare') && r.some(x => x.purpose === 'test') ? r : undefined;
      });
      expect(rows.every(x => x.channel === 'agent_test')).toBe(true);
    });
  });

  it('discarding the only version is refused; drafts can be discarded', async () => {
    const created = await api('post', '/api/agents').send({ name: 'Discard test' });
    const id = created.body.data.agent.id;
    const v = created.body.data.versions[0].id;
    expect((await api('delete', `/api/agents/${id}/versions/${v}`)).body.error.code).toBe('LAST_VERSION');
    await api('post', `/api/agents/${id}/versions/${v}/publish`).send({}); // blank job -> 400
    await api('put', `/api/agents/${id}/draft`).send({ prompt: { jobDescription: 'job' } });
    await api('post', `/api/agents/${id}/versions/${v}/publish`).send({});
    const d2 = await api('put', `/api/agents/${id}/draft`).send({ temperature: 0.3 });
    expect((await api('delete', `/api/agents/${id}/versions/${d2.body.data.id}`)).status).toBe(200);
    expect((await api('get', `/api/agents/${id}`)).body.data.versions).toHaveLength(1);
    void agents;
    void modelRouter;
  });
});
