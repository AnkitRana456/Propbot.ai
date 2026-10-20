import { and, desc, eq } from 'drizzle-orm';
import type { FormFieldItem } from '@propbot/shared';
import { pino } from 'pino';
import { db } from '../../db/index.js';
import { companies, contacts, conversations, leads, messages } from '../../db/schema/index.js';
import { modelRouter, TaskTier } from '../ai/router.js';
import type { RetrievalQueryOptions } from '../ai/retrieval.service.js';
import { resolveMediaProject } from '../chat/media-loader.js';
import { formsService } from '../forms/forms.service.js';
import { validateFormValues, type FieldDef } from '../forms/form-validation.js';
import { agentsService, type LoadedAgent } from './agents.service.js';
import type { RuntimeContext } from './agent-runtime.js';
import { liveInventoryFacts } from '../tools/live-inventory.js';

const log = pino({ name: 'agent-chat', level: process.env.LOG_LEVEL ?? 'info' });

export type ChatHistory = Array<{ role: 'visitor' | 'assistant'; content: string }>;

export interface PreparedAgentTurn {
  agent: LoadedAgent;
  options: RetrievalQueryOptions;
  history: ChatHistory;
}

/** Previous turns of a conversation (oldest first), without the visitor message currently being answered. */
export async function loadConversationHistory(conversationId: string, currentMessage: string, limit = 12): Promise<ChatHistory> {
  const rows = await db
    .select({ senderType: messages.senderType, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit + 1);
  if (rows[0]?.senderType === 'visitor' && rows[0].content.trim() === currentMessage.trim()) rows.shift();
  return rows
    .reverse()
    .filter(r => r.senderType !== 'system' && r.content.trim() && !r.content.startsWith('[Held for Approval'))
    .map(r => ({ role: r.senderType === 'visitor' ? ('visitor' as const) : ('assistant' as const), content: r.content }));
}

async function loadLeadContext(conversationId: string): Promise<{ lead: RuntimeContext['lead']; leadId: string | null; pending: Record<string, unknown> }> {
  const [conv] = await db
    .select({ leadId: conversations.leadId, metadata: conversations.metadata })
    .from(conversations)
    .where(eq(conversations.id, conversationId));
  const pending = ((conv?.metadata as Record<string, unknown> | undefined)?.collectedAttributes ?? {}) as Record<string, unknown>;
  if (!conv?.leadId) return { lead: { attributes: pending }, leadId: null, pending };

  const [row] = await db
    .select({
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      phone: contacts.phone,
      email: contacts.email,
      status: leads.status,
      source: leads.source,
      customFields: leads.customFields,
    })
    .from(leads)
    .innerJoin(contacts, eq(contacts.id, leads.contactId))
    .where(eq(leads.id, conv.leadId));
  if (!row) return { lead: { attributes: pending }, leadId: conv.leadId, pending };

  const saved = ((row.customFields as Record<string, unknown> | null)?.attributes ?? {}) as Record<string, unknown>;
  // WhatsApp placeholders such as "WhatsApp User 1234" are not a real name: do not greet people with them
  const name = `${row.firstName} ${row.lastName ?? ''}`.trim();
  return {
    leadId: conv.leadId,
    pending,
    lead: {
      name: /^WhatsApp User \d{4}$/.test(name) ? null : name,
      phone: row.phone,
      email: row.email,
      status: row.status,
      source: row.source,
      attributes: { ...pending, ...saved },
    },
  };
}

/**
 * Builds everything one agent-driven turn needs (published agent, runtime context, history).
 * Returns null when the chatbot has no published agent, so callers keep the legacy path.
 */
export async function prepareAgentTurn(p: {
  companyId: string;
  chatbotId: string;
  conversationId: string;
  message: string;
  channel: 'web' | 'whatsapp';
  language?: string;
  /** Streaming callers retrieve first and generate themselves. */
  skipGeneration?: boolean;
}): Promise<PreparedAgentTurn | null> {
  const agent = await agentsService.loadForChatbot(p.companyId, p.chatbotId);
  if (!agent) return null;

  const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, p.companyId));
  const [project, leadCtx, history] = await Promise.all([
    resolveMediaProject(p.companyId, p.chatbotId, p.message),
    loadLeadContext(p.conversationId),
    loadConversationHistory(p.conversationId, p.message),
  ]);

  const ctx: RuntimeContext = {
    botName: agent.agentName,
    companyName: company?.name ?? 'our team',
    projectName: project?.name,
    projectLocation: project?.location,
    visitorLanguage: p.language,
    lead: leadCtx.lead,
    visitorMessage: p.message,
    liveFacts: await liveInventoryFacts(p.companyId, p.message),
  };
  const options = agentsService.toRetrievalOptions(agent, ctx, {
    history,
    skipGeneration: p.skipGeneration,
    trace: { agentId: agent.agentId, agentVersionId: agent.versionId, conversationId: p.conversationId, channel: p.channel, purpose: 'chat' },
  });
  return { agent, options, history };
}

// ---------------------------------------------------------------- attribute collection (agent form)

export type AttributeExtractor = (input: {
  companyId: string;
  agentId: string;
  fields: FormFieldItem[];
  transcript: string;
  known: Record<string, unknown>;
}) => Promise<Record<string, unknown>>;

const GEMINI_EXTRACTION_MODEL = 'gemini-3.1-flash-lite';

/** Default extractor: one small structured-JSON Gemini call over the recent transcript. */
const geminiExtractor: AttributeExtractor = async ({ companyId, agentId, fields, transcript, known }) => {
  if (!modelRouter.isConfigured()) return {};
  const spec = fields
    .map(f => `- ${f.key} (${f.type}${f.options.length ? `, one of: ${f.options.join(' | ')}` : ''}): ${f.label}${f.aiHint ? `. ${f.aiHint}` : ''}`)
    .join('\n');
  const res = await modelRouter.executeCompletion({
    tier: TaskTier.FAST,
    companyId,
    chatbotId: '',
    trace: { agentId, purpose: 'extraction' },
    systemPrompt:
      'Extract buyer details that the VISITOR explicitly stated in the conversation. Return ONLY a JSON object using the keys listed below. ' +
      'Omit a key if the visitor did not clearly state it. Never guess. Numbers must be plain numbers (1 Cr = 10000000, 1 Lakh = 100000). ' +
      `Booleans are true/false. Dates are YYYY-MM-DD.\nKeys:\n${spec}\nAlready known (do not repeat unless corrected): ${JSON.stringify(known)}`,
    userMessage: transcript.slice(-4000),
    model: GEMINI_EXTRACTION_MODEL,
    temperature: 0,
    maxTokens: 300,
    promptName: 'attribute_extraction',
  });
  const match = /\{[\s\S]*\}/.exec(res.text);
  if (!match) return {};
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

let extractor: AttributeExtractor = geminiExtractor;
/** Test seam. */
export function setAttributeExtractor(fn: AttributeExtractor | null): void {
  extractor = fn ?? geminiExtractor;
}

/**
 * After a turn: pull attribute values the visitor just stated, validate them against the agent's form and
 * store them on the lead (or on the conversation until a lead exists). Never throws and never delays the reply.
 */
export async function collectAttributes(p: {
  companyId: string;
  conversationId: string;
  agent: LoadedAgent;
  history: ChatHistory;
  message: string;
}): Promise<Record<string, unknown>> {
  try {
    const fields = p.agent.formFields.filter(f => f.collectInChat);
    if (!p.agent.formId || fields.length === 0 || p.message.trim().length < 2) return {};

    const { leadId, pending, lead } = await loadLeadContext(p.conversationId);
    const known = lead?.attributes ?? {};
    const open = fields.filter(f => known[f.key] === undefined || known[f.key] === '');
    if (open.length === 0) return {};

    const transcript = [...p.history.slice(-6), { role: 'visitor' as const, content: p.message }]
      .map(t => `${t.role === 'visitor' ? 'Visitor' : 'Assistant'}: ${t.content}`)
      .join('\n');
    const raw = await extractor({ companyId: p.companyId, agentId: p.agent.agentId, fields: open, transcript, known });
    const { values } = validateFormValues(open as FieldDef[], raw, { partial: true });
    if (Object.keys(values).length === 0) return {};

    if (leadId) {
      await formsService.applyToLead({
        companyId: p.companyId,
        formId: p.agent.formId,
        leadId,
        values,
        conversationId: p.conversationId,
        agentId: p.agent.agentId,
        source: 'chat',
      });
    } else {
      await db
        .update(conversations)
        .set({ metadata: await mergeConversationMetadata(p.conversationId, { collectedAttributes: { ...pending, ...values } }) })
        .where(eq(conversations.id, p.conversationId));
    }
    return values;
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : err }, 'Attribute collection failed');
    return {};
  }
}

async function mergeConversationMetadata(conversationId: string, patch: Record<string, unknown>) {
  const [c] = await db.select({ metadata: conversations.metadata }).from(conversations).where(eq(conversations.id, conversationId));
  return { ...((c?.metadata as Record<string, unknown>) ?? {}), ...patch };
}

/** When a lead is created from a chat, attach the attributes gathered before the visitor shared contact details. */
export async function applyPendingAttributes(companyId: string, conversationId: string, leadId: string, chatbotId: string): Promise<void> {
  try {
    const [conv] = await db.select({ metadata: conversations.metadata }).from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.companyId, companyId)));
    const pending = ((conv?.metadata as Record<string, unknown> | undefined)?.collectedAttributes ?? {}) as Record<string, unknown>;
    if (Object.keys(pending).length === 0) return;
    const agent = await agentsService.loadForChatbot(companyId, chatbotId);
    if (!agent?.formId) return;
    await formsService.applyToLead({ companyId, formId: agent.formId, leadId, values: pending, conversationId, agentId: agent.agentId, source: 'chat' });
    const rest = { ...((conv?.metadata as Record<string, unknown>) ?? {}) };
    delete rest.collectedAttributes;
    await db.update(conversations).set({ metadata: rest }).where(eq(conversations.id, conversationId));
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : err }, 'Applying pending attributes failed');
  }
}
