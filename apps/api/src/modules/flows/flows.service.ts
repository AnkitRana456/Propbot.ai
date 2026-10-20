import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  validateFlowGraph,
  type CreateFlowInput,
  type FlowExecutionDetail,
  type FlowExecutionItem,
  type FlowGraph,
  type FlowItem,
  type FlowSettings,
  type FlowStepRunItem,
  type FlowTemplateItem,
  type FlowVersionItem,
  type SaveFlowDraftInput,
  type TestFlowInput,
  type TriggerFlowInput,
  type UpdateFlowInput,
} from '@propbot/shared';
import { db } from '../../db/index.js';
import { contacts, flowExecutions, flowStepRuns, flowTriggers, flowVersions, flows, leads } from '../../db/schema/index.js';
import { ApiError, badRequest, conflict, notFound } from '../../utils/api-error.js';
import { flowEngine } from './flow-engine.js';
import { FLOW_TEMPLATES } from './flow-templates.js';

type VersionRow = typeof flowVersions.$inferSelect;
const EMPTY_GRAPH: FlowGraph = { nodes: [], edges: [] };

const toVersion = (v: VersionRow): FlowVersionItem => ({
  id: v.id,
  flowId: v.flowId,
  version: v.version,
  status: v.status as FlowVersionItem['status'],
  graph: v.graph,
  settings: v.settings,
  changeNote: v.changeNote,
  createdAt: v.createdAt.toISOString(),
  publishedAt: v.publishedAt?.toISOString() ?? null,
});

const triggerTypesOf = (g: FlowGraph) => [...new Set(g.nodes.filter(n => n.type === 'trigger').map(n => String(n.data.triggerType ?? '')).filter(Boolean))];

class FlowsService {
  templates(): FlowTemplateItem[] {
    return FLOW_TEMPLATES.map(({ graph: _g, ...t }) => t);
  }

  private async mustGet(companyId: string, id: string) {
    const [f] = await db.select().from(flows).where(and(eq(flows.id, id), eq(flows.companyId, companyId), isNull(flows.deletedAt)));
    if (!f) throw notFound('Flow');
    return f;
  }

  private async versionsOf(flowId: string): Promise<VersionRow[]> {
    return db.select().from(flowVersions).where(eq(flowVersions.flowId, flowId)).orderBy(desc(flowVersions.version));
  }

  private toItem(f: typeof flows.$inferSelect, versions: VersionRow[], executionCount: number): FlowItem {
    const active = versions.find(v => v.id === f.activeVersionId);
    const latest = versions[0];
    return {
      id: f.id,
      name: f.name,
      description: f.description,
      tags: f.tags,
      template: f.template,
      status: f.status as FlowItem['status'],
      activeVersionId: f.activeVersionId,
      activeVersion: active?.version ?? null,
      latestVersion: latest?.version ?? 0,
      hasUnpublishedDraft: latest?.status === 'draft',
      triggerTypes: triggerTypesOf((active ?? latest)?.graph ?? EMPTY_GRAPH),
      executionCount,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    };
  }

  async list(companyId: string): Promise<FlowItem[]> {
    const rows = await db.select().from(flows).where(and(eq(flows.companyId, companyId), isNull(flows.deletedAt))).orderBy(desc(flows.updatedAt));
    if (rows.length === 0) return [];
    const ids = rows.map(r => r.id);
    const versions = await db.select().from(flowVersions).where(inArray(flowVersions.flowId, ids)).orderBy(desc(flowVersions.version));
    const counts = await db
      .select({ flowId: flowExecutions.flowId, n: sql<number>`count(*)::int` })
      .from(flowExecutions)
      .where(and(inArray(flowExecutions.flowId, ids), eq(flowExecutions.isTest, false)))
      .groupBy(flowExecutions.flowId);
    return rows.map(r => this.toItem(r, versions.filter(v => v.flowId === r.id), counts.find(c => c.flowId === r.id)?.n ?? 0));
  }

  async get(companyId: string, id: string): Promise<{ flow: FlowItem; versions: FlowVersionItem[] }> {
    const f = await this.mustGet(companyId, id);
    const versions = await this.versionsOf(id);
    const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(flowExecutions).where(and(eq(flowExecutions.flowId, id), eq(flowExecutions.isTest, false)));
    return { flow: this.toItem(f, versions, n), versions: versions.map(toVersion) };
  }

  async create(companyId: string, userId: string | null, input: CreateFlowInput) {
    const tpl = input.template ? FLOW_TEMPLATES.find(t => t.id === input.template) : undefined;
    if (input.template && !tpl) throw badRequest('FLOW_TEMPLATE_UNKNOWN', `Unknown template "${input.template}".`);
    const graph: FlowGraph = tpl ? structuredClone(tpl.graph) : { nodes: [{ id: 'trigger', type: 'trigger', position: { x: 60, y: 120 }, data: {} }], edges: [] };
    try {
      const flowId = await db.transaction(async tx => {
        const [f] = await tx
          .insert(flows)
          .values({ companyId, name: input.name, description: input.description ?? tpl?.description ?? null, tags: input.tags.length ? input.tags : tpl?.tags ?? [], template: tpl?.id ?? null, createdBy: userId })
          .returning({ id: flows.id });
        await tx.insert(flowVersions).values({ flowId: f!.id, companyId, version: 1, status: 'draft', graph, settings: { maxSteps: 50 }, createdBy: userId });
        return f!.id;
      });
      return this.get(companyId, flowId);
    } catch (e) {
      if (/flows_company_name_uniq|duplicate key/.test(String(e instanceof Error ? e.message : e) + String((e as { cause?: Error }).cause?.message ?? ''))) {
        throw conflict('FLOW_NAME_TAKEN', `A flow named "${input.name}" already exists.`);
      }
      throw e;
    }
  }

  async updateMeta(companyId: string, id: string, input: UpdateFlowInput): Promise<FlowItem> {
    await this.mustGet(companyId, id);
    await db.update(flows).set({ ...input, updatedAt: new Date() }).where(and(eq(flows.id, id), eq(flows.companyId, companyId)));
    if (input.status === 'archived') await db.update(flowTriggers).set({ isActive: false }).where(eq(flowTriggers.flowId, id));
    if (input.status === 'active') await this.rebuildTriggers(companyId, id);
    return (await this.get(companyId, id)).flow;
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.mustGet(companyId, id);
    await db.update(flows).set({ deletedAt: new Date(), status: 'archived' }).where(eq(flows.id, id));
    await db.update(flowTriggers).set({ isActive: false }).where(eq(flowTriggers.flowId, id));
  }

  async saveDraft(companyId: string, userId: string | null, flowId: string, input: SaveFlowDraftInput): Promise<FlowVersionItem> {
    await this.mustGet(companyId, flowId);
    const versions = await this.versionsOf(flowId);
    const latest = versions[0];
    if (!latest) throw notFound('Flow version');
    const settings = (input.settings ?? latest.settings) as FlowSettings;
    if (latest.status === 'draft') {
      const [row] = await db
        .update(flowVersions)
        .set({ graph: input.graph, settings, changeNote: input.changeNote !== undefined ? input.changeNote : latest.changeNote })
        .where(eq(flowVersions.id, latest.id))
        .returning();
      await db.update(flows).set({ updatedAt: new Date() }).where(eq(flows.id, flowId));
      return toVersion(row!);
    }
    const [row] = await db
      .insert(flowVersions)
      .values({ flowId, companyId, version: latest.version + 1, status: 'draft', graph: input.graph, settings, changeNote: input.changeNote ?? null, createdBy: userId })
      .returning();
    await db.update(flows).set({ updatedAt: new Date() }).where(eq(flows.id, flowId));
    return toVersion(row!);
  }

  async discardDraft(companyId: string, flowId: string, versionId: string): Promise<void> {
    await this.mustGet(companyId, flowId);
    const [v] = await db.select().from(flowVersions).where(and(eq(flowVersions.id, versionId), eq(flowVersions.flowId, flowId)));
    if (!v) throw notFound('Flow version');
    if (v.status !== 'draft') throw conflict('FLOW_VERSION_NOT_DRAFT', 'Only drafts can be discarded.');
    const all = await this.versionsOf(flowId);
    if (all.length === 1) throw conflict('FLOW_LAST_VERSION', 'A flow needs at least one version.');
    await db.delete(flowVersions).where(eq(flowVersions.id, versionId));
  }

  /** Validates, activates the version and rebuilds the trigger index. */
  async publish(companyId: string, flowId: string, versionId: string) {
    await this.mustGet(companyId, flowId);
    const [v] = await db.select().from(flowVersions).where(and(eq(flowVersions.id, versionId), eq(flowVersions.flowId, flowId)));
    if (!v) throw notFound('Flow version');
    const errors = validateFlowGraph(v.graph).filter(i => i.level === 'error');
    if (errors.length) throw new ApiError(422, 'FLOW_INVALID', `The flow has problems: ${errors.map(e => e.message).join(' ')}`, errors);
    await this.assertSubFlowsBelong(companyId, flowId, v.graph);

    await db.transaction(async tx => {
      await tx.update(flowVersions).set({ status: 'archived' }).where(and(eq(flowVersions.flowId, flowId), eq(flowVersions.status, 'published')));
      await tx.update(flowVersions).set({ status: 'published', publishedAt: new Date() }).where(eq(flowVersions.id, versionId));
      await tx.update(flows).set({ activeVersionId: versionId, updatedAt: new Date() }).where(eq(flows.id, flowId));
    });
    await this.rebuildTriggers(companyId, flowId);
    return this.get(companyId, flowId);
  }

  /** Re-activates an older version as a new published one (keeps history linear). */
  async rollback(companyId: string, userId: string | null, flowId: string, versionId: string) {
    await this.mustGet(companyId, flowId);
    const [old] = await db.select().from(flowVersions).where(and(eq(flowVersions.id, versionId), eq(flowVersions.flowId, flowId)));
    if (!old) throw notFound('Flow version');
    if (old.status === 'draft') throw conflict('FLOW_ROLLBACK_DRAFT', 'Publish the draft instead of rolling back to it.');
    const latest = (await this.versionsOf(flowId))[0]!;
    const [copy] = await db
      .insert(flowVersions)
      .values({ flowId, companyId, version: latest.version + 1, status: 'draft', graph: old.graph, settings: old.settings, changeNote: `Rollback to v${old.version}`, createdBy: userId })
      .returning();
    return this.publish(companyId, flowId, copy!.id);
  }

  private async assertSubFlowsBelong(companyId: string, flowId: string, graph: FlowGraph) {
    const ids = graph.nodes.filter(n => n.type === 'sub_flow').map(n => String(n.data.flowId));
    if (ids.includes(flowId)) throw new ApiError(422, 'FLOW_SELF_REFERENCE', 'A flow cannot call itself.');
    if (ids.length === 0) return;
    const found = await db.select({ id: flows.id }).from(flows).where(and(inArray(flows.id, ids), eq(flows.companyId, companyId), isNull(flows.deletedAt)));
    if (found.length !== new Set(ids).size) throw new ApiError(422, 'FLOW_SUBFLOW_MISSING', 'A sub-flow step points to a flow that does not exist.');
  }

  private async rebuildTriggers(companyId: string, flowId: string) {
    await db.delete(flowTriggers).where(eq(flowTriggers.flowId, flowId));
    const [f] = await db.select().from(flows).where(eq(flows.id, flowId));
    if (!f?.activeVersionId || f.status !== 'active') return;
    const [v] = await db.select().from(flowVersions).where(eq(flowVersions.id, f.activeVersionId));
    if (!v) return;
    const rows = v.graph.nodes
      .filter(n => n.type === 'trigger' && n.data.triggerType)
      .map(n => {
        const type = String(n.data.triggerType);
        const { triggerType: _t, ...config } = n.data;
        return {
          companyId,
          flowId,
          flowVersionId: v.id,
          nodeId: n.id,
          triggerType: type,
          config,
          nextRunAt: type === 'schedule' ? new Date(Date.now() + Math.max(5, Number(n.data.everyMinutes) || 60) * 60_000) : null,
        };
      });
    if (rows.length) await db.insert(flowTriggers).values(rows);
  }

  // ---------------------------------------------------------------- running
  private async pickVersion(companyId: string, flowId: string, versionId?: string) {
    await this.mustGet(companyId, flowId);
    const versions = await this.versionsOf(flowId);
    const v = versionId ? versions.find(x => x.id === versionId) : versions[0];
    if (!v) throw notFound('Flow version');
    return v;
  }

  private async assertLeadBelongs(companyId: string, leadId: string) {
    const [l] = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.id, leadId), eq(leads.companyId, companyId)));
    if (!l) throw notFound('Lead');
  }

  /** Test run: dry-run by default (nothing is sent), always flagged and traced. */
  async test(companyId: string, flowId: string, input: TestFlowInput) {
    const v = await this.pickVersion(companyId, flowId, input.versionId);
    const errors = validateFlowGraph(v.graph).filter(i => i.level === 'error');
    if (errors.length) throw new ApiError(422, 'FLOW_INVALID', `Fix these first: ${errors.map(e => e.message).join(' ')}`, errors);
    if (input.leadId) await this.assertLeadBelongs(companyId, input.leadId);
    const trigger = v.graph.nodes.find(n => n.type === 'trigger')!;
    const started = await flowEngine.start({
      companyId,
      flowId,
      versionId: v.id,
      graph: v.graph,
      settings: v.settings,
      triggerType: String(trigger.data.triggerType ?? 'webhook'),
      nodeId: trigger.id,
      leadId: input.leadId,
      event: input.event,
      isTest: true,
      dryRun: input.dryRun,
    });
    return this.getExecution(companyId, started.executionId);
  }

  /** Manual / API trigger of the published version's `webhook` entry point. */
  async trigger(companyId: string, flowId: string, input: TriggerFlowInput) {
    const f = await this.mustGet(companyId, flowId);
    if (f.status !== 'active' || !f.activeVersionId) throw conflict('FLOW_NOT_PUBLISHED', 'Publish the flow first.');
    const [v] = await db.select().from(flowVersions).where(eq(flowVersions.id, f.activeVersionId));
    const entry = v?.graph.nodes.find(n => n.type === 'trigger' && n.data.triggerType === 'webhook');
    if (!v || !entry) throw conflict('FLOW_NO_WEBHOOK_TRIGGER', 'This flow has no "API / webhook" trigger.');
    if (input.leadId) await this.assertLeadBelongs(companyId, input.leadId);
    const started = await flowEngine.start({ companyId, flowId, versionId: v.id, graph: v.graph, settings: v.settings, triggerType: 'webhook', nodeId: entry.id, leadId: input.leadId, event: input.event });
    return this.getExecution(companyId, started.executionId);
  }

  // ---------------------------------------------------------------- executions
  private async executionRows(companyId: string, where: ReturnType<typeof and>, limit: number) {
    return db
      .select({
        e: flowExecutions,
        flowName: flows.name,
        version: flowVersions.version,
        first: contacts.firstName,
        last: contacts.lastName,
      })
      .from(flowExecutions)
      .innerJoin(flows, eq(flows.id, flowExecutions.flowId))
      .innerJoin(flowVersions, eq(flowVersions.id, flowExecutions.flowVersionId))
      .leftJoin(contacts, eq(contacts.id, flowExecutions.contactId))
      .where(and(eq(flowExecutions.companyId, companyId), where))
      .orderBy(desc(flowExecutions.startedAt))
      .limit(limit);
  }

  private toExecution(r: Awaited<ReturnType<FlowsService['executionRows']>>[number]): FlowExecutionItem {
    const e = r.e;
    return {
      id: e.id,
      flowId: e.flowId,
      flowName: r.flowName,
      flowVersion: r.version,
      triggerType: e.triggerType,
      leadId: e.leadId,
      leadName: r.first ? `${r.first} ${r.last ?? ''}`.trim() : null,
      conversationId: e.conversationId,
      status: e.status as FlowExecutionItem['status'],
      isTest: e.isTest,
      currentNode: e.currentNode,
      resumeAt: e.resumeAt?.toISOString() ?? null,
      error: e.error,
      totalTokens: e.totalTokens,
      startedAt: e.startedAt.toISOString(),
      finishedAt: e.finishedAt?.toISOString() ?? null,
      durationMs: e.finishedAt ? e.finishedAt.getTime() - e.startedAt.getTime() : null,
    };
  }

  async listExecutions(companyId: string, f: { flowId?: string; status?: string; includeTests?: boolean; limit?: number }): Promise<FlowExecutionItem[]> {
    const conds = [f.includeTests ? undefined : eq(flowExecutions.isTest, false), f.flowId ? eq(flowExecutions.flowId, f.flowId) : undefined, f.status ? eq(flowExecutions.status, f.status) : undefined].filter(
      (c): c is NonNullable<typeof c> => c !== undefined,
    );
    const rows = await this.executionRows(companyId, and(...conds), Math.min(f.limit ?? 50, 200));
    return rows.map(r => this.toExecution(r));
  }

  async getExecution(companyId: string, id: string): Promise<FlowExecutionDetail> {
    const [row] = await this.executionRows(companyId, eq(flowExecutions.id, id), 1);
    if (!row) throw notFound('Execution');
    const steps = await db.select().from(flowStepRuns).where(and(eq(flowStepRuns.executionId, id), eq(flowStepRuns.companyId, companyId))).orderBy(flowStepRuns.startedAt);
    return {
      ...this.toExecution(row),
      variables: row.e.variables,
      steps: steps.map<FlowStepRunItem>(s => ({
        id: s.id,
        nodeId: s.nodeId,
        nodeType: s.nodeType,
        status: s.status as FlowStepRunItem['status'],
        input: s.input,
        output: s.output,
        error: s.error,
        tokens: s.tokens,
        durationMs: s.durationMs,
        startedAt: s.startedAt.toISOString(),
      })),
    };
  }

  async cancelExecution(companyId: string, id: string): Promise<{ cancelled: boolean }> {
    return { cancelled: await flowEngine.cancel(companyId, id) };
  }
}

export const flowsService = new FlowsService();
