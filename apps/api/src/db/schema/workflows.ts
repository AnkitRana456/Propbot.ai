import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { users } from './users.js';

export const workflows = pgTable(
  'workflows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 50 }).notNull().default('draft'), // draft, active, paused, archived
    version: integer('version').notNull().default(1),
    definition: jsonb('definition').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('workflows_company_idx').on(table.companyId),
    index('workflows_status_idx').on(table.companyId, table.status),
  ],
);

export const workflowRuns = pgTable(
  'workflow_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    eventId: text('event_id'),
    status: varchar('status', { length: 50 }).notNull().default('running'), // running, completed, failed, paused, cancelled, waiting_approval
    currentNodeId: varchar('current_node_id', { length: 100 }),
    context: jsonb('context').notNull().default({}),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('workflow_runs_company_idx').on(table.companyId),
    index('workflow_runs_workflow_idx').on(table.workflowId),
    index('workflow_runs_status_idx').on(table.companyId, table.status),
  ],
);

export const workflowRunSteps = pgTable(
  'workflow_run_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    runId: uuid('run_id')
      .notNull()
      .references(() => workflowRuns.id, { onDelete: 'cascade' }),
    nodeId: varchar('node_id', { length: 100 }).notNull(),
    nodeType: varchar('node_type', { length: 50 }).notNull(),
    actionType: varchar('action_type', { length: 100 }),
    status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, completed, failed, waiting_approval, skipped
    input: jsonb('input'),
    output: jsonb('output'),
    error: text('error'),
    durationMs: integer('duration_ms').default(0),
    executedAt: timestamp('executed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('workflow_run_steps_run_idx').on(table.runId),
    index('workflow_run_steps_company_idx').on(table.companyId),
  ],
);
