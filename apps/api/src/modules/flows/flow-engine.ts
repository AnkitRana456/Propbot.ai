import { and, desc, eq, isNotNull, lte, sql } from 'drizzle-orm';
import {
  validateFlowGraph,
  type FlowConditionOperator,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type FlowSettings,
} from '@propbot/shared';
import { db } from '../../db/index.js';
import {
  companyAiSettings,
  contacts,
  conversations,
  flowExecutions,
  flowStepRuns,
  flowTriggers,
  flowVersions,
  flows,
  leads,
  messages,
} from '../../db/schema/index.js';
import { modelRouter, TaskTier } from '../ai/router.js';
import { toolsService } from '../tools/tools.service.js';
import { runAction } from '../tools/actions.js';

const MAX_SUBFLOW_DEPTH = 3;
const MAX_ACTIVE_PER_COMPANY = 200;

type Vars = Record<string, unknown>;

/** Dot-path read; `lead.name`, `event.amount`, or a bare variable name looked up under `vars`. */
export function readPath(root: Vars, path: string): unknown {
  const parts = path.trim().split('.').filter(Boolean);
  const tryFrom = (start: unknown): unknown => {
    let cur: unknown = start;
    for (const p of parts) {
      if (p === '__proto__' || p === 'constructor' || p === 'prototype') return undefined;
      if (cur === null || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[p];
    }
    return cur;
  };
  const direct = tryFrom(root);
  return direct !== undefined ? direct : tryFrom(root.vars);
}

export function renderVars(template: string, root: Vars): string {
  return template.replace(/\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g, (_m, path: string) => {
    const v = readPath(root, path);
    if (v === undefined || v === null) return '';
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  });
}

export function compare(op: FlowConditionOperator, actual: unknown, expected: string): boolean {
  const a = actual === undefined || actual === null ? '' : typeof actual === 'object' ? JSON.stringify(actual) : String(actual);
  switch (op) {
    case 'equals':
      return a.toLowerCase() === expected.toLowerCase();
    case 'not_equals':
      return a.toLowerCase() !== expected.toLowerCase();
    case 'contains':
      return a.toLowerCase().includes(expected.toLowerCase());
    case 'not_contains':
      return !a.toLowerCase().includes(expected.toLowerCase());
    case 'greater_than':
      return Number(a) > Number(expected);
    case 'less_than':
      return Number(a) < Number(expected);
    case 'is_set':
      return a !== '';
    case 'is_empty':
      return a === '';
  }
}

interface NodeResult {
  output?: unknown;
  /** Output handle to follow; default 'out'. */
  handle?: string;
  /** Park the execution until this time, then continue from the next node. */
  waitUntil?: Date;
  tokens?: number;
  skipped?: boolean;
}

interface RunCtx {
  companyId: string;
  executionId: string;
  vars: Vars;
  dryRun: boolean;
  leadId: string | null;
  conversationId: string | null;
  tokens: number;
  steps: number;
  maxSteps: number;
  depth: number;
}

const nextEdge = (graph: FlowGraph, nodeId: string, handle: string): FlowEdge | undefined =>
  graph.edges.find(e => e.source === nodeId && (e.sourceHandle ?? 'out') === handle);

async function resolveConversation(ctx: RunCtx): Promise<string | null> {
  if (ctx.conversationId) return ctx.conversationId;
  if (!ctx.leadId) return null;
  const [c] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.companyId, ctx.companyId), eq(conversations.leadId, ctx.leadId)))
    .orderBy(desc(conversations.createdAt))
    .limit(1);
  return c?.id ?? null;
}

async function sendMessage(ctx: RunCtx, text: string, nodeId: string): Promise<{ sent: boolean; conversationId: string | null }> {
  const conversationId = await resolveConversation(ctx);
  if (!conversationId) return { sent: false, conversationId: null };
  await db.insert(messages).values({
    companyId: ctx.companyId,
    conversationId,
    senderType: 'bot',
    senderId: 'flow',
    content: text.slice(0, 4000),
    metadata: { source: 'flow', flowExecutionId: ctx.executionId, nodeId },
  });
  return { sent: true, conversationId };
}

async function execNode(node: FlowNode, graph: FlowGraph, ctx: RunCtx): Promise<NodeResult> {
  const d = node.data;
  const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');
  switch (node.type) {
    case 'trigger':
    case 'end':
      return { output: null };

    case 'send_message': {
      const text = renderVars(str('text'), ctx.vars);
      if (ctx.dryRun) return { output: { dryRun: true, text }, skipped: true };
      return { output: { text, ...(await sendMessage(ctx, text, node.id)) } };
    }

    case 'ai_step': {
      const prompt = renderVars(str('prompt'), ctx.vars);
      if (ctx.dryRun) return { output: { dryRun: true, prompt }, skipped: true };
      const res = await modelRouter.executeCompletion({
        tier: TaskTier.FAST,
        companyId: ctx.companyId,
        chatbotId: '',
        trace: { purpose: 'tool' },
        systemPrompt: 'You write short, friendly, accurate replies for a real-estate sales team. Never invent prices or availability.',
        userMessage: prompt,
        temperature: 0.4,
        maxTokens: 300,
        promptName: 'flow:ai_step',
      });
      const name = str('saveAs');
      if (name) (ctx.vars.vars as Vars)[name] = res.text;
      let sent: unknown = null;
      if (d.send === true && res.text.trim()) sent = await sendMessage(ctx, res.text, node.id);
      return { output: { text: res.text, sent }, tokens: res.tokens.total };
    }

    case 'condition': {
      const actual = readPath(ctx.vars, str('field'));
      const result = compare(String(d.operator) as FlowConditionOperator, actual, renderVars(str('value'), ctx.vars));
      return { output: { actual, result }, handle: result ? 'true' : 'false' };
    }

    case 'llm_router': {
      const choices = (Array.isArray(d.choices) ? d.choices : []) as Array<{ id: string; label?: string; description?: string }>;
      const question = renderVars(str('question') || str('prompt'), ctx.vars);
      let picked: string | null = null;
      let tokens = 0;
      for (let attempt = 0; attempt < 3 && !picked; attempt++) {
        try {
          const res = await modelRouter.executeCompletion({
            tier: TaskTier.FAST,
            companyId: ctx.companyId,
            chatbotId: '',
            trace: { purpose: 'routing' },
            systemPrompt:
              'Choose exactly one option for the situation. Reply with ONLY JSON like {"choice":"<id>"}.\nOptions:\n' +
              choices.map(c => `- ${c.id}: ${c.label ?? ''} ${c.description ?? ''}`).join('\n'),
            userMessage: question,
            temperature: 0,
            maxTokens: 60,
            promptName: 'flow:llm_router',
          });
          tokens += res.tokens.total;
          const m = /\{[\s\S]*\}/.exec(res.text);
          const id = m ? (JSON.parse(m[0]) as { choice?: string }).choice : undefined;
          if (id && choices.some(c => c.id === id)) picked = id;
        } catch {
          /* retry, then fall back to the default branch */
        }
      }
      return { output: { choice: picked ?? 'default' }, handle: picked ?? 'default', tokens };
    }

    case 'wait': {
      const minutes = Math.max(1, Number(d.minutes) || 1);
      if (ctx.dryRun) return { output: { dryRun: true, wouldWaitMinutes: minutes }, skipped: true };
      return { output: { minutes }, waitUntil: new Date(Date.now() + minutes * 60_000) };
    }

    case 'loop': {
      const key = `__loop_${node.id}`;
      const internal = ctx.vars.vars as Vars;
      const done = Number(internal[key] ?? 0);
      const times = Math.min(20, Math.max(1, Number(d.times) || 1));
      if (done >= times) {
        delete internal[key];
        return { output: { iterations: done }, handle: 'done' };
      }
      internal[key] = done + 1;
      return { output: { iteration: done + 1, of: times }, handle: 'body' };
    }

    case 'set_variable': {
      const name = str('name');
      const value = renderVars(str('value'), ctx.vars);
      (ctx.vars.vars as Vars)[name] = value;
      return { output: { [name]: value } };
    }

    case 'tool': {
      const input = Object.fromEntries(
        Object.entries((d.input as Record<string, string> | undefined) ?? {}).map(([k, v]) => [k, renderVars(String(v), ctx.vars)]),
      );
      if (ctx.dryRun) return { output: { dryRun: true, input }, skipped: true };
      const run = await toolsService.execute(ctx.companyId, str('toolId'), input, { source: 'flow', conversationId: ctx.conversationId });
      const name = str('saveAs');
      if (name) (ctx.vars.vars as Vars)[name] = run.output;
      if (run.status === 'error' || run.status === 'blocked') throw new Error(run.error ?? 'The tool failed.');
      return { output: { status: run.status, output: run.output } };
    }

    case 'action': {
      const input = Object.fromEntries(
        Object.entries((d.input as Record<string, string> | undefined) ?? {}).map(([k, v]) => [k, renderVars(String(v), ctx.vars)]),
      );
      if (ctx.dryRun) return { output: { dryRun: true, input }, skipped: true };
      const out = await runAction(str('actionId'), { companyId: ctx.companyId, leadId: ctx.leadId }, input);
      const name = str('saveAs');
      if (name) (ctx.vars.vars as Vars)[name] = out;
      return { output: out };
    }

    case 'sub_flow': {
      if (ctx.depth >= MAX_SUBFLOW_DEPTH) throw new Error('Sub-flows are nested too deeply.');
      const [child] = await db
        .select({ graph: flowVersions.graph, settings: flowVersions.settings })
        .from(flows)
        .innerJoin(flowVersions, eq(flowVersions.id, flows.activeVersionId))
        .where(and(eq(flows.id, str('flowId')), eq(flows.companyId, ctx.companyId)));
      if (!child) throw new Error('The sub-flow is not published.');
      const start = child.graph.nodes.find(n => n.type === 'trigger');
      if (!start) throw new Error('The sub-flow has no entry point.');
      const res = await runGraph(child.graph, start.id, { ...ctx, depth: ctx.depth + 1 }, true);
      ctx.tokens = res.ctx.tokens;
      ctx.steps = res.ctx.steps;
      if (res.status !== 'completed') throw new Error(res.error ?? 'The sub-flow did not finish.');
      return { output: { subFlow: str('flowId'), status: 'completed' } };
    }
  }
}

interface GraphRun {
  status: 'completed' | 'waiting' | 'failed';
  error?: string;
  waitNode?: string;
  waitUntil?: Date;
  ctx: RunCtx;
}

/** Walks the graph from `startNodeId`, recording every step. Stops on completion, a wait, or an error. */
async function runGraph(graph: FlowGraph, startNodeId: string, ctx: RunCtx, inline = false): Promise<GraphRun> {
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  let nodeId: string | undefined = startNodeId;

  while (nodeId) {
    if (++ctx.steps > ctx.maxSteps) return { status: 'failed', error: `Stopped after ${ctx.maxSteps} steps (loop guard).`, ctx };
    const node = byId.get(nodeId);
    if (!node) return { status: 'failed', error: `Step ${nodeId} no longer exists.`, ctx };

    const started = Date.now();
    const [stepRow] = await db
      .insert(flowStepRuns)
      .values({ executionId: ctx.executionId, companyId: ctx.companyId, nodeId: node.id, nodeType: node.type, input: node.data })
      .returning({ id: flowStepRuns.id });
    const finish = (status: 'ok' | 'error' | 'skipped' | 'waiting', output: unknown, error: string | null, tokens: number) =>
      db
        .update(flowStepRuns)
        .set({ status, output: output ?? null, error, tokens, durationMs: Date.now() - started, finishedAt: new Date() })
        .where(eq(flowStepRuns.id, stepRow!.id));

    let result: NodeResult;
    try {
      result = await execNode(node, graph, ctx);
    } catch (e) {
      const message = (e instanceof Error ? e.message : 'Step failed.').slice(0, 500);
      await finish('error', null, message, 0);
      const errEdge = nextEdge(graph, node.id, 'error');
      if (errEdge) {
        (ctx.vars.vars as Vars).error = message;
        nodeId = errEdge.target;
        continue;
      }
      return { status: 'failed', error: `${node.type} step failed: ${message}`, ctx };
    }

    ctx.tokens += result.tokens ?? 0;
    const handle = result.handle ?? 'out';
    const edge = nextEdge(graph, node.id, handle) ?? (handle === 'out' ? undefined : undefined);

    if (result.waitUntil) {
      if (inline) {
        await finish('error', null, 'Waiting inside a sub-flow is not supported.', 0);
        return { status: 'failed', error: 'Waiting inside a sub-flow is not supported.', ctx };
      }
      await finish('waiting', result.output, null, 0);
      if (!edge) return { status: 'completed', ctx };
      return { status: 'waiting', waitNode: edge.target, waitUntil: result.waitUntil, ctx };
    }
    await finish(result.skipped ? 'skipped' : 'ok', result.output, null, result.tokens ?? 0);
    nodeId = edge?.target;
  }
  return { status: 'completed', ctx };
}

export interface StartParams {
  companyId: string;
  flowId: string;
  versionId: string;
  graph: FlowGraph;
  settings: FlowSettings;
  triggerType: string;
  nodeId: string;
  leadId?: string | null;
  conversationId?: string | null;
  event?: Record<string, unknown>;
  isTest?: boolean;
  dryRun?: boolean;
}

async function loadLeadVars(companyId: string, leadId: string | null): Promise<{ lead: Vars; contactId: string | null }> {
  if (!leadId) return { lead: {}, contactId: null };
  const [row] = await db
    .select({
      contactId: leads.contactId,
      status: leads.status,
      source: leads.source,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      phone: contacts.phone,
      email: contacts.email,
      customFields: leads.customFields,
    })
    .from(leads)
    .innerJoin(contacts, eq(contacts.id, leads.contactId))
    .where(and(eq(leads.id, leadId), eq(leads.companyId, companyId)));
  if (!row) return { lead: { id: leadId }, contactId: null };
  const attributes = ((row.customFields as Record<string, unknown> | null)?.attributes ?? {}) as Record<string, unknown>;
  return {
    contactId: row.contactId,
    lead: {
      id: leadId,
      name: `${row.firstName} ${row.lastName ?? ''}`.trim(),
      firstName: row.firstName,
      phone: row.phone,
      email: row.email,
      status: row.status,
      source: row.source,
      ...attributes,
    },
  };
}

class FlowEngine {
  /** Starts an execution and runs it until it finishes or parks on a wait. Returns the execution id. */
  async start(p: StartParams): Promise<{ executionId: string; status: string; error?: string }> {
    const [settings] = await db.select({ kill: companyAiSettings.killSwitch }).from(companyAiSettings).where(eq(companyAiSettings.companyId, p.companyId));
    const { lead, contactId } = await loadLeadVars(p.companyId, p.leadId ?? null);
    const vars: Vars = { lead, event: p.event ?? {}, vars: {} };

    const [active] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(flowExecutions)
      .where(and(eq(flowExecutions.companyId, p.companyId), eq(flowExecutions.status, 'waiting')));

    const [exec] = await db
      .insert(flowExecutions)
      .values({
        companyId: p.companyId,
        flowId: p.flowId,
        flowVersionId: p.versionId,
        triggerType: p.triggerType,
        leadId: p.leadId ?? null,
        contactId,
        conversationId: p.conversationId ?? null,
        variables: vars,
        isTest: p.isTest ?? false,
        currentNode: p.nodeId,
      })
      .returning();

    if (settings?.kill) return this.close(exec!.id, 'cancelled', 'AI automation is switched off for this company (kill switch).');
    if ((active?.n ?? 0) >= MAX_ACTIVE_PER_COMPANY) return this.close(exec!.id, 'failed', 'Too many flows are waiting for this company.');

    return this.continueFrom(exec!.id, p.graph, p.nodeId, p.settings, p.dryRun ?? false);
  }

  private async close(id: string, status: 'completed' | 'failed' | 'cancelled', error?: string) {
    await db.update(flowExecutions).set({ status, error: error ?? null, finishedAt: new Date(), resumeAt: null }).where(eq(flowExecutions.id, id));
    return { executionId: id, status, error };
  }

  private async continueFrom(executionId: string, graph: FlowGraph, nodeId: string, settings: FlowSettings, dryRun: boolean) {
    const [exec] = await db.select().from(flowExecutions).where(eq(flowExecutions.id, executionId));
    if (!exec) throw new Error('Execution not found');
    await db.update(flowExecutions).set({ status: 'running', resumeAt: null }).where(eq(flowExecutions.id, executionId));
    const ctx: RunCtx = {
      companyId: exec.companyId,
      executionId,
      vars: exec.variables,
      dryRun,
      leadId: exec.leadId,
      conversationId: exec.conversationId,
      tokens: exec.totalTokens,
      steps: 0,
      maxSteps: settings.maxSteps ?? 50,
      depth: 0,
    };
    if (!ctx.vars.vars || typeof ctx.vars.vars !== 'object') ctx.vars.vars = {};

    let run: GraphRun;
    try {
      run = await runGraph(graph, nodeId, ctx);
    } catch (e) {
      run = { status: 'failed', error: e instanceof Error ? e.message : 'Flow crashed.', ctx };
    }
    const base = { variables: ctx.vars, totalTokens: ctx.tokens };
    if (run.status === 'waiting') {
      await db.update(flowExecutions).set({ ...base, status: 'waiting', currentNode: run.waitNode, resumeAt: run.waitUntil }).where(eq(flowExecutions.id, executionId));
      return { executionId, status: 'waiting' };
    }
    await db
      .update(flowExecutions)
      .set({ ...base, status: run.status, error: run.error ?? null, finishedAt: new Date(), currentNode: null })
      .where(eq(flowExecutions.id, executionId));
    return { executionId, status: run.status, error: run.error };
  }

  /** Resumes executions whose wait has elapsed. Called by the worker. */
  async resumeDue(limit = 25): Promise<number> {
    const due = await db
      .select({ id: flowExecutions.id, versionId: flowExecutions.flowVersionId, node: flowExecutions.currentNode, isTest: flowExecutions.isTest })
      .from(flowExecutions)
      .where(and(eq(flowExecutions.status, 'waiting'), isNotNull(flowExecutions.resumeAt), lte(flowExecutions.resumeAt, new Date())))
      .limit(limit);
    let n = 0;
    for (const e of due) {
      // claim: only one worker flips waiting -> running
      const claimed = await db
        .update(flowExecutions)
        .set({ status: 'running', resumeAt: null })
        .where(and(eq(flowExecutions.id, e.id), eq(flowExecutions.status, 'waiting')))
        .returning({ id: flowExecutions.id });
      if (claimed.length === 0 || !e.node) continue;
      const [v] = await db.select({ graph: flowVersions.graph, settings: flowVersions.settings }).from(flowVersions).where(eq(flowVersions.id, e.versionId));
      if (!v) {
        await this.close(e.id, 'failed', 'The flow version no longer exists.');
        continue;
      }
      await this.continueFrom(e.id, v.graph, e.node, v.settings, false);
      n++;
    }
    return n;
  }

  async cancel(companyId: string, executionId: string): Promise<boolean> {
    const res = await db
      .update(flowExecutions)
      .set({ status: 'cancelled', finishedAt: new Date(), resumeAt: null })
      .where(and(eq(flowExecutions.id, executionId), eq(flowExecutions.companyId, companyId), sql`${flowExecutions.status} IN ('waiting','running')`))
      .returning({ id: flowExecutions.id });
    return res.length > 0;
  }

  /** Starts every active flow whose trigger matches an event. */
  async fireTrigger(companyId: string, triggerType: string, opts: { leadId?: string | null; conversationId?: string | null; event?: Record<string, unknown>; match?: (config: Record<string, unknown>) => boolean }): Promise<number> {
    const rows = await db
      .select({ t: flowTriggers, graph: flowVersions.graph, settings: flowVersions.settings })
      .from(flowTriggers)
      .innerJoin(flowVersions, eq(flowVersions.id, flowTriggers.flowVersionId))
      .innerJoin(flows, eq(flows.id, flowTriggers.flowId))
      .where(and(eq(flowTriggers.companyId, companyId), eq(flowTriggers.triggerType, triggerType), eq(flowTriggers.isActive, true), eq(flows.status, 'active')));
    let started = 0;
    for (const r of rows) {
      if (opts.match && !opts.match(r.t.config)) continue;
      await this.start({
        companyId,
        flowId: r.t.flowId,
        versionId: r.t.flowVersionId,
        graph: r.graph,
        settings: r.settings,
        triggerType,
        nodeId: r.t.nodeId,
        leadId: opts.leadId,
        conversationId: opts.conversationId,
        event: opts.event,
      });
      started++;
    }
    return started;
  }

  /** Fires schedule triggers that are due and advances their next run. */
  async runDueSchedules(): Promise<number> {
    const due = await db
      .select({ t: flowTriggers, graph: flowVersions.graph, settings: flowVersions.settings })
      .from(flowTriggers)
      .innerJoin(flowVersions, eq(flowVersions.id, flowTriggers.flowVersionId))
      .innerJoin(flows, eq(flows.id, flowTriggers.flowId))
      .where(and(eq(flowTriggers.triggerType, 'schedule'), eq(flowTriggers.isActive, true), eq(flows.status, 'active'), lte(flowTriggers.nextRunAt, new Date())))
      .limit(20);
    let n = 0;
    for (const r of due) {
      const every = Math.max(5, Number(r.t.config.everyMinutes) || 60);
      const claimed = await db
        .update(flowTriggers)
        .set({ nextRunAt: new Date(Date.now() + every * 60_000) })
        .where(and(eq(flowTriggers.id, r.t.id), lte(flowTriggers.nextRunAt, new Date())))
        .returning({ id: flowTriggers.id });
      if (claimed.length === 0) continue;
      await this.start({
        companyId: r.t.companyId,
        flowId: r.t.flowId,
        versionId: r.t.flowVersionId,
        graph: r.graph,
        settings: r.settings,
        triggerType: 'schedule',
        nodeId: r.t.nodeId,
        event: { scheduledFor: new Date().toISOString() },
      });
      n++;
    }
    return n;
  }

  validate(graph: FlowGraph) {
    return validateFlowGraph(graph);
  }
}

export const flowEngine = new FlowEngine();
