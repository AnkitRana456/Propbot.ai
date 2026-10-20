import { pgTable, uuid, varchar, text, integer, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';
import { users } from './users.js';
import { agents } from './agents.js';
import { conversations } from './conversations.js';

/** Reusable GPT / API tools (migration 0020). type: gpt | api. */
export const tools = pgTable(
  'tools',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 80 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    type: varchar('type', { length: 20 }).notNull(),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    inputSchema: jsonb('input_schema').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    outputSchema: jsonb('output_schema').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    secretRef: varchar('secret_ref', { length: 120 }),
    requiresApproval: boolean('requires_approval').notNull().default(false),
    rateLimitPerMin: integer('rate_limit_per_min').notNull().default(30),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
);

export const toolRuns = pgTable(
  'tool_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    toolId: uuid('tool_id').references(() => tools.id, { onDelete: 'set null' }),
    agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
    flowExecutionId: uuid('flow_execution_id'),
    status: varchar('status', { length: 24 }).notNull().default('ok'),
    input: jsonb('input').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    output: jsonb('output').$type<unknown>(),
    error: text('error'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('tool_runs_tool_idx').on(t.toolId, t.createdAt)],
);
