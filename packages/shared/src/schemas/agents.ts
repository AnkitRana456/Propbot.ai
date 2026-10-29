import { z } from 'zod';
import { GEMINI_MODELS } from '../constants/models.js';

// ------------------------------------------------------------------ Forms
export const formFieldTypeSchema = z.enum([
  'text',
  'longtext',
  'number',
  'currency',
  'select',
  'multiselect',
  'boolean',
  'date',
  'phone',
  'email',
  'url',
]);
export type FormFieldType = z.infer<typeof formFieldTypeSchema>;

export const formPurposeSchema = z.enum(['lead_attributes', 'agent_input', 'survey', 'task']);
export type FormPurpose = z.infer<typeof formPurposeSchema>;

const KEY_RE = /^[a-z][a-z0-9_]{1,59}$/;

export const fieldValidationSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(1).max(5000).optional(),
    /** Regex source (no flags). Evaluated against string values. */
    pattern: z.string().max(200).optional(),
  })
  .default({});

export const formFieldInputSchema = z.object({
  key: z.string().regex(KEY_RE, 'Use lowercase letters, numbers and underscores (2-60 chars), starting with a letter'),
  label: z.string().min(1).max(150),
  type: formFieldTypeSchema,
  required: z.boolean().default(false),
  options: z.array(z.string().min(1).max(100)).max(50).default([]),
  validation: fieldValidationSchema,
  defaultValue: z.unknown().optional(),
  helpText: z.string().max(500).optional().nullable(),
  /** How the assistant should ask for the value in chat. */
  aiHint: z.string().max(500).optional().nullable(),
  collectInChat: z.boolean().default(true),
  position: z.number().int().min(0).default(0),
});
export type FormFieldInput = z.infer<typeof formFieldInputSchema>;

export const createFormSchema = z.object({
  key: z.string().regex(KEY_RE),
  name: z.string().min(2).max(150),
  description: z.string().max(1000).optional().nullable(),
  purpose: formPurposeSchema.default('lead_attributes'),
  fields: z.array(formFieldInputSchema).max(60).default([]),
});
export type CreateFormInput = z.infer<typeof createFormSchema>;

export const updateFormSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  description: z.string().max(1000).optional().nullable(),
  purpose: formPurposeSchema.optional(),
  /** When present, replaces the whole field list (order = array order). */
  fields: z.array(formFieldInputSchema).max(60).optional(),
});
export type UpdateFormInput = z.infer<typeof updateFormSchema>;

export interface FormFieldItem extends FormFieldInput {
  id: string;
}
export interface FormItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  purpose: FormPurpose;
  isSystem: boolean;
  fields: FormFieldItem[];
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------------ Agents
export const agentPromptSchema = z
  .object({
    jobDescription: z.string().max(4000).default(''),
    character: z.string().max(4000).default(''),
    informationToCollect: z.string().max(4000).default(''),
    tone: z.string().max(2000).default(''),
    style: z.string().max(2000).default(''),
    extra: z.string().max(4000).default(''),
  })
  .default({});
export type AgentPrompt = z.infer<typeof agentPromptSchema>;

export const VARIABLE_SOURCES = [
  'static',
  'lead.name',
  'lead.phone',
  'lead.email',
  'lead.status',
  'lead.source',
  'project.name',
  'project.location',
  'chatbot.name',
  'company.name',
  'visitor.language',
] as const;

export const agentVariableSchema = z.object({
  key: z.string().regex(KEY_RE),
  label: z.string().max(150).default(''),
  defaultValue: z.string().max(500).default(''),
  /** `static`, a built-in path, or `attribute:<form field key>` for a lead attribute. */
  source: z
    .string()
    .refine(v => (VARIABLE_SOURCES as readonly string[]).includes(v) || /^attribute:[a-z][a-z0-9_]{1,59}$/.test(v), 'Unknown variable source')
    .default('static'),
});
export type AgentVariable = z.infer<typeof agentVariableSchema>;

export const conditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'greater_than',
  'less_than',
  'is_set',
  'is_empty',
]);
export type ConditionOperator = z.infer<typeof conditionOperatorSchema>;

export const agentConditionSchema = z.object({
  id: z.string().min(1).max(60),
  /** A variable key (e.g. `lead_status`) or the special field `visitor.message`. */
  field: z.string().min(1).max(80),
  operator: conditionOperatorSchema,
  value: z.string().max(500).default(''),
  /** Added to the prompt when the condition is true. */
  appendPrompt: z.string().min(1).max(2000),
});
export type AgentCondition = z.infer<typeof agentConditionSchema>;

export const agentKnowledgeSchema = z
  .object({
    sourceIds: z.array(z.string().uuid()).max(100).default([]),
    referenceIds: z.array(z.string().uuid()).max(50).default([]),
  })
  .default({});

export const agentFlagsSchema = z
  .object({
    oneQuestionPerMessage: z.boolean().default(true),
    splitLongAnswers: z.boolean().default(false),
    replyInVisitorLanguage: z.boolean().default(true),
    /** Soft cap on answer length. */
    maxSentences: z.number().int().min(1).max(12).default(4),
  })
  .default({});
export type AgentFlags = z.infer<typeof agentFlagsSchema>;

const modelIdSchema = z.string().refine(id => GEMINI_MODELS.some(m => m.id === id), 'Unknown model');

export const agentVersionContentSchema = z.object({
  prompt: agentPromptSchema,
  variables: z.array(agentVariableSchema).max(30).default([]),
  conditions: z.array(agentConditionSchema).max(20).default([]),
  knowledge: agentKnowledgeSchema,
  formId: z.string().uuid().nullable().optional(),
  model: modelIdSchema.default('gemini-2.0-flash'),
  temperature: z.number().min(0).max(1).default(0.7),
  maxOutputTokens: z.number().int().min(100).max(2000).default(600),
  flags: agentFlagsSchema,
});
export type AgentVersionContent = z.infer<typeof agentVersionContentSchema>;

export const createAgentSchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(1000).optional().nullable(),
  tags: z.array(z.string().min(1).max(40)).max(10).default([]),
  /** Preset id from GET /api/agents/templates; omit for a blank agent. */
  template: z.string().max(50).optional(),
});
export type CreateAgentInput = z.infer<typeof createAgentSchema>;

export const updateAgentSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  description: z.string().max(1000).optional().nullable(),
  tags: z.array(z.string().min(1).max(40)).max(10).optional(),
  status: z.enum(['active', 'archived']).optional(),
});
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

export const saveDraftSchema = agentVersionContentSchema.partial().extend({
  changeNote: z.string().max(500).optional().nullable(),
});
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

export const testAgentSchema = z.object({
  /** Which version to run; defaults to the newest version. */
  versionId: z.string().uuid().optional(),
  /** Chatbot whose knowledge to use; defaults to the chatbot using this agent, else the company's first chatbot. */
  chatbotId: z.string().uuid().optional(),
  /** Conversation so far; the last item must be the visitor message. */
  messages: z
    .array(z.object({ role: z.enum(['visitor', 'assistant']), content: z.string().min(1).max(2000) }))
    .min(1)
    .max(20),
  /** Values for `{{variables}}`, as they would come from the lead. */
  variables: z.record(z.string().max(500)).default({}),
});
export type TestAgentInput = z.infer<typeof testAgentSchema>;

export const compareAgentSchema = z.object({
  chatbotId: z.string().uuid().optional(),
  versionA: z.string().uuid(),
  versionB: z.string().uuid(),
  /** Visitor messages to replay one by one against both versions. */
  messages: z.array(z.string().min(1).max(2000)).min(1).max(8),
  variables: z.record(z.string().max(500)).default({}),
});
export type CompareAgentInput = z.infer<typeof compareAgentSchema>;

export const testCaseSchema = z.object({
  name: z.string().min(2).max(150),
  messages: z.array(z.string().min(1).max(2000)).min(1).max(8),
  notes: z.string().max(1000).optional().nullable(),
});
export type TestCaseInput = z.infer<typeof testCaseSchema>;

export const knowledgeReferenceInputSchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(1000).optional().nullable(),
  sourceIds: z.array(z.string().uuid()).max(100).default([]),
});
export type KnowledgeReferenceInput = z.infer<typeof knowledgeReferenceInputSchema>;

export interface AgentVersionItem extends AgentVersionContent {
  id: string;
  agentId: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  changeNote: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface AgentItem {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  template: string | null;
  status: 'active' | 'archived';
  activeVersionId: string | null;
  activeVersion: number | null;
  latestVersion: number;
  hasUnpublishedDraft: boolean;
  chatbotCount: number;
  createdAt: string;
  updatedAt: string;
}
