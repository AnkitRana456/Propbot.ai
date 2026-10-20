import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import {
  apiToolConfigSchema,
  gptToolConfigSchema,
  type CreateToolInput,
  type ToolItem,
  type ToolParam,
  type ToolRunItem,
  type UpdateToolInput,
} from '@propbot/shared';
import { db } from '../../db/index.js';
import { toolRuns, tools } from '../../db/schema/index.js';
import { modelRouter, TaskTier } from '../ai/router.js';
import { packEncryptedSecret, encryptSecret, unpackEncryptedSecret } from '../../utils/crypto-vault.js';
import { ApiError, badRequest, conflict, notFound } from '../../utils/api-error.js';
import { executeApiTool, renderTemplate } from './api-tool.js';

type ToolRow = typeof tools.$inferSelect;

const SECRET_KEY = '__secret';

function toItem(row: ToolRow): ToolItem {
  const { [SECRET_KEY]: secret, ...config } = row.config as Record<string, unknown>;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    type: row.type as ToolItem['type'],
    config,
    inputSchema: row.inputSchema as ToolParam[],
    outputSchema: row.outputSchema as ToolParam[],
    hasSecret: typeof secret === 'string' && secret.length > 0,
    requiresApproval: row.requiresApproval,
    rateLimitPerMin: row.rateLimitPerMin,
    status: row.status as ToolItem['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRunItem(r: typeof toolRuns.$inferSelect): ToolRunItem {
  return {
    id: r.id,
    toolId: r.toolId,
    status: r.status as ToolRunItem['status'],
    input: r.input,
    output: r.output ?? null,
    error: r.error,
    durationMs: r.durationMs,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Validates that the type-specific config parses; returns the normalised config. */
function normaliseConfig(type: 'gpt' | 'api', config: Record<string, unknown>): Record<string, unknown> {
  const parsed = (type === 'gpt' ? gptToolConfigSchema : apiToolConfigSchema).safeParse(config);
  if (!parsed.success) throw badRequest('TOOL_CONFIG_INVALID', parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
  if (type === 'api' && !(config.url as string).startsWith('https://') && process.env.NODE_ENV !== 'test') {
    throw badRequest('TOOL_URL_INSECURE', 'API tools must use an https:// URL.');
  }
  return parsed.data as Record<string, unknown>;
}

/** Coerces and checks run input against the declared parameters. */
function checkInput(schema: ToolParam[], input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of schema) {
    const v = input[p.key];
    if (v === undefined || v === null || v === '') {
      if (p.required) throw badRequest('TOOL_INPUT_INVALID', `"${p.key}" is required.`);
      continue;
    }
    if (p.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n)) throw badRequest('TOOL_INPUT_INVALID', `"${p.key}" must be a number.`);
      out[p.key] = n;
    } else if (p.type === 'boolean') {
      out[p.key] = v === true || v === 'true';
    } else {
      out[p.key] = String(v).slice(0, 2000);
    }
  }
  return out;
}

export interface ToolRunContext {
  userId?: string | null;
  agentId?: string | null;
  conversationId?: string | null;
  /** Calls made by an agent or flow honour `requiresApproval`; a person pressing "Test" does not. */
  source: 'test' | 'agent' | 'flow';
}

class ToolsService {
  async list(companyId: string): Promise<ToolItem[]> {
    const rows = await db.select().from(tools).where(and(eq(tools.companyId, companyId), isNull(tools.deletedAt))).orderBy(tools.name);
    return rows.map(toItem);
  }

  private async load(companyId: string, id: string): Promise<ToolRow> {
    const [row] = await db.select().from(tools).where(and(eq(tools.id, id), eq(tools.companyId, companyId), isNull(tools.deletedAt)));
    if (!row) throw notFound('Tool');
    return row;
  }

  async get(companyId: string, id: string): Promise<ToolItem> {
    return toItem(await this.load(companyId, id));
  }

  async create(companyId: string, userId: string | null, input: CreateToolInput): Promise<ToolItem> {
    const config = normaliseConfig(input.type, input.config);
    if (input.secret) config[SECRET_KEY] = packEncryptedSecret(encryptSecret(input.secret));
    try {
      const [row] = await db
        .insert(tools)
        .values({
          companyId,
          key: input.key,
          name: input.name,
          description: input.description ?? null,
          type: input.type,
          config,
          inputSchema: input.inputSchema,
          outputSchema: input.outputSchema,
          requiresApproval: input.requiresApproval,
          rateLimitPerMin: input.rateLimitPerMin,
          createdBy: userId,
        })
        .returning();
      return toItem(row!);
    } catch (e) {
      if (/tools_company_key_uniq|duplicate key/.test(String(e instanceof Error ? e.message : e) + String((e as { cause?: Error }).cause?.message ?? ''))) {
        throw conflict('TOOL_KEY_TAKEN', `A tool with the key "${input.key}" already exists.`);
      }
      throw e;
    }
  }

  async update(companyId: string, id: string, input: UpdateToolInput): Promise<ToolItem> {
    const row = await this.load(companyId, id);
    const patch: Partial<typeof tools.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.inputSchema !== undefined) patch.inputSchema = input.inputSchema;
    if (input.outputSchema !== undefined) patch.outputSchema = input.outputSchema;
    if (input.requiresApproval !== undefined) patch.requiresApproval = input.requiresApproval;
    if (input.rateLimitPerMin !== undefined) patch.rateLimitPerMin = input.rateLimitPerMin;
    if (input.status !== undefined) patch.status = input.status;

    const existing = row.config as Record<string, unknown>;
    let config = existing;
    if (input.config !== undefined) {
      config = normaliseConfig(row.type as 'gpt' | 'api', input.config);
      if (typeof existing[SECRET_KEY] === 'string') config[SECRET_KEY] = existing[SECRET_KEY];
    }
    if (input.clearSecret) delete config[SECRET_KEY];
    if (input.secret) config = { ...config, [SECRET_KEY]: packEncryptedSecret(encryptSecret(input.secret)) };
    if (input.config !== undefined || input.secret || input.clearSecret) patch.config = config;

    const [updated] = await db.update(tools).set(patch).where(and(eq(tools.id, id), eq(tools.companyId, companyId))).returning();
    return toItem(updated!);
  }

  async remove(companyId: string, id: string): Promise<{ deleted: boolean }> {
    await this.load(companyId, id);
    await db.update(tools).set({ deletedAt: new Date(), status: 'disabled' }).where(and(eq(tools.id, id), eq(tools.companyId, companyId)));
    return { deleted: true };
  }

  async runs(companyId: string, toolId: string, limit = 30): Promise<ToolRunItem[]> {
    await this.load(companyId, toolId);
    const rows = await db
      .select()
      .from(toolRuns)
      .where(and(eq(toolRuns.companyId, companyId), eq(toolRuns.toolId, toolId)))
      .orderBy(desc(toolRuns.createdAt))
      .limit(Math.min(limit, 100));
    return rows.map(toRunItem);
  }

  /** Executes a tool, always recording a run row (ok / error / blocked / pending_approval). */
  async execute(companyId: string, toolId: string, rawInput: Record<string, unknown>, ctx: ToolRunContext): Promise<ToolRunItem> {
    const tool = await this.load(companyId, toolId);
    const started = Date.now();
    const record = async (status: ToolRunItem['status'], input: Record<string, unknown>, output: unknown, error: string | null) => {
      const [r] = await db
        .insert(toolRuns)
        .values({
          companyId,
          toolId,
          agentId: ctx.agentId ?? null,
          conversationId: ctx.conversationId ?? null,
          status,
          input,
          output: output ?? null,
          error,
          durationMs: Date.now() - started,
        })
        .returning();
      return toRunItem(r!);
    };

    if (tool.status !== 'active') return record('blocked', rawInput, null, 'This tool is disabled.');
    if (tool.requiresApproval && ctx.source !== 'test') {
      return record('pending_approval', rawInput, null, 'Waiting for a person to approve this tool call.');
    }
    const [{ n } = { n: 0 }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(toolRuns)
      .where(and(eq(toolRuns.toolId, toolId), gte(toolRuns.createdAt, new Date(Date.now() - 60_000))));
    if (n >= tool.rateLimitPerMin) return record('blocked', rawInput, null, `Rate limit of ${tool.rateLimitPerMin} calls per minute reached.`);

    let input: Record<string, unknown>;
    try {
      input = checkInput(tool.inputSchema as ToolParam[], rawInput);
    } catch (e) {
      return record('error', rawInput, null, e instanceof Error ? e.message : 'Invalid input.');
    }

    try {
      const { [SECRET_KEY]: packed, ...config } = tool.config as Record<string, unknown>;
      const output =
        tool.type === 'gpt'
          ? await this.runGpt(companyId, tool, config, input, ctx)
          : (
              await executeApiTool(
                apiToolConfigSchema.parse(config),
                input,
                typeof packed === 'string' ? unpackEncryptedSecret(packed) : null,
                { allowLocalForTesting: process.env.NODE_ENV === 'test' },
              )
            ).output;
      return await record('ok', input, output, null);
    } catch (e) {
      const message = e instanceof ApiError || e instanceof Error ? e.message : 'The tool failed.';
      return record('error', input, null, message.slice(0, 500));
    }
  }

  private async runGpt(companyId: string, tool: ToolRow, config: Record<string, unknown>, input: Record<string, unknown>, ctx: ToolRunContext) {
    const cfg = gptToolConfigSchema.parse(config);
    const outputs = tool.outputSchema as ToolParam[];
    const spec = outputs.map(o => `- ${o.key} (${o.type})${o.description ? `: ${o.description}` : ''}`).join('\n');
    const res = await modelRouter.executeCompletion({
      tier: TaskTier.FAST,
      companyId,
      chatbotId: '',
      trace: { agentId: ctx.agentId ?? undefined, purpose: 'tool' },
      systemPrompt:
        'You run a single structured task. Reply with ONLY a JSON object, no prose.' +
        (spec ? `\nKeys:\n${spec}\nUse null when a value cannot be determined.` : ''),
      userMessage: renderTemplate(cfg.prompt, input),
      model: cfg.model,
      temperature: cfg.temperature,
      maxTokens: 500,
      promptName: `tool:${tool.key}`,
    });
    const match = /\{[\s\S]*\}/.exec(res.text);
    if (!match) throw new ApiError(502, 'TOOL_GPT_NO_JSON', 'The model did not return structured output.');
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    if (outputs.length === 0) return parsed;
    return Object.fromEntries(outputs.map(o => [o.key, parsed[o.key] ?? null]));
  }
}

export const toolsService = new ToolsService();
