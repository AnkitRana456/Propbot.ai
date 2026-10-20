import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser } from '../helpers/test-fixtures.js';
import { appointments, chatbots, contacts, conversations, forms, formFields, leadActivities, leads, messages, voiceCalls } from '../../src/db/schema/index.js';
import { classify } from '../../src/modules/intelligence/insights.service.js';
import { retrievalService } from '../../src/modules/ai/retrieval.service.js';

describe('P6: data and intelligence', () => {
  const app = createApp();
  let a: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let b: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let agent: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let botId = '';
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, who = a) => request(app)[method](url).set('Authorization', who.authHeader);

  async function person(first: string, phone: string, patch: Partial<typeof leads.$inferInsert> = {}) {
    const [c] = await testDb.insert(contacts).values({ companyId: a.company.id, firstName: first, lastName: 'T', phone }).returning();
    const [l] = await testDb.insert(leads).values({ companyId: a.company.id, contactId: c!.id, chatbotId: botId, ...patch }).returning();
    return { c: c!, l: l! };
  }
  async function chat(p: Awaited<ReturnType<typeof person>>, lines: string[]) {
    const [conv] = await testDb.insert(conversations).values({ companyId: a.company.id, chatbotId: botId, contactId: p.c.id, leadId: p.l.id, channel: 'web' }).returning();
    for (const [i, t] of lines.entries()) await testDb.insert(messages).values({ companyId: a.company.id, conversationId: conv!.id, senderType: 'visitor', content: t, createdAt: new Date(Date.now() - (lines.length - i) * 1000) });
    return conv!;
  }

  let hot3bhk: Awaited<ReturnType<typeof person>>;
  let cold2bhk: Awaited<ReturnType<typeof person>>;
  let visited: Awaited<ReturnType<typeof person>>;

  beforeAll(async () => {
    a = await createAuthenticatedUser('company_admin');
    b = await createAuthenticatedUser('company_admin');
    agent = await createAuthenticatedUser('agent', { id: a.company.id } as never);
    const [bot] = await testDb.insert(chatbots).values({ companyId: a.company.id, name: 'Intel Bot', type: 'web', status: 'active', publicKey: `pb_int_${crypto.randomBytes(5).toString('hex')}`, config: {} }).returning();
    botId = bot!.id;
    hot3bhk = await person('Hot', '+919833300001', { status: 'qualified', intentLabel: 'hot', intentScore: 85, source: 'meta_lead_ads', customFields: { attributes: { bhk: '3', budget: 11000000 } } });
    cold2bhk = await person('Cold', '+919833300002', { status: 'new', intentLabel: 'cold', intentScore: 20, source: 'website', customFields: { attributes: { bhk: '2', budget: 6000000 } } });
    visited = await person('Visited', '+919833300003', { status: 'site_visit_done', intentLabel: 'warm', intentScore: 60, source: 'website', customFields: { attributes: { bhk: '3', budget: 9000000 } } });
    await testDb.insert(appointments).values({ companyId: a.company.id, leadId: visited.l.id, scheduledAt: new Date(Date.now() - 86_400_000), status: 'completed' } as never);
  });
  afterAll(async () => {
    await cleanupTestDatabase([a.company.id, b.company.id]);
  });
  afterEach(() => vi.restoreAllMocks());

  describe('classification', () => {
    it('reads intent, labels and sentiment from what the buyer wrote', () => {
      expect(classify('what is the price of a 3bhk? also can I schedule a site visit')).toMatchObject({ intent: 'site_visit', labels: expect.arrayContaining(['price_enquiry', 'site_visit']), sentiment: 'neutral' });
      expect(classify('I need a home loan, what is the EMI')).toMatchObject({ intent: 'loan' });
      expect(classify('this is the worst service, I want a refund').sentiment).toBe('negative');
      expect(classify('hello').labels).toEqual(['other']);
    });
  });

  describe('tags', () => {
    let tagId = '';
    it('creates unique tags per entity type and lists usage', async () => {
      const t = await api('post', '/api/tags').send({ name: 'Hot buyer', color: '#ff0000', entityType: 'lead' });
      expect(t.status).toBe(201);
      tagId = t.body.data.id;
      expect((await api('post', '/api/tags').send({ name: 'hot BUYER', entityType: 'lead' })).status).toBe(409);
      expect((await api('post', '/api/tags').send({ name: 'Hot buyer', entityType: 'contact' })).status).toBe(201);
      expect((await api('post', '/api/tags').send({ name: 'x', color: 'red' })).status).toBe(400);
      expect((await api('get', '/api/tags', b)).body.data).toEqual([]);
    });
    it('applies tags only to your own records of the right type', async () => {
      const ok = await api('post', `/api/tags/${tagId}/apply`).send({ entityType: 'lead', entityIds: [hot3bhk.l.id, hot3bhk.l.id] });
      expect(ok.body.data.applied).toBe(1);
      expect((await api('post', `/api/tags/${tagId}/apply`).send({ entityType: 'contact', entityIds: [hot3bhk.c.id] })).status).toBe(400);
      expect((await api('post', `/api/tags/${tagId}/apply`, b).send({ entityType: 'lead', entityIds: [hot3bhk.l.id] })).status).toBe(404);
      const other = await createAuthenticatedUser('company_admin');
      const [oc] = await testDb.insert(contacts).values({ companyId: other.company.id, firstName: 'Z', phone: '+919833399999' }).returning();
      const [ol] = await testDb.insert(leads).values({ companyId: other.company.id, contactId: oc!.id }).returning();
      expect((await api('post', `/api/tags/${tagId}/apply`).send({ entityType: 'lead', entityIds: [ol!.id] })).status).toBe(400);
      await cleanupTestDatabase([other.company.id]);
      expect((await api('get', '/api/tags')).body.data.find((t: { id: string }) => t.id === tagId).usageCount).toBe(1);
      expect((await api('post', `/api/tags/${tagId}/unapply`).send({ entityType: 'lead', entityIds: [hot3bhk.l.id] })).body.data.removed).toBe(1);
    });
  });

  describe('groups (dynamic rules)', () => {
    let groupId = '';
    const rules = [
      { field: 'attribute', key: 'bhk', op: 'equals', value: '3' },
      { field: 'attribute', key: 'budget', op: 'between', value: [8000000, 12000000] },
      { field: 'has_visit', op: 'is_false' },
    ];
    it('previews and builds "3BHK buyers, 80L-1.2Cr, no visit yet"', async () => {
      expect((await api('post', '/api/groups/preview').send({ rules })).body.data.count).toBe(1);
      const g = await api('post', '/api/groups').send({ name: 'Hot 3BHK, no visit', rules });
      expect(g.status, JSON.stringify(g.body)).toBe(201);
      groupId = g.body.data.id;
      expect(g.body.data.memberCount).toBe(1);
      const members = (await api('get', `/api/groups/${groupId}/members`)).body.data;
      expect(members.map((m: { name: string }) => m.name)).toEqual(['Hot T']);
    });
    it('supports status, score, source, recency, visits and tags', async () => {
      const count = async (r: object[]) => (await api('post', '/api/groups/preview').send({ rules: r })).body.data.count as number;
      expect(await count([{ field: 'status', op: 'in', value: ['qualified', 'new'] }])).toBeGreaterThanOrEqual(2);
      expect(await count([{ field: 'intent_score', op: 'gte', value: 80 }])).toBe(1);
      expect(await count([{ field: 'source', op: 'contains', value: 'meta' }])).toBe(1);
      expect(await count([{ field: 'created_days_ago', op: 'lte', value: 1 }])).toBe(3);
      expect(await count([{ field: 'visit_completed', op: 'is_true' }])).toBe(1);
      expect(await count([{ field: 'has_tag', op: 'equals', value: 'Hot buyer' }])).toBe(0);
      expect(await count([{ field: 'attribute', key: 'bhk', op: 'equals', value: '2' }])).toBe(1);
    });
    it('rejects bad rules instead of guessing, and is not injectable', async () => {
      expect((await api('post', '/api/groups/preview').send({ rules: [{ field: 'attribute', op: 'equals', value: '3' }] })).status).toBe(400);
      expect((await api('post', '/api/groups/preview').send({ rules: [{ field: 'intent_score', op: 'gte', value: 'abc' }] })).status).toBe(400);
      expect((await api('post', '/api/groups/preview').send({ rules: [{ field: 'status', op: 'gte', value: 1 }] })).status).toBe(400);
      const inj = await api('post', '/api/groups/preview').send({ rules: [{ field: 'status', op: 'equals', value: "x' OR '1'='1" }] });
      expect(inj.body.data.count).toBe(0);
      const injKey = await api('post', '/api/groups/preview').send({ rules: [{ field: 'attribute', key: "bhk') OR 1=1 --", op: 'equals', value: '1' }] });
      expect(injKey.status).toBe(400);
    });
    it('re-evaluates on refresh and isolates tenants', async () => {
      await testDb.update(leads).set({ customFields: { attributes: { bhk: '3', budget: 10000000 } } }).where(eq(leads.id, cold2bhk.l.id));
      const r = await api('post', `/api/groups/${groupId}/refresh`);
      expect(r.body.data.memberCount).toBe(2);
      await testDb.update(leads).set({ customFields: { attributes: { bhk: '2', budget: 6000000 } } }).where(eq(leads.id, cold2bhk.l.id));
      expect((await api('post', `/api/groups/${groupId}/refresh`)).body.data.memberCount).toBe(1);
      expect((await api('get', `/api/groups/${groupId}/members`, b)).status).toBe(404);
      expect((await api('get', '/api/groups', b)).body.data).toEqual([]);
    });
  });

  describe('insights, surveys and the 360 view', () => {
    it('summarises a conversation, labels it and auto-tags from the label', async () => {
      await api('post', '/api/tags').send({ name: 'Wants a visit', entityType: 'lead', autoRule: { aiLabel: 'site_visit' } });
      const conv = await chat(hot3bhk, ['What is the price of a 3bhk?', 'Can I schedule a site visit this Saturday?']);
      const res = await api('post', `/api/customer360/conversations/${conv.id}/insight`);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.data).toMatchObject({ intent: 'site_visit', sentiment: 'neutral' });
      expect(res.body.data.labels).toEqual(expect.arrayContaining(['price_enquiry', 'site_visit']));
      expect((await api('get', `/api/customer360/conversations/${conv.id}/insight`)).body.data.conversationId).toBe(conv.id);
      const tagged = await api('post', '/api/groups/preview').send({ rules: [{ field: 'has_tag', op: 'equals', value: 'Wants a visit' }] });
      expect(tagged.body.data.count).toBe(1);
      expect((await api('post', `/api/customer360/conversations/${conv.id}/insight`, b)).status).toBe(404);
    });
    it('refuses to analyse an empty conversation', async () => {
      const [empty] = await testDb.insert(conversations).values({ companyId: a.company.id, chatbotId: botId, contactId: cold2bhk.c.id, leadId: cold2bhk.l.id, channel: 'web' }).returning();
      expect((await api('post', `/api/customer360/conversations/${empty!.id}/insight`)).status).toBe(400);
    });
    it('computes CSAT and NPS correctly and flags estimated scores', async () => {
      const csat = (await api('post', '/api/surveys').send({ name: 'Post-visit CSAT', kind: 'csat' })).body.data;
      const nps = (await api('post', '/api/surveys').send({ name: 'NPS', kind: 'nps' })).body.data;
      expect((await api('post', `/api/surveys/${csat.id}/responses`).send({ score: 6 })).status).toBe(400);
      expect((await api('post', `/api/surveys/${nps.id}/responses`).send({ score: 11 })).status).toBe(400);
      for (const s of [5, 4, 3]) await api('post', `/api/surveys/${csat.id}/responses`).send({ score: s, leadId: hot3bhk.l.id });
      expect((await api('get', `/api/surveys/${csat.id}/stats`)).body.data.score).toBe(4);
      for (const s of [10, 9, 8, 3]) await api('post', `/api/surveys/${nps.id}/responses`).send({ score: s });
      const st = (await api('get', `/api/surveys/${nps.id}/stats`)).body.data;
      expect(st).toMatchObject({ score: 25, promoters: 2, passives: 1, detractors: 1, responses: 4 });
      const angry = await chat(cold2bhk, ['this is useless, worst service ever!!']);
      const est = await api('post', `/api/surveys/${csat.id}/responses`).send({ conversationId: angry.id });
      expect(est.body.data).toMatchObject({ score: 1, estimated: true });
      expect((await api('get', `/api/surveys/${csat.id}/stats`)).body.data.estimated).toBe(1);
      expect((await api('post', `/api/surveys/${csat.id}/responses`).send({})).status).toBe(400);
      expect((await api('get', `/api/surveys/${csat.id}/stats`, b)).status).toBe(404);
    });
    it('builds a unified timeline across messages, calls, visits, activities and notes', async () => {
      await testDb.insert(voiceCalls).values({ companyId: a.company.id, leadId: hot3bhk.l.id, contactId: hot3bhk.c.id, callSid: 'c360', fromNumber: 'x', toNumber: 'y', status: 'completed', outcome: 'qualified', summary: 'Asked for a visit', startedAt: new Date() });
      await testDb.insert(leadActivities).values({ companyId: a.company.id, leadId: hot3bhk.l.id, contactId: hot3bhk.c.id, activityType: 'note', title: 'Spoke on WhatsApp', description: 'Wants east facing' });
      await testDb.insert(appointments).values({ companyId: a.company.id, leadId: hot3bhk.l.id, scheduledAt: new Date(Date.now() + 86_400_000), status: 'scheduled' } as never);
      const res = await api('get', `/api/customer360/contacts/${hot3bhk.c.id}`);
      expect(res.status).toBe(200);
      const kinds = new Set(res.body.data.timeline.map((t: { kind: string }) => t.kind));
      expect([...kinds].sort()).toEqual(['activity', 'call', 'message', 'survey', 'visit']);
      const times = res.body.data.timeline.map((t: { at: string }) => t.at);
      expect([...times].sort().reverse()).toEqual(times);
      expect(res.body.data.lead).toMatchObject({ status: 'qualified', intentScore: 85, attributes: { bhk: '3' } });
      expect(res.body.data.insights[0].intent).toBe('site_visit');
      expect(res.body.data.stats).toMatchObject({ calls: 1, visits: 1, conversations: 1 });
      expect((await api('get', `/api/customer360/contacts/${hot3bhk.c.id}`, b)).status).toBe(404);
    });
  });

  describe('dashboards', () => {
    it('builds a dashboard from the metric catalogue and serves widget data', async () => {
      const d = (await api('post', '/api/dashboards').send({ name: 'Weekly', isShared: true })).body.data;
      const mk = async (type: string, metric: string, title = metric) => (await api('post', `/api/dashboards/${d.id}/widgets`).send({ type, title, config: { metric, days: 30 } })).body.data;
      const total = await mk('kpi', 'leads_total');
      const bySource = await mk('bar', 'leads_by_source');
      const funnel = await mk('funnel', 'funnel');
      const conv = await mk('kpi', 'visit_conversion');
      const data = async (w: { id: string }) => (await api('get', `/api/dashboards/${d.id}/widgets/${w.id}/data`)).body.data;
      expect(await data(total)).toEqual({ kind: 'number', value: 3 });
      expect((await data(bySource)).points).toEqual(expect.arrayContaining([{ label: 'website', value: 2 }, { label: 'meta_lead_ads', value: 1 }]));
      expect((await data(funnel)).points.map((p: { label: string }) => p.label)).toEqual(['Leads', 'Contacted', 'Qualified', 'Site visit', 'Booked']);
      expect((await data(conv)).value).toBe(67);
      for (const m of ['leads_by_stage', 'leads_over_time', 'leads_by_agency_partner', 'visits_by_status', 'first_response_minutes', 'ai_resolution_rate', 'call_outcomes', 'campaign_performance', 'csat_average']) {
        const w = await mk('table', m);
        const out = await data(w);
        expect(['number', 'series'], m).toContain(out.kind);
      }
      expect((await api('post', `/api/dashboards/${d.id}/widgets`).send({ type: 'kpi', title: 'x', config: { metric: 'drop table' } })).status).toBe(400);
    });
    it('shares only when asked and never across companies', async () => {
      const mine = (await api('post', '/api/dashboards').send({ name: 'Private' })).body.data;
      const shared = (await api('post', '/api/dashboards').send({ name: 'Team view', isShared: true })).body.data;
      const mate = await createAuthenticatedUser('sales_manager', { id: a.company.id } as never);
      const list = (await api('get', '/api/dashboards', mate)).body.data.map((x: { id: string }) => x.id);
      expect(list).toContain(shared.id);
      expect(list).not.toContain(mine.id);
      expect((await api('get', `/api/dashboards/${mine.id}`, mate)).status).toBe(404);
      expect((await api('delete', `/api/dashboards/${shared.id}`, mate)).status).toBe(404); // shared = viewable, not editable
      expect((await api('get', `/api/dashboards/${shared.id}`, b)).status).toBe(404);
      expect((await api('delete', `/api/dashboards/${mine.id}`)).status).toBe(200);
    });
  });

  describe('boards', () => {
    let boardId = '';
    it('creates a board with columns and validates tasks against its form', async () => {
      const [f] = await testDb.insert(forms).values({ companyId: a.company.id, key: 'loan_docs', name: 'Loan docs', purpose: 'task' }).returning();
      await testDb.insert(formFields).values({ formId: f!.id, companyId: a.company.id, key: 'bank', label: 'Bank', type: 'select', options: ['HDFC', 'SBI'], position: 0 });
      const res = await api('post', '/api/boards').send({ name: 'Loan processing', formId: f!.id });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      boardId = res.body.data.id;
      expect(res.body.data.columns.map((c: { key: string }) => c.key)).toEqual(['todo', 'doing', 'done']);
      expect((await api('post', '/api/boards').send({ name: 'Dup cols', columns: [{ key: 'a1', label: 'A' }, { key: 'a1', label: 'B' }] })).status).toBe(400);
      expect((await api('post', `/api/boards/${boardId}/tasks`).send({ title: 'Bad', data: { bank: 'ICICI' } })).status).toBe(400);
      const ok = await api('post', `/api/boards/${boardId}/tasks`).send({ title: 'File application', data: { bank: 'HDFC' }, assigneeId: agent.user.id, leadId: hot3bhk.l.id });
      expect(ok.status, JSON.stringify(ok.body)).toBe(201);
      expect(ok.body.data).toMatchObject({ columnKey: 'todo', position: 0, data: { bank: 'HDFC' } });
      expect((await api('post', `/api/boards/${boardId}/tasks`).send({ title: 'x', assigneeId: b.user.id })).status).toBe(400);
      expect((await api('post', `/api/boards/${boardId}/tasks`).send({ title: 'x', columnKey: 'nope' })).status).toBe(400);
    });
    it('moves tasks and keeps positions dense', async () => {
      const t1 = (await api('post', `/api/boards/${boardId}/tasks`).send({ title: 'T1' })).body.data;
      const t2 = (await api('post', `/api/boards/${boardId}/tasks`).send({ title: 'T2' })).body.data;
      await api('post', `/api/boards/${boardId}/tasks/${t1.id}/move`).send({ columnKey: 'doing', position: 0 });
      const after = (await api('post', `/api/boards/${boardId}/tasks/${t2.id}/move`).send({ columnKey: 'doing', position: 0 })).body.data as Array<{ title: string; columnKey: string; position: number }>;
      expect(after.filter(t => t.columnKey === 'doing').sort((x, y) => x.position - y.position).map(t => `${t.title}:${t.position}`)).toEqual(['T2:0', 'T1:1']);
      expect(after.filter(t => t.columnKey === 'todo').map(t => t.position).sort()).toEqual([0]);
      expect((await api('post', `/api/boards/${boardId}/tasks/${t1.id}/move`, b).send({ columnKey: 'done' })).status).toBe(404);
    });
    it('flags overdue tasks, stores comments and protects columns in use', async () => {
      const t = (await api('post', `/api/boards/${boardId}/tasks`).send({ title: 'Late', dueAt: new Date(Date.now() - 3600_000).toISOString() })).body.data;
      expect(t.overdue).toBe(true);
      const c = await api('post', `/api/boards/${boardId}/tasks/${t.id}/comments`).send({ body: 'Chased the bank' });
      expect(c.status).toBe(201);
      expect((await api('get', `/api/boards/${boardId}/tasks/${t.id}/comments`)).body.data).toHaveLength(1);
      expect((await api('get', `/api/boards/${boardId}/tasks`)).body.data.find((x: { id: string }) => x.id === t.id).commentCount).toBe(1);
      const cols = (await api('get', '/api/boards')).body.data[0].columns.filter((x: { key: string }) => x.key !== 'todo');
      expect((await api('put', `/api/boards/${boardId}`).send({ columns: cols })).status).toBe(409);
      await api('post', `/api/boards/${boardId}/tasks/${t.id}/move`).send({ columnKey: 'done' });
      expect((await api('get', '/api/boards', b)).body.data).toEqual([]);
    });
  });

  describe('knowledge tester', () => {
    it('shows retrieved chunks and scores without generating an answer, and keeps history', async () => {
      const spy = vi.spyOn(retrievalService, 'query').mockResolvedValue({ answer: '', citations: [{ sourceId: crypto.randomUUID(), sourceTitle: 'Pricing sheet', sourceType: 'document', snippet: 'Starts at 85 lakh', similarityScore: 0.83 }], isGrounded: true } as never);
      const res = await api('post', '/api/kb-tester').send({ chatbotId: botId, question: 'How much is a 2bhk?' });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(res.body.data).toMatchObject({ bestScore: 0.83, grounded: true });
      expect(spy.mock.calls[0]![3]).toMatchObject({ skipGeneration: true });
      expect((await api('get', '/api/kb-tester')).body.data).toHaveLength(1);
      expect((await api('post', '/api/kb-tester', b).send({ chatbotId: botId, question: 'steal?' })).status).toBe(400);
    });
  });
});
