import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  numeric,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';
import { users } from './users.js';
import { leads } from './leads.js';
import { conversations } from './conversations.js';
import { chatbots } from './chatbots.js';
import { knowledgeSources } from './knowledge.js';

// ------------------------------------------------------------------ forms
export const forms = pgTable(
  'forms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 80 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    purpose: varchar('purpose', { length: 30 }).notNull().default('lead_attributes'),
    isSystem: boolean('is_system').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  t => [uniqueIndex('forms_company_key_uniq').on(t.companyId, t.key).where(sql`${t.deletedAt} IS NULL`)],
);

export const formFields = pgTable(
  'form_fields',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 80 }).notNull(),
    label: varchar('label', { length: 150 }).notNull(),
    type: varchar('type', { length: 30 }).notNull(),
    required: boolean('required').notNull().default(false),
    options: jsonb('options')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    validation: jsonb('validation')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    defaultValue: jsonb('default_value'),
    helpText: text('help_text'),
    aiHint: text('ai_hint'),
    collectInChat: boolean('collect_in_chat').notNull().default(true),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [
    uniqueIndex('form_fields_form_key_uniq').on(t.formId, t.key),
    index('form_fields_company_idx').on(t.companyId),
  ],
);

// ------------------------------------------------------------------ agents
export const agents = pgTable(
  'agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    template: varchar('template', { length: 50 }),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    activeVersionId: uuid('active_version_id'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  t => [
    uniqueIndex('agents_company_name_uniq')
      .on(t.companyId, sql`lower(${t.name})`)
      .where(sql`${t.deletedAt} IS NULL`),
    index('agents_company_idx').on(t.companyId),
  ],
);

export const agentVersions = pgTable(
  'agent_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    prompt: jsonb('prompt')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    variables: jsonb('variables')
      .$type<unknown[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    conditions: jsonb('conditions')
      .$type<unknown[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    knowledge: jsonb('knowledge')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    formId: uuid('form_id').references(() => forms.id, { onDelete: 'set null' }),
    model: varchar('model', { length: 80 }).notNull().default('gemini-2.0-flash'),
    temperature: numeric('temperature', { precision: 3, scale: 2 }).notNull().default('0.70'),
    maxOutputTokens: integer('max_output_tokens').notNull().default(600),
    flags: jsonb('flags')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    changeNote: text('change_note'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  t => [
    uniqueIndex('agent_versions_agent_version_uniq').on(t.agentId, t.version),
    index('agent_versions_company_idx').on(t.companyId),
  ],
);

export const agentTestCases = pgTable(
  'agent_test_cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    messages: jsonb('messages')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('agent_test_cases_agent_idx').on(t.agentId)],
);

// ------------------------------------------------------------------ submissions
export const formSubmissions = pgTable(
  'form_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
    agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    values: jsonb('values')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    source: varchar('source', { length: 30 }).notNull().default('chat'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [
    index('form_submissions_company_lead_idx').on(t.companyId, t.leadId),
    index('form_submissions_form_created_idx').on(t.formId, t.createdAt),
  ],
);

// ------------------------------------------------------------------ knowledge references
export const knowledgeReferences = pgTable(
  'knowledge_references',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  t => [
    uniqueIndex('knowledge_references_company_name_uniq')
      .on(t.companyId, sql`lower(${t.name})`)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const knowledgeReferenceSources = pgTable(
  'knowledge_reference_sources',
  {
    referenceId: uuid('reference_id')
      .notNull()
      .references(() => knowledgeReferences.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => knowledgeSources.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
  },
  t => [
    primaryKey({ columns: [t.referenceId, t.sourceId] }),
    index('knowledge_reference_sources_source_idx').on(t.sourceId),
  ],
);

// ------------------------------------------------------------------ llm call log
export const llmCalls = pgTable(
  'llm_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    chatbotId: uuid('chatbot_id').references(() => chatbots.id, { onDelete: 'set null' }),
    agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    agentVersionId: uuid('agent_version_id').references(() => agentVersions.id, { onDelete: 'set null' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
    channel: varchar('channel', { length: 30 }),
    purpose: varchar('purpose', { length: 30 }).notNull().default('chat'),
    model: varchar('model', { length: 80 }),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    latencyMs: integer('latency_ms'),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }).notNull().default('0'),
    status: varchar('status', { length: 20 }).notNull().default('ok'),
    errorKind: varchar('error_kind', { length: 40 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [
    index('llm_calls_company_created_idx').on(t.companyId, t.createdAt),
    index('llm_calls_agent_created_idx').on(t.agentId, t.createdAt),
    index('llm_calls_conversation_idx').on(t.conversationId),
  ],
);
