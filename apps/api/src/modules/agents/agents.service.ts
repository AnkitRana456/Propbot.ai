import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  agentVersionContentSchema,
  type AgentItem,
  type AgentVersionContent,
  type AgentVersionItem,
  type CompareAgentInput,
  type CreateAgentInput,
  type FormFieldItem,
  type KnowledgeReferenceInput,
  type SaveDraftInput,
  type TestAgentInput,
  type TestCaseInput,
  type UpdateAgentInput,
} from '@propbot/shared';
import { db } from '../../db/index.js';
import {
  agentTestCases,
  agentVersions,
  agents,
  chatbots,
  companies,
  forms,
  knowledgeReferenceSources,
  knowledgeReferences,
  knowledgeSources,
} from '../../db/schema/index.js';
import { ApiError, badRequest, conflict, notFound } from '../../utils/api-error.js';
import { retrievalService, type RetrievalQueryOptions } from '../ai/retrieval.service.js';
import { formsService } from '../forms/forms.service.js';
import { resolveMediaProject } from '../chat/media-loader.js';
import { AGENT_TEMPLATES, findTemplate } from './agent-templates.js';
import { buildAgentInstructions, type RuntimeContext } from './agent-runtime.js';
import { liveInventoryFacts } from '../tools/live-inventory.js';

type AgentRow = typeof agents.$inferSelect;
type VersionRow = typeof agentVersions.$inferSelect;

export interface LoadedAgent {
  agentId: string;
  agentName: string;
  versionId: string;
  version: number;
  content: AgentVersionContent;
  formId: string | null;
  formFields: FormFieldItem[];
  sourceIds: string[];
}

export function rowToContent(v: VersionRow): AgentVersionContent {
  // Stored JSON is re-parsed so old rows pick up new defaults and can never hand malformed data to the runtime
  return agentVersionContentSchema.parse({
    prompt: v.prompt,
    variables: v.variables,
    conditions: v.conditions,
    knowledge: v.knowledge,
    formId: v.formId,
    model: v.model,
    temperature: Number(v.temperature),
    maxOutputTokens: v.maxOutputTokens,
    flags: v.flags,
  });
}

const toVersionItem = (v: VersionRow): AgentVersionItem => ({
  ...rowToContent(v),
  id: v.id,
  agentId: v.agentId,
  version: v.version,
  status: v.status as AgentVersionItem['status'],
  changeNote: v.changeNote,
  createdAt: v.createdAt.toISOString(),
  publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
});

export class AgentsService {
  templates() {
    return AGENT_TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description, tags: t.tags }));
  }

  // ------------------------------------------------------------------ reads
  private async mustGetAgent(companyId: string, id: string): Promise<AgentRow> {
    const [a] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, id), eq(agents.companyId, companyId), isNull(agents.deletedAt)));
    if (!a) throw notFound('Agent');
    return a;
  }

  private async toAgentItem(a: AgentRow, versions: VersionRow[], chatbotCount: number): Promise<AgentItem> {
    const active = versions.find(v => v.id === a.activeVersionId);
    const latest = versions.reduce((m, v) => Math.max(m, v.version), 0);
    return {
      id: a.id,
      name: a.name,
      description: a.description,
      tags: a.tags,
      template: a.template,
      status: a.status as AgentItem['status'],
      activeVersionId: a.activeVersionId,
      activeVersion: active?.version ?? null,
      latestVersion: latest,
      hasUnpublishedDraft: versions.some(v => v.status === 'draft'),
      chatbotCount,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  async list(companyId: string): Promise<AgentItem[]> {
    const rows = await db
      .select()
      .from(agents)
      .where(and(eq(agents.companyId, companyId), isNull(agents.deletedAt)))
      .orderBy(desc(agents.updatedAt));
    if (rows.length === 0) return [];
    const versions = await db.select().from(agentVersions).where(eq(agentVersions.companyId, companyId));
    const counts = await db
      .select({ agentId: chatbots.agentId, n: sql<number>`count(*)::int` })
      .from(chatbots)
      .where(and(eq(chatbots.companyId, companyId), isNull(chatbots.deletedAt), sql`${chatbots.agentId} IS NOT NULL`))
      .groupBy(chatbots.agentId);
    const countBy = new Map(counts.map(c => [c.agentId, c.n]));
    return Promise.all(
      rows.map(a =>
        this.toAgentItem(
          a,
          versions.filter(v => v.agentId === a.id),
          countBy.get(a.id) ?? 0,
        ),
      ),
    );
  }

  async get(companyId: string, id: string): Promise<{ agent: AgentItem; versions: AgentVersionItem[] }> {
    const a = await this.mustGetAgent(companyId, id);
    const versions = await db.select().from(agentVersions).where(eq(agentVersions.agentId, id)).orderBy(desc(agentVersions.version));
    const [{ n } = { n: 0 }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(chatbots)
      .where(and(eq(chatbots.agentId, id), isNull(chatbots.deletedAt)));
    return { agent: await this.toAgentItem(a, versions, n), versions: versions.map(toVersionItem) };
  }

  async getVersion(companyId: string, agentId: string, versionId: string): Promise<AgentVersionItem> {
    await this.mustGetAgent(companyId, agentId);
    const [v] = await db
      .select()
      .from(agentVersions)
      .where(and(eq(agentVersions.id, versionId), eq(agentVersions.agentId, agentId)));
    if (!v) throw notFound('Agent version');
    return toVersionItem(v);
  }

  // ------------------------------------------------------------------ writes
  async create(companyId: string, userId: string | null, input: CreateAgentInput): Promise<{ agent: AgentItem; versions: AgentVersionItem[] }> {
    const tpl = findTemplate(input.template ?? 'blank');
    if (input.template && !tpl) throw badRequest('UNKNOWN_TEMPLATE', `Unknown template "${input.template}".`);
    const content = tpl!.content;

    const [dupe] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.companyId, companyId), isNull(agents.deletedAt), sql`lower(${agents.name}) = lower(${input.name})`));
    if (dupe) throw conflict('AGENT_NAME_TAKEN', `An agent named "${input.name}" already exists.`);

    const id = await db.transaction(async tx => {
      const [a] = await tx
        .insert(agents)
        .values({
          companyId,
          name: input.name,
          description: input.description ?? tpl!.description,
          tags: input.tags.length ? input.tags : tpl!.tags,
          template: tpl!.id,
          createdBy: userId,
        })
        .returning({ id: agents.id });
      await tx.insert(agentVersions).values(this.versionValues(a!.id, companyId, 1, 'draft', content, userId, 'Created from template'));
      return a!.id;
    });
    return this.get(companyId, id);
  }

  private versionValues(
    agentId: string,
    companyId: string,
    version: number,
    status: 'draft' | 'published',
    c: AgentVersionContent,
    userId: string | null,
    changeNote: string | null,
  ) {
    return {
      agentId,
      companyId,
      version,
      status,
      prompt: c.prompt as Record<string, unknown>,
      variables: c.variables,
      conditions: c.conditions,
      knowledge: c.knowledge as Record<string, unknown>,
      formId: c.formId ?? null,
      model: c.model,
      temperature: c.temperature.toFixed(2),
      maxOutputTokens: c.maxOutputTokens,
      flags: c.flags as Record<string, unknown>,
      changeNote,
      createdBy: userId,
      publishedAt: status === 'published' ? new Date() : null,
    };
  }

  async updateMeta(companyId: string, id: string, input: UpdateAgentInput): Promise<AgentItem> {
    const a = await this.mustGetAgent(companyId, id);
    if (input.name && input.name.toLowerCase() !== a.name.toLowerCase()) {
      const [dupe] = await db
        .select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.companyId, companyId), isNull(agents.deletedAt), sql`lower(${agents.name}) = lower(${input.name})`));
      if (dupe) throw conflict('AGENT_NAME_TAKEN', `An agent named "${input.name}" already exists.`);
    }
    if (input.status === 'archived') await this.assertNotInUse(companyId, id, 'archived');
    await db
      .update(agents)
      .set({
        name: input.name ?? a.name,
        description: input.description !== undefined ? input.description : a.description,
        tags: input.tags ?? a.tags,
        status: input.status ?? a.status,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, id));
    return (await this.get(companyId, id)).agent;
  }

  private async assertNotInUse(companyId: string, agentId: string, verb: string): Promise<void> {
    const [bot] = await db
      .select({ name: chatbots.name })
      .from(chatbots)
      .where(and(eq(chatbots.companyId, companyId), eq(chatbots.agentId, agentId), isNull(chatbots.deletedAt)))
      .limit(1);
    if (bot) throw conflict('AGENT_IN_USE', `Agent is used by the chatbot "${bot.name}" and cannot be ${verb}. Assign a different agent first.`);
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.mustGetAgent(companyId, id);
    await this.assertNotInUse(companyId, id, 'deleted');
    await db.update(agents).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(agents.id, id));
  }

  /** Cross-tenant guard: a version may only reference this company's form, sources and references. */
  private async assertReferencesBelongToCompany(companyId: string, c: AgentVersionContent): Promise<void> {
    if (c.formId) {
      const [f] = await db
        .select({ id: forms.id })
        .from(forms)
        .where(and(eq(forms.id, c.formId), eq(forms.companyId, companyId), isNull(forms.deletedAt)));
      if (!f) throw badRequest('INVALID_FORM', 'The selected form does not exist.');
    }
    const sourceIds = c.knowledge.sourceIds;
    if (sourceIds.length) {
      const found = await db
        .select({ id: knowledgeSources.id })
        .from(knowledgeSources)
        .where(and(eq(knowledgeSources.companyId, companyId), inArray(knowledgeSources.id, sourceIds)));
      if (found.length !== new Set(sourceIds).size) throw badRequest('INVALID_SOURCE', 'One or more knowledge sources do not exist.');
    }
    const refIds = c.knowledge.referenceIds;
    if (refIds.length) {
      const found = await db
        .select({ id: knowledgeReferences.id })
        .from(knowledgeReferences)
        .where(and(eq(knowledgeReferences.companyId, companyId), isNull(knowledgeReferences.deletedAt), inArray(knowledgeReferences.id, refIds)));
      if (found.length !== new Set(refIds).size) throw badRequest('INVALID_REFERENCE', 'One or more knowledge references do not exist.');
    }
  }

  /**
   * Edits go to a draft. Published versions are immutable: saving while the newest version is
   * published starts a new draft copied from it.
   */
  async saveDraft(companyId: string, userId: string | null, agentId: string, patch: SaveDraftInput): Promise<AgentVersionItem> {
    await this.mustGetAgent(companyId, agentId);
    const versions = await db.select().from(agentVersions).where(eq(agentVersions.agentId, agentId)).orderBy(desc(agentVersions.version));
    const latest = versions[0];
    if (!latest) throw notFound('Agent version');

    const { changeNote, ...rest } = patch;
    const base = rowToContent(latest);
    const merged = agentVersionContentSchema.parse({
      ...base,
      ...rest,
      // Nested objects are replaced as a whole when supplied, so a client can remove entries
      prompt: rest.prompt ?? base.prompt,
      knowledge: rest.knowledge ?? base.knowledge,
      flags: rest.flags ?? base.flags,
      formId: rest.formId !== undefined ? rest.formId : base.formId,
    });
    await this.assertReferencesBelongToCompany(companyId, merged);

    if (latest.status === 'draft') {
      await db
        .update(agentVersions)
        .set({
          prompt: merged.prompt as Record<string, unknown>,
          variables: merged.variables,
          conditions: merged.conditions,
          knowledge: merged.knowledge as Record<string, unknown>,
          formId: merged.formId ?? null,
          model: merged.model,
          temperature: merged.temperature.toFixed(2),
          maxOutputTokens: merged.maxOutputTokens,
          flags: merged.flags as Record<string, unknown>,
          changeNote: changeNote !== undefined ? changeNote : latest.changeNote,
        })
        .where(eq(agentVersions.id, latest.id));
      await db.update(agents).set({ updatedAt: new Date() }).where(eq(agents.id, agentId));
      return this.getVersion(companyId, agentId, latest.id);
    }

    const [created] = await db
      .insert(agentVersions)
      .values(this.versionValues(agentId, companyId, latest.version + 1, 'draft', merged, userId, changeNote ?? null))
      .returning({ id: agentVersions.id });
    await db.update(agents).set({ updatedAt: new Date() }).where(eq(agents.id, agentId));
    return this.getVersion(companyId, agentId, created!.id);
  }

  async discardDraft(companyId: string, agentId: string, versionId: string): Promise<void> {
    await this.mustGetAgent(companyId, agentId);
    const [v] = await db.select().from(agentVersions).where(and(eq(agentVersions.id, versionId), eq(agentVersions.agentId, agentId)));
    if (!v) throw notFound('Agent version');
    if (v.status !== 'draft') throw conflict('NOT_A_DRAFT', 'Only drafts can be discarded.');
    const total = await db.select({ id: agentVersions.id }).from(agentVersions).where(eq(agentVersions.agentId, agentId));
    if (total.length <= 1) throw conflict('LAST_VERSION', 'An agent needs at least one version.');
    await db.delete(agentVersions).where(eq(agentVersions.id, versionId));
  }

  async publish(companyId: string, agentId: string, versionId: string, changeNote?: string | null): Promise<{ agent: AgentItem; versions: AgentVersionItem[] }> {
    const a = await this.mustGetAgent(companyId, agentId);
    if (a.status !== 'active') throw conflict('AGENT_ARCHIVED', 'Archived agents cannot be published.');
    const [v] = await db.select().from(agentVersions).where(and(eq(agentVersions.id, versionId), eq(agentVersions.agentId, agentId)));
    if (!v) throw notFound('Agent version');
    if (v.status === 'published') throw conflict('ALREADY_PUBLISHED', 'This version is already live.');

    const content = rowToContent(v);
    if (!content.prompt.jobDescription.trim()) throw badRequest('MISSING_JOB', 'Describe the agent\'s job before publishing.');
    await this.assertReferencesBelongToCompany(companyId, content);

    await db.transaction(async tx => {
      if (a.activeVersionId) {
        await tx.update(agentVersions).set({ status: 'archived' }).where(eq(agentVersions.id, a.activeVersionId));
      }
      await tx
        .update(agentVersions)
        .set({ status: 'published', publishedAt: new Date(), ...(changeNote !== undefined ? { changeNote } : {}) })
        .where(eq(agentVersions.id, versionId));
      await tx.update(agents).set({ activeVersionId: versionId, updatedAt: new Date() }).where(eq(agents.id, agentId));
    });
    return this.get(companyId, agentId);
  }

  /** History stays linear: rolling back publishes a NEW version that copies an older one. */
  async rollback(companyId: string, userId: string | null, agentId: string, toVersionId: string) {
    const target = await this.getVersion(companyId, agentId, toVersionId);
    const [latest] = await db
      .select({ version: agentVersions.version })
      .from(agentVersions)
      .where(eq(agentVersions.agentId, agentId))
      .orderBy(desc(agentVersions.version))
      .limit(1);
    const content = agentVersionContentSchema.parse(target);
    await this.assertReferencesBelongToCompany(companyId, content);
    const [created] = await db
      .insert(agentVersions)
      .values(this.versionValues(agentId, companyId, (latest?.version ?? 0) + 1, 'draft', content, userId, `Rollback to v${target.version}`))
      .returning({ id: agentVersions.id });
    return this.publish(companyId, agentId, created!.id, `Rollback to v${target.version}`);
  }

  // ------------------------------------------------------------------ chatbot assignment
  async assignToChatbot(companyId: string, chatbotId: string, agentId: string | null): Promise<void> {
    const [bot] = await db
      .select({ id: chatbots.id })
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.companyId, companyId), isNull(chatbots.deletedAt)));
    if (!bot) throw notFound('Chatbot');
    if (agentId) {
      const a = await this.mustGetAgent(companyId, agentId);
      if (a.status !== 'active') throw conflict('AGENT_ARCHIVED', 'Archived agents cannot be assigned.');
      if (!a.activeVersionId) throw conflict('NOT_PUBLISHED', 'Publish the agent before assigning it to a chatbot.');
    }
    await db.update(chatbots).set({ agentId, updatedAt: new Date() }).where(eq(chatbots.id, chatbotId));
  }

  // ------------------------------------------------------------------ runtime loading
  private async resolveSourceIds(companyId: string, content: AgentVersionContent): Promise<string[]> {
    const ids = new Set(content.knowledge.sourceIds);
    if (content.knowledge.referenceIds.length) {
      const rows = await db
        .select({ sourceId: knowledgeReferenceSources.sourceId })
        .from(knowledgeReferenceSources)
        .innerJoin(knowledgeReferences, eq(knowledgeReferences.id, knowledgeReferenceSources.referenceId))
        .where(
          and(
            eq(knowledgeReferences.companyId, companyId),
            isNull(knowledgeReferences.deletedAt),
            inArray(knowledgeReferenceSources.referenceId, content.knowledge.referenceIds),
          ),
        );
      rows.forEach(r => ids.add(r.sourceId));
    }
    return [...ids];
  }

  private async loadVersion(companyId: string, agentRow: AgentRow, v: VersionRow): Promise<LoadedAgent> {
    const content = rowToContent(v);
    let formFields: FormFieldItem[] = [];
    if (content.formId) {
      try {
        formFields = (await formsService.get(companyId, content.formId)).fields;
      } catch {
        formFields = []; // form deleted after publishing: the agent still works, it just stops collecting
      }
    }
    return {
      agentId: agentRow.id,
      agentName: agentRow.name,
      versionId: v.id,
      version: v.version,
      content,
      formId: formFields.length ? content.formId ?? null : null,
      formFields,
      sourceIds: await this.resolveSourceIds(companyId, content),
    };
  }

  /** The published agent of a chatbot, or null when the chatbot uses the legacy persona. */
  async loadForChatbot(companyId: string, chatbotId: string): Promise<LoadedAgent | null> {
    const [bot] = await db
      .select({ agentId: chatbots.agentId })
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.companyId, companyId)));
    if (!bot?.agentId) return null;
    const [a] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, bot.agentId), eq(agents.companyId, companyId), isNull(agents.deletedAt), eq(agents.status, 'active')));
    if (!a?.activeVersionId) return null;
    const [v] = await db.select().from(agentVersions).where(eq(agentVersions.id, a.activeVersionId));
    return v ? this.loadVersion(companyId, a, v) : null;
  }

  /** The published version of an agent, or null when it is archived or unpublished. */
  async loadActive(companyId: string, agentId: string): Promise<LoadedAgent | null> {
    const [a] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId), isNull(agents.deletedAt), eq(agents.status, 'active')));
    if (!a?.activeVersionId) return null;
    const [v] = await db.select().from(agentVersions).where(eq(agentVersions.id, a.activeVersionId));
    return v ? this.loadVersion(companyId, a, v) : null;
  }

  async loadVersionForTest(companyId: string, agentId: string, versionId?: string): Promise<LoadedAgent> {
    const a = await this.mustGetAgent(companyId, agentId);
    let v: VersionRow | undefined;
    if (versionId) {
      [v] = await db.select().from(agentVersions).where(and(eq(agentVersions.id, versionId), eq(agentVersions.agentId, agentId)));
    } else {
      [v] = await db.select().from(agentVersions).where(eq(agentVersions.agentId, agentId)).orderBy(desc(agentVersions.version)).limit(1);
    }
    if (!v) throw notFound('Agent version');
    return this.loadVersion(companyId, a, v);
  }

  /** Everything the retrieval/LLM call needs for one visitor turn. */
  toRetrievalOptions(
    loaded: LoadedAgent,
    ctx: RuntimeContext,
    extras: Pick<RetrievalQueryOptions, 'history' | 'trace' | 'skipGeneration'> = {},
  ): RetrievalQueryOptions {
    return {
      sourceIds: loaded.sourceIds,
      agentInstructions: buildAgentInstructions(loaded.content, loaded.formFields, ctx),
      model: loaded.content.model,
      temperature: loaded.content.temperature,
      maxTokens: loaded.content.maxOutputTokens,
      ...extras,
    };
  }

  // ------------------------------------------------------------------ test panel & comparison
  private async testChatbotId(companyId: string, agentId: string, requested?: string): Promise<string | null> {
    const candidates = await db
      .select({ id: chatbots.id, agentId: chatbots.agentId })
      .from(chatbots)
      .where(and(eq(chatbots.companyId, companyId), isNull(chatbots.deletedAt)))
      .orderBy(asc(chatbots.createdAt));
    if (requested) {
      if (!candidates.some(c => c.id === requested)) throw notFound('Chatbot');
      return requested;
    }
    return (candidates.find(c => c.agentId === agentId) ?? candidates[0])?.id ?? null;
  }

  private async runTurn(
    companyId: string,
    loaded: LoadedAgent,
    chatbotId: string | null,
    history: Array<{ role: 'visitor' | 'assistant'; content: string }>,
    message: string,
    variables: Record<string, string>,
    purpose: 'test' | 'compare',
  ) {
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId));
    const project = chatbotId ? await resolveMediaProject(companyId, chatbotId, message) : null;
    const ctx: RuntimeContext = {
      botName: loaded.agentName,
      companyName: company?.name ?? 'our team',
      projectName: project?.name,
      projectLocation: project?.location,
      overrides: variables,
      visitorMessage: message,
      liveFacts: await liveInventoryFacts(companyId, message),
    };
    const options = this.toRetrievalOptions(loaded, ctx, {
      history,
      trace: { agentId: loaded.agentId, agentVersionId: loaded.versionId, channel: 'agent_test', purpose },
    });
    if (!chatbotId) {
      return { reply: 'Create a chatbot with knowledge first: the agent needs a chatbot to retrieve project facts from.', citations: [], isGrounded: false, tokens: 0, latencyMs: 0, instructions: options.agentInstructions ?? '' };
    }
    const res = await retrievalService.query(companyId, chatbotId, { query: message }, options);
    return {
      reply: res.answer,
      citations: res.citations,
      isGrounded: res.isGrounded,
      tokens: res.tokensUsed?.total ?? 0,
      latencyMs: res.latencyMs,
      instructions: options.agentInstructions ?? '',
    };
  }

  async test(companyId: string, agentId: string, input: TestAgentInput & { chatbotId?: string }) {
    const loaded = await this.loadVersionForTest(companyId, agentId, input.versionId);
    const last = input.messages[input.messages.length - 1]!;
    if (last.role !== 'visitor') throw badRequest('LAST_MESSAGE_NOT_VISITOR', 'The last message must come from the visitor.');
    const chatbotId = await this.testChatbotId(companyId, agentId, input.chatbotId);
    const turn = await this.runTurn(companyId, loaded, chatbotId, input.messages.slice(0, -1), last.content, input.variables, 'test');
    return { version: loaded.version, versionId: loaded.versionId, model: loaded.content.model, ...turn };
  }

  async compare(companyId: string, agentId: string, input: CompareAgentInput & { chatbotId?: string }) {
    const [a, b] = await Promise.all([
      this.loadVersionForTest(companyId, agentId, input.versionA),
      this.loadVersionForTest(companyId, agentId, input.versionB),
    ]);
    const chatbotId = await this.testChatbotId(companyId, agentId, input.chatbotId);
    const histA: Array<{ role: 'visitor' | 'assistant'; content: string }> = [];
    const histB: Array<{ role: 'visitor' | 'assistant'; content: string }> = [];
    const rows: Array<{ message: string; a: Awaited<ReturnType<AgentsService['runTurn']>>; b: Awaited<ReturnType<AgentsService['runTurn']>> }> = [];
    for (const message of input.messages) {
      const [ra, rb] = await Promise.all([
        this.runTurn(companyId, a, chatbotId, histA, message, input.variables, 'compare'),
        this.runTurn(companyId, b, chatbotId, histB, message, input.variables, 'compare'),
      ]);
      histA.push({ role: 'visitor', content: message }, { role: 'assistant', content: ra.reply });
      histB.push({ role: 'visitor', content: message }, { role: 'assistant', content: rb.reply });
      rows.push({ message, a: ra, b: rb });
    }
    return {
      a: { version: a.version, versionId: a.versionId, model: a.content.model },
      b: { version: b.version, versionId: b.versionId, model: b.content.model },
      rows,
    };
  }

  // ------------------------------------------------------------------ test cases
  async listTestCases(companyId: string, agentId: string) {
    await this.mustGetAgent(companyId, agentId);
    return db.select().from(agentTestCases).where(and(eq(agentTestCases.agentId, agentId), eq(agentTestCases.companyId, companyId))).orderBy(asc(agentTestCases.createdAt));
  }

  async saveTestCase(companyId: string, agentId: string, input: TestCaseInput, id?: string) {
    await this.mustGetAgent(companyId, agentId);
    if (id) {
      const [updated] = await db
        .update(agentTestCases)
        .set({ name: input.name, messages: input.messages, notes: input.notes ?? null, updatedAt: new Date() })
        .where(and(eq(agentTestCases.id, id), eq(agentTestCases.agentId, agentId), eq(agentTestCases.companyId, companyId)))
        .returning();
      if (!updated) throw notFound('Test case');
      return updated;
    }
    const [created] = await db
      .insert(agentTestCases)
      .values({ agentId, companyId, name: input.name, messages: input.messages, notes: input.notes ?? null })
      .returning();
    return created!;
  }

  async deleteTestCase(companyId: string, agentId: string, id: string) {
    const res = await db
      .delete(agentTestCases)
      .where(and(eq(agentTestCases.id, id), eq(agentTestCases.agentId, agentId), eq(agentTestCases.companyId, companyId)))
      .returning({ id: agentTestCases.id });
    if (res.length === 0) throw notFound('Test case');
  }

  // ------------------------------------------------------------------ knowledge references
  async listReferences(companyId: string) {
    const refs = await db
      .select()
      .from(knowledgeReferences)
      .where(and(eq(knowledgeReferences.companyId, companyId), isNull(knowledgeReferences.deletedAt)))
      .orderBy(asc(knowledgeReferences.name));
    const links = await db.select().from(knowledgeReferenceSources).where(eq(knowledgeReferenceSources.companyId, companyId));
    return refs.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      sourceIds: links.filter(l => l.referenceId === r.id).map(l => l.sourceId),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  private async assertSourcesBelong(companyId: string, sourceIds: string[]) {
    if (!sourceIds.length) return;
    const found = await db
      .select({ id: knowledgeSources.id })
      .from(knowledgeSources)
      .where(and(eq(knowledgeSources.companyId, companyId), inArray(knowledgeSources.id, sourceIds)));
    if (found.length !== new Set(sourceIds).size) throw badRequest('INVALID_SOURCE', 'One or more knowledge sources do not exist.');
  }

  async saveReference(companyId: string, input: KnowledgeReferenceInput, id?: string) {
    await this.assertSourcesBelong(companyId, input.sourceIds);
    try {
      const refId = await db.transaction(async tx => {
        let rid = id;
        if (rid) {
          const [u] = await tx
            .update(knowledgeReferences)
            .set({ name: input.name, description: input.description ?? null, updatedAt: new Date() })
            .where(and(eq(knowledgeReferences.id, rid), eq(knowledgeReferences.companyId, companyId), isNull(knowledgeReferences.deletedAt)))
            .returning({ id: knowledgeReferences.id });
          if (!u) throw notFound('Knowledge reference');
          await tx.delete(knowledgeReferenceSources).where(eq(knowledgeReferenceSources.referenceId, rid));
        } else {
          const [c] = await tx
            .insert(knowledgeReferences)
            .values({ companyId, name: input.name, description: input.description ?? null })
            .returning({ id: knowledgeReferences.id });
          rid = c!.id;
        }
        if (input.sourceIds.length) {
          await tx.insert(knowledgeReferenceSources).values([...new Set(input.sourceIds)].map(sourceId => ({ referenceId: rid!, sourceId, companyId })));
        }
        return rid;
      });
      return (await this.listReferences(companyId)).find(r => r.id === refId)!;
    } catch (err) {
      const e = err as { code?: string; cause?: { code?: string } };
      if (e.code === '23505' || e.cause?.code === '23505') throw conflict('REFERENCE_NAME_TAKEN', `A reference named "${input.name}" already exists.`);
      throw err;
    }
  }

  async deleteReference(companyId: string, id: string) {
    const res = await db
      .update(knowledgeReferences)
      .set({ deletedAt: new Date() })
      .where(and(eq(knowledgeReferences.id, id), eq(knowledgeReferences.companyId, companyId), isNull(knowledgeReferences.deletedAt)))
      .returning({ id: knowledgeReferences.id });
    if (res.length === 0) throw notFound('Knowledge reference');
  }
}

export { ApiError };
export const agentsService = new AgentsService();
