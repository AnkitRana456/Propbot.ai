import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { FlowGraph } from '@propbot/shared';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createAuthenticatedUser } from '../helpers/test-fixtures.js';
import { chatbots, contacts, conversations, flowExecutions, flowTriggers, leads, messages, companyAiSettings } from '../../src/db/schema/index.js';
import { handleFlowEvent } from '../../src/modules/flows/flow-events.js';
import { flowEngine, readPath, renderVars, compare } from '../../src/modules/flows/flow-engine.js';
import { modelRouter } from '../../src/modules/ai/router.js';
import { inventoryService } from '../../src/modules/inventory/inventory.service.js';
import { units } from '../../src/db/schema/index.js';

type Node = FlowGraph['nodes'][number];
const node = (id: string, type: Node['type'], data: Record<string, unknown> = {}): Node => ({ id, type, position: { x: 0, y: 0 }, data });
const edge = (source: string, target: string, sourceHandle?: string) => ({ id: `${source}-${target}-${sourceHandle ?? 'out'}`, source, target, sourceHandle: sourceHandle ?? null });

describe('P3: flow builder v2', () => {
  const app = createApp();
  let a: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let b: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let agentUser: Awaited<ReturnType<typeof createAuthenticatedUser>>;
  let leadId = '';
  let conversationId = '';
  const api = (method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, who = a) => request(app)[method](url).set('Authorization', who.authHeader);

  /** Creates a flow, saves the graph and publishes it. */
  async function publishFlow(name: string, graph: FlowGraph, settings?: { maxSteps: number }) {
    const created = await api('post', '/api/flows').send({ name });
    expect(created.status).toBe(201);
    const id = created.body.data.flow.id as string;
    const saved = await api('put', `/api/flows/${id}/draft`).send({ graph, settings });
    expect(saved.status).toBe(200);
    const pub = await api('post', `/api/flows/${id}/versions/${saved.body.data.id}/publish`);
    expect(pub.status, JSON.stringify(pub.body)).toBe(200);
    return { id, versionId: saved.body.data.id as string };
  }
  const botMessages = async () =>
    (await testDb.select().from(messages).where(eq(messages.conversationId, conversationId))).filter(m => m.senderType === 'bot').map(m => m.content);
  const fire = (type: string, payload: Record<string, unknown> = {}) =>
    handleFlowEvent({ id: crypto.randomUUID(), companyId: a.company.id, type, payload: { lead_id: leadId, ...payload } });
  const executions = async () => testDb.select().from(flowExecutions).where(eq(flowExecutions.companyId, a.company.id));

  beforeAll(async () => {
    a = await createAuthenticatedUser('company_admin');
    b = await createAuthenticatedUser('company_admin');
    agentUser = await createAuthenticatedUser('agent', { id: a.company.id } as never);
    const [bot] = await testDb.insert(chatbots).values({ companyId: a.company.id, name: 'Bot', type: 'web', status: 'active', publicKey: `pb_flow_${crypto.randomBytes(5).toString('hex')}`, config: {} }).returning();
    const [contact] = await testDb.insert(contacts).values({ companyId: a.company.id, firstName: 'Asha', lastName: 'Rao', phone: '+919800000001' }).returning();
    const [lead] = await testDb.insert(leads).values({ companyId: a.company.id, contactId: contact!.id, chatbotId: bot!.id, status: 'new' }).returning();
    leadId = lead!.id;
    const [conv] = await testDb.insert(conversations).values({ companyId: a.company.id, chatbotId: bot!.id, contactId: contact!.id, leadId, channel: 'web' }).returning();
    conversationId = conv!.id;
  });
  afterAll(async () => {
    await cleanupTestDatabase([a.company.id, b.company.id]);
  });
  afterEach(() => vi.restoreAllMocks());

  describe('pure helpers', () => {
    it('reads paths, renders templates and compares', () => {
      const root = { lead: { name: 'Asha' }, vars: { budget: 90 } };
      expect(readPath(root, 'lead.name')).toBe('Asha');
      expect(readPath(root, 'budget')).toBe(90);
      expect(readPath(root, '__proto__.x')).toBeUndefined();
      expect(renderVars('Hi {{lead.name}} {{nope}}!', root)).toBe('Hi Asha !');
      expect(compare('greater_than', 90, '80')).toBe(true);
      expect(compare('contains', 'Tower B', 'tower')).toBe(true);
      expect(compare('is_empty', undefined, '')).toBe(true);
    });
  });

  describe('flow management', () => {
    it('lists templates and creates from one', async () => {
      const t = await api('get', '/api/flows/templates');
      expect(t.body.data.map((x: { id: string }) => x.id)).toContain('visit_reminders');
      const res = await api('post', '/api/flows').send({ name: 'My reminders', template: 'visit_reminders' });
      expect(res.status).toBe(201);
      expect(res.body.data.versions[0].graph.nodes.length).toBeGreaterThan(3);
      expect((await api('post', '/api/flows').send({ name: 'my reminders' })).status).toBe(409);
    });
    it('validates before publishing and never activates a broken graph', async () => {
      const created = await api('post', '/api/flows').send({ name: 'Broken' });
      const id = created.body.data.flow.id as string;
      const v = created.body.data.versions[0].id as string;
      const pub = await api('post', `/api/flows/${id}/versions/${v}/publish`);
      expect(pub.status).toBe(422);
      expect(pub.body.error.message).toContain('starts');
    });
    it('enforces permissions and tenant isolation', async () => {
      expect((await api('get', '/api/flows', agentUser)).status).toBe(403);
      const flow = await api('post', '/api/flows').send({ name: 'Private flow' });
      expect((await api('get', `/api/flows/${flow.body.data.flow.id}`, b)).status).toBe(404);
      expect((await api('get', '/api/flows', b)).body.data).toEqual([]);
    });
    it('keeps versions linear: draft -> publish -> new draft -> rollback', async () => {
      const g1: FlowGraph = { nodes: [node('t', 'trigger', { triggerType: 'webhook' }), node('m', 'send_message', { text: 'v1' })], edges: [edge('t', 'm')] };
      const { id, versionId } = await publishFlow('Versioned', g1);
      const g2: FlowGraph = { ...g1, nodes: [g1.nodes[0]!, node('m', 'send_message', { text: 'v2' })] };
      const d2 = await api('put', `/api/flows/${id}/draft`).send({ graph: g2 });
      expect(d2.body.data.version).toBe(2);
      await api('post', `/api/flows/${id}/versions/${d2.body.data.id}/publish`);
      const rb = await api('post', `/api/flows/${id}/versions/${versionId}/rollback`);
      expect(rb.status).toBe(200);
      expect(rb.body.data.flow.activeVersion).toBe(3);
      expect(rb.body.data.versions.find((v: { version: number }) => v.version === 3).graph.nodes[1].data.text).toBe('v1');
    });
  });

  describe('engine', () => {
    it('runs a new-lead flow end to end and records every step', async () => {
      const { id } = await publishFlow('Instant reply', {
        nodes: [node('t', 'trigger', { triggerType: 'new_lead' }), node('m', 'send_message', { text: 'Hi {{lead.firstName}}, from {{event.source}}' }), node('e', 'end')],
        edges: [edge('t', 'm'), edge('m', 'e')],
      });
      const before = (await botMessages()).length;
      await fire('lead_created', { source: 'widget' });
      expect((await botMessages()).slice(before)).toEqual(['Hi Asha, from widget']);
      const ex = (await executions()).find(e => e.flowId === id)!;
      expect(ex.status).toBe('completed');
      const detail = await api('get', `/api/executions/${ex.id}`);
      expect(detail.body.data.steps.map((s: { nodeId: string; status: string }) => `${s.nodeId}:${s.status}`)).toEqual(['t:ok', 'm:ok', 'e:ok']);
    });

    it('branches on conditions', async () => {
      await publishFlow('Branching', {
        nodes: [
          node('t', 'trigger', { triggerType: 'lead_stage_changed' }),
          node('c', 'condition', { field: 'lead.status', operator: 'equals', value: 'new' }),
          node('y', 'send_message', { text: 'still new' }),
          node('n', 'send_message', { text: 'moved on' }),
        ],
        edges: [edge('t', 'c'), edge('c', 'y', 'true'), edge('c', 'n', 'false')],
      });
      const before = (await botMessages()).length;
      await fire('lead_status_changed', { previous_status: 'contacted', new_status: 'new' });
      expect((await botMessages()).slice(before)).toEqual(['still new']);
    });

    it('matches the stage filter of the trigger', async () => {
      await publishFlow('Only won', {
        nodes: [node('t', 'trigger', { triggerType: 'lead_stage_changed', toStatus: 'won' }), node('m', 'send_message', { text: 'congrats!' })],
        edges: [edge('t', 'm')],
      });
      const before = (await botMessages()).length;
      await fire('lead_status_changed', { new_status: 'lost' });
      expect(await botMessages()).not.toContain('congrats!');
      await fire('lead_status_changed', { new_status: 'won' });
      expect((await botMessages()).slice(before)).toContain('congrats!');
    });

    it('parks on wait, survives a restart, and resumes when due', async () => {
      const { id } = await publishFlow('Reminder', {
        nodes: [node('t', 'trigger', { triggerType: 'visit_booked' }), node('m1', 'send_message', { text: 'booked' }), node('w', 'wait', { minutes: 60 }), node('m2', 'send_message', { text: 'reminder' })],
        edges: [edge('t', 'm1'), edge('m1', 'w'), edge('w', 'm2')],
      });
      await fire('visit_booked', { scheduledAt: 'tomorrow' });
      const ex = (await executions()).find(e => e.flowId === id)!;
      expect(ex.status).toBe('waiting');
      expect(ex.currentNode).toBe('m2');
      expect(await botMessages()).toContain('booked');
      expect(await botMessages()).not.toContain('reminder');

      expect(await flowEngine.resumeDue()).toBe(0); // not due yet
      await testDb.update(flowExecutions).set({ resumeAt: new Date(Date.now() - 1000) }).where(eq(flowExecutions.id, ex.id));
      await flowEngine.resumeDue();
      const after = (await executions()).find(e => e.id === ex.id)!;
      expect(after.status).toBe('completed');
      expect(await botMessages()).toContain('reminder');
    });

    it('cancels a waiting execution so it never resumes', async () => {
      const { id } = await publishFlow('Cancelable', {
        nodes: [node('t', 'trigger', { triggerType: 'form_submitted' }), node('w', 'wait', { minutes: 5 }), node('m', 'send_message', { text: 'should not send' })],
        edges: [edge('t', 'w'), edge('w', 'm')],
      });
      await fire('form_submitted');
      const ex = (await executions()).find(e => e.flowId === id)!;
      expect((await api('post', `/api/executions/${ex.id}/cancel`)).body.data.cancelled).toBe(true);
      await testDb.update(flowExecutions).set({ resumeAt: new Date(Date.now() - 1000) }).where(eq(flowExecutions.id, ex.id));
      await flowEngine.resumeDue();
      expect(await botMessages()).not.toContain('should not send');
    });

    it('stops runaway loops with the step cap', async () => {
      const { id } = await publishFlow(
        'Endless',
        { nodes: [node('t', 'trigger', { triggerType: 'webhook' }), node('s', 'set_variable', { name: 'x', value: '1' })], edges: [edge('t', 's'), edge('s', 's')] },
        { maxSteps: 10 },
      );
      const res = await api('post', `/api/flows/${id}/trigger`).send({});
      expect(res.status).toBe(202);
      expect(res.body.data.status).toBe('failed');
      expect(res.body.data.error).toContain('10 steps');
    });

    it('repeats a loop the requested number of times then continues', async () => {
      const { id } = await publishFlow('Looper', {
        nodes: [node('t', 'trigger', { triggerType: 'webhook' }), node('l', 'loop', { times: 3 }), node('s', 'set_variable', { name: 'n', value: 'tick' }), node('d', 'set_variable', { name: 'done', value: 'yes' })],
        edges: [edge('t', 'l'), edge('l', 's', 'body'), edge('s', 'l'), edge('l', 'd', 'done')],
      });
      const res = await api('post', `/api/flows/${id}/trigger`).send({});
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.steps.filter((s: { nodeId: string }) => s.nodeId === 's')).toHaveLength(3);
      expect(res.body.data.variables.vars.done).toBe('yes');
    });

    it('routes with the LLM, falling back to the default branch', async () => {
      const graph: FlowGraph = {
        nodes: [
          node('t', 'trigger', { triggerType: 'webhook' }),
          node('r', 'llm_router', { question: '{{event.message}}', choices: [{ id: 'buy', label: 'Buyer' }, { id: 'rent', label: 'Renter' }] }),
          node('b', 'set_variable', { name: 'path', value: 'buy' }),
          node('d', 'set_variable', { name: 'path', value: 'default' }),
        ],
        edges: [edge('t', 'r'), edge('r', 'b', 'buy'), edge('r', 'd', 'default')],
      };
      const { id } = await publishFlow('LLM routing', graph);
      const spy = vi.spyOn(modelRouter, 'executeCompletion').mockResolvedValue({ text: '{"choice":"buy"}', tokens: { prompt: 5, completion: 3, total: 8 } } as never);
      const ok = await api('post', `/api/flows/${id}/trigger`).send({ event: { message: 'I want to buy a 3BHK' } });
      expect(ok.body.data.variables.vars.path).toBe('buy');
      expect(ok.body.data.totalTokens).toBe(8);
      spy.mockResolvedValue({ text: 'sorry I cannot', tokens: { prompt: 1, completion: 1, total: 2 } } as never);
      const bad = await api('post', `/api/flows/${id}/trigger`).send({ event: { message: '???' } });
      expect(bad.body.data.variables.vars.path).toBe('default');
      expect(spy).toHaveBeenCalledTimes(1 + 3); // three attempts before falling back
    });

    it('runs actions (live inventory) and follows the error handle when a step fails', async () => {
      const project = await inventoryService.createProject(a.company.id, { name: 'Flow Towers', builderName: 'ACME', location: 'Hebbal' });
      await testDb.insert(units).values({ companyId: a.company.id, projectId: project.id, unitNumber: 'F-1', bhk: 3, carpetAreaSqft: '1000', price: '9000000', status: 'available' });
      const { id } = await publishFlow('Actions', {
        nodes: [
          node('t', 'trigger', { triggerType: 'webhook' }),
          node('a', 'action', { actionId: 'check_unit_availability', input: { bhk: '3' }, saveAs: 'stock' }),
          node('bad', 'action', { actionId: 'update_lead_stage', input: { status: 'not_a_stage', leadId } }),
          node('h', 'set_variable', { name: 'handled', value: '{{vars.error}}' }),
        ],
        edges: [edge('t', 'a'), edge('a', 'bad'), edge('bad', 'h', 'error')],
      });
      const res = await api('post', `/api/flows/${id}/trigger`).send({});
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.variables.vars.stock.available).toBe(true);
      expect(res.body.data.variables.vars.handled).toContain('Unknown stage');
      expect(res.body.data.steps.find((s: { nodeId: string }) => s.nodeId === 'bad').status).toBe('error');
    });

    it('fails the run (not the process) when a step errors without an error handler', async () => {
      const { id } = await publishFlow('Fails', {
        nodes: [node('t', 'trigger', { triggerType: 'webhook' }), node('x', 'action', { actionId: 'nope_action' })],
        edges: [edge('t', 'x')],
      });
      const res = await api('post', `/api/flows/${id}/trigger`).send({});
      expect(res.body.data.status).toBe('failed');
      expect(res.body.data.error).toContain('Unknown action');
    });

    it('runs a published sub-flow inline and shares variables', async () => {
      const child = await publishFlow('Child', { nodes: [node('t', 'trigger', { triggerType: 'webhook' }), node('s', 'set_variable', { name: 'fromChild', value: 'hello' })], edges: [edge('t', 's')] });
      const parent = await publishFlow('Parent', {
        nodes: [node('t', 'trigger', { triggerType: 'webhook' }), node('sub', 'sub_flow', { flowId: child.id }), node('p', 'set_variable', { name: 'echo', value: '{{vars.fromChild}}!' })],
        edges: [edge('t', 'sub'), edge('sub', 'p')],
      });
      const res = await api('post', `/api/flows/${parent.id}/trigger`).send({});
      expect(res.body.data.variables.vars.echo).toBe('hello!');
      const self = await api('post', '/api/flows').send({ name: 'Selfish' });
      const saved = await api('put', `/api/flows/${self.body.data.flow.id}/draft`).send({
        graph: { nodes: [node('t', 'trigger', { triggerType: 'webhook' }), node('sub', 'sub_flow', { flowId: self.body.data.flow.id })], edges: [edge('t', 'sub')] },
      });
      expect((await api('post', `/api/flows/${self.body.data.flow.id}/versions/${saved.body.data.id}/publish`)).status).toBe(422);
    });

    it('test runs are dry by default: nothing is sent, steps are marked skipped, executions flagged', async () => {
      const { id } = await publishFlow('Dry', {
        nodes: [node('t', 'trigger', { triggerType: 'new_lead' }), node('m', 'send_message', { text: 'DRY RUN MESSAGE' }), node('w', 'wait', { minutes: 1000 }), node('m2', 'send_message', { text: 'after wait' })],
        edges: [edge('t', 'm'), edge('m', 'w'), edge('w', 'm2')],
      });
      const res = await api('post', `/api/flows/${id}/test`).send({ leadId });
      expect(res.status).toBe(200);
      expect(res.body.data.isTest).toBe(true);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.steps.map((s: { status: string }) => s.status)).toEqual(['ok', 'skipped', 'skipped', 'skipped']);
      expect(await botMessages()).not.toContain('DRY RUN MESSAGE');
      const real = await api('post', `/api/flows/${id}/test`).send({ leadId, dryRun: false });
      expect(await botMessages()).toContain('DRY RUN MESSAGE');
      expect(real.body.data.status).toBe('waiting');
      const list = await api('get', '/api/executions').query({ flowId: id });
      expect(list.body.data).toEqual([]); // tests are hidden unless requested
      expect((await api('get', '/api/executions').query({ flowId: id, includeTests: 'true' })).body.data.length).toBe(2);
      expect((await api('get', `/api/executions/${real.body.data.id}`, b)).status).toBe(404);
    });

    it('honours the company kill switch', async () => {
      const { id } = await publishFlow('Killed', { nodes: [node('t', 'trigger', { triggerType: 'webhook' }), node('m', 'send_message', { text: 'x' })], edges: [edge('t', 'm')] });
      await testDb.insert(companyAiSettings).values({ companyId: a.company.id, killSwitch: true }).onConflictDoUpdate({ target: companyAiSettings.companyId, set: { killSwitch: true } });
      const res = await api('post', `/api/flows/${id}/trigger`).send({});
      expect(res.body.data.status).toBe('cancelled');
      expect(res.body.data.error).toContain('kill switch');
      await testDb.update(companyAiSettings).set({ killSwitch: false }).where(eq(companyAiSettings.companyId, a.company.id));
    });

    it('fires due schedule triggers once and advances them', async () => {
      const { id } = await publishFlow('Scheduled', {
        nodes: [node('t', 'trigger', { triggerType: 'schedule', everyMinutes: 30 }), node('s', 'set_variable', { name: 'ran', value: 'yes' })],
        edges: [edge('t', 's')],
      });
      const [trig] = await testDb.select().from(flowTriggers).where(eq(flowTriggers.flowId, id));
      expect(trig!.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
      await testDb.update(flowTriggers).set({ nextRunAt: new Date(Date.now() - 1000) }).where(eq(flowTriggers.id, trig!.id));
      await flowEngine.runDueSchedules();
      await flowEngine.runDueSchedules();
      const runs = (await executions()).filter(e => e.flowId === id);
      expect(runs).toHaveLength(1);
      const [after] = await testDb.select().from(flowTriggers).where(and(eq(flowTriggers.id, trig!.id)));
      expect(after!.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('archiving a flow stops its triggers', async () => {
      const { id } = await publishFlow('Archive me', { nodes: [node('t', 'trigger', { triggerType: 'new_lead' }), node('m', 'send_message', { text: 'ARCHIVED-SEND' })], edges: [edge('t', 'm')] });
      await api('patch', `/api/flows/${id}`).send({ status: 'archived' });
      await fire('lead_created');
      expect(await botMessages()).not.toContain('ARCHIVED-SEND');
    });
  });
});
