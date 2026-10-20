import type { AgentCondition, AgentVariable, AgentVersionContent, FormFieldItem } from '@propbot/shared';

/** Facts the prompt can reference. Everything here is data, never instructions. */
export interface RuntimeContext {
  botName: string;
  companyName: string;
  projectName?: string;
  projectLocation?: string;
  visitorLanguage?: string;
  lead?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    status?: string | null;
    source?: string | null;
    /** Values already collected through the agent's form (leads.custom_fields.attributes). */
    attributes?: Record<string, unknown>;
  };
  /** Live inventory facts for this message (authoritative over the knowledge base). */
  liveFacts?: string | null;
  /** Explicit values for variables (agent test panel). Win over everything else. */
  overrides?: Record<string, string>;
  visitorMessage: string;
}

/**
 * Visitor- and CRM-controlled text is inserted into prompts, so it is flattened to one short line:
 * no line breaks (which could fake a new instruction block), no template braces, no control characters.
 */
export function sanitizeVariableValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\{\{|\}\}/g, '')
    .replace(/[`#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function sourceValue(source: string, ctx: RuntimeContext): string | undefined {
  switch (source) {
    case 'lead.name':
      return ctx.lead?.name ?? undefined;
    case 'lead.phone':
      return ctx.lead?.phone ?? undefined;
    case 'lead.email':
      return ctx.lead?.email ?? undefined;
    case 'lead.status':
      return ctx.lead?.status ?? undefined;
    case 'lead.source':
      return ctx.lead?.source ?? undefined;
    case 'project.name':
      return ctx.projectName;
    case 'project.location':
      return ctx.projectLocation;
    case 'chatbot.name':
      return ctx.botName;
    case 'company.name':
      return ctx.companyName;
    case 'visitor.language':
      return ctx.visitorLanguage;
    default:
      if (source.startsWith('attribute:')) {
        const v = ctx.lead?.attributes?.[source.slice('attribute:'.length)];
        return v === undefined ? undefined : sanitizeVariableValue(v);
      }
      return undefined;
  }
}

/** key -> sanitised value (explicit override > resolved source > default). */
export function resolveVariableValues(variables: AgentVariable[], ctx: RuntimeContext): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of variables) {
    const override = ctx.overrides?.[v.key];
    const resolved = v.source === 'static' ? undefined : sourceValue(v.source, ctx);
    const chosen = override ?? resolved;
    out[v.key] = sanitizeVariableValue(chosen !== undefined && chosen !== '' ? chosen : v.defaultValue);
  }
  return out;
}

/** Replaces `{{ key }}` placeholders; unknown placeholders become empty (never leak the braces to the model). */
export function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi, (_m, key: string) => values[key] ?? '');
}

export function evaluateCondition(cond: AgentCondition, values: Record<string, string>, visitorMessage: string): boolean {
  const actual = cond.field === 'visitor.message' ? visitorMessage : (values[cond.field] ?? '');
  const a = actual.toLowerCase();
  const b = cond.value.toLowerCase();
  switch (cond.operator) {
    case 'equals':
      return a === b;
    case 'not_equals':
      return a !== b;
    case 'contains':
      return b !== '' && a.includes(b);
    case 'not_contains':
      return !a.includes(b);
    case 'greater_than':
      return Number(actual) > Number(cond.value);
    case 'less_than':
      return Number(actual) < Number(cond.value);
    case 'is_set':
      return actual.trim() !== '';
    case 'is_empty':
      return actual.trim() === '';
    default:
      return false;
  }
}

const section = (title: string, body: string) => (body.trim() ? `${title}:\n${body.trim()}` : '');

function describeField(f: FormFieldItem): string {
  const choices = f.options.length ? ` (choices: ${f.options.join(' | ')})` : '';
  const hint = f.aiHint ? ` Hint: ${f.aiHint}` : '';
  return `- ${f.label} [${f.key}, ${f.type}${f.required ? ', required' : ''}]${choices}.${hint}`;
}

/**
 * Turns an agent version into the persona/behaviour block that is inserted into the system prompt.
 * The platform guardrails (answer only from verified knowledge, no invented prices, acknowledge & bridge)
 * are added separately and cannot be removed by an agent prompt.
 */
export function buildAgentInstructions(content: AgentVersionContent, formFields: FormFieldItem[], ctx: RuntimeContext): string {
  const values = resolveVariableValues(content.variables, ctx);
  const fill = (t: string) => interpolate(t, values);
  const p = content.prompt;
  const parts: string[] = [];

  parts.push(section('JOB', fill(p.jobDescription)));
  parts.push(section('CHARACTER', fill(p.character)));
  parts.push(section('TONE', fill(p.tone)));
  parts.push(section('STYLE & LANGUAGE', fill(p.style)));

  const rules: string[] = [];
  if (content.flags.replyInVisitorLanguage) rules.push('Reply in the same language the visitor writes in.');
  if (content.flags.oneQuestionPerMessage) rules.push('Ask at most ONE question per message.');
  rules.push(`Keep each answer to ${content.flags.maxSentences} sentences or fewer unless the visitor asks for detail.`);
  if (content.flags.splitLongAnswers) rules.push('If a longer answer is needed, split it into short paragraphs separated by a blank line.');
  parts.push(section('RESPONSE RULES', rules.map(r => `- ${r}`).join('\n')));

  const collectable = formFields.filter(f => f.collectInChat);
  const known = ctx.lead?.attributes ?? {};
  const knownLines = collectable
    .filter(f => known[f.key] !== undefined && known[f.key] !== '')
    .map(f => `- ${f.label}: ${sanitizeVariableValue(known[f.key])}`);
  const missing = collectable.filter(f => known[f.key] === undefined || known[f.key] === '');
  let collect = fill(p.informationToCollect);
  if (collectable.length > 0) {
    collect +=
      `\nGather these details through natural conversation, never as a questionnaire:\n${missing.map(describeField).join('\n') || '- (everything has been collected)'}` +
      (knownLines.length ? `\nAlready known (do not ask again):\n${knownLines.join('\n')}` : '');
  }
  parts.push(section('INFORMATION TO COLLECT', collect));

  parts.push(section('ADDITIONAL INSTRUCTIONS', fill(p.extra)));

  for (const cond of content.conditions) {
    if (evaluateCondition(cond, values, ctx.visitorMessage)) parts.push(section('SITUATION-SPECIFIC INSTRUCTION', fill(cond.appendPrompt)));
  }

  if (ctx.liveFacts) parts.push(section('LIVE INVENTORY (authoritative)', ctx.liveFacts));

  return parts.filter(Boolean).join('\n\n');
}
