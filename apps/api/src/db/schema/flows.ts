import { pgTable, uuid, varchar, text, integer, boolean, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { FlowGraph, FlowSettings } from '@propbot/shared';
import { companies } from './companies.js';
import { users } from './users.js';
import { leads } from './leads.js';
import { contacts } from './contacts.js';
import { conversations } from './conversations.js';

/** Visual automation flows (migration 0020). */
export const flows = pgTable(
  'flows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),
    template: varchar('template', { length: 60 }),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    activeVersionId: uuid('active_version_id'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
);

export const flowVersions = pgTable(
  'flow_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    flowId: uuid('flow_id').notNull().references(() => flows.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    graph: jsonb('graph').$type<FlowGraph>().notNull().default(sql`'{"nodes":[],"edges":[]}'::jsonb`),
    settings: jsonb('settings').$type<FlowSettings>().notNull().default(sql`'{}'::jsonb`),
    changeNote: text('change_note'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  t => [uniqueIndex('flow_versions_flow_version_uniq').on(t.flowId, t.version)],
);

export const flowTriggers = pgTable(
  'flow_triggers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    flowId: uuid('flow_id').notNull().references(() => flows.id, { onDelete: 'cascade' }),
    flowVersionId: uuid('flow_version_id').notNull().references(() => flowVersions.id, { onDelete: 'cascade' }),
    nodeId: varchar('node_id', { length: 80 }).notNull(),
    triggerType: varchar('trigger_type', { length: 40 }).notNull(),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    channel: varchar('channel', { length: 30 }),
    isActive: boolean('is_active').notNull().default(true),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

export const flowExecutions = pgTable(
  'flow_executions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    flowId: uuid('flow_id').notNull().references(() => flows.id, { onDelete: 'cascade' }),
    flowVersionId: uuid('flow_version_id').notNull().references(() => flowVersions.id, { onDelete: 'cascade' }),
    triggerType: varchar('trigger_type', { length: 40 }).notNull(),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 20 }).notNull().default('running'),
    variables: jsonb('variables').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    currentNode: varchar('current_node', { length: 80 }),
    resumeAt: timestamp('resume_at', { withTimezone: true }),
    isTest: boolean('is_test').notNull().default(false),
    error: text('error'),
    totalTokens: integer('total_tokens').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  t => [index('flow_executions_flow_idx').on(t.flowId, t.startedAt)],
);

export const flowStepRuns = pgTable(
  'flow_step_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    executionId: uuid('execution_id').notNull().references(() => flowExecutions.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    nodeId: varchar('node_id', { length: 80 }).notNull(),
    nodeType: varchar('node_type', { length: 40 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('ok'),
    input: jsonb('input').$type<unknown>(),
    output: jsonb('output').$type<unknown>(),
    error: text('error'),
    tokens: integer('tokens').notNull().default(0),
    durationMs: integer('duration_ms'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  t => [index('flow_step_runs_execution_idx').on(t.executionId, t.startedAt)],
);
