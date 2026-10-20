import { pgTable, uuid, varchar, text, integer, boolean, jsonb, numeric, timestamp, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';
import { users } from './users.js';
import { contacts } from './contacts.js';
import { leads } from './leads.js';
import { chatbots } from './chatbots.js';
import { conversations } from './conversations.js';
import { appointments } from './appointments.js';
import { forms } from './agents.js';
import { segments } from './growth.js';

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 60 }).notNull(),
    color: varchar('color', { length: 9 }).notNull().default('#64748b'),
    entityType: varchar('entity_type', { length: 20 }).notNull().default('lead'),
    autoRule: jsonb('auto_rule').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

export const taggings = pgTable(
  'taggings',
  {
    tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    entityType: varchar('entity_type', { length: 20 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    source: varchar('source', { length: 12 }).notNull().default('manual'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [primaryKey({ columns: [t.tagId, t.entityType, t.entityId] }), index('taggings_entity_idx').on(t.companyId, t.entityType, t.entityId)],
);

export const segmentMembers = pgTable(
  'segment_members',
  {
    segmentId: uuid('segment_id').notNull().references(() => segments.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [primaryKey({ columns: [t.segmentId, t.contactId] })],
);

export const conversationInsights = pgTable(
  'conversation_insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    summary: text('summary'),
    intent: varchar('intent', { length: 40 }),
    labels: text('labels').array().notNull().default(sql`ARRAY[]::text[]`),
    sentiment: varchar('sentiment', { length: 12 }),
    sentimentScore: numeric('sentiment_score', { precision: 4, scale: 3 }),
    model: varchar('model', { length: 80 }),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [uniqueIndex('conversation_insights_conv_uniq').on(t.conversationId)],
);

export const surveys = pgTable('surveys', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  kind: varchar('kind', { length: 12 }).notNull().default('csat'),
  formId: uuid('form_id').references(() => forms.id, { onDelete: 'set null' }),
  trigger: jsonb('trigger').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  channel: varchar('channel', { length: 30 }).notNull().default('whatsapp'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const surveyResponses = pgTable(
  'survey_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    surveyId: uuid('survey_id').notNull().references(() => surveys.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
    appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
    score: integer('score'),
    isEstimated: boolean('is_estimated').notNull().default(false),
    answers: jsonb('answers').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('survey_responses_survey_idx').on(t.surveyId, t.createdAt)],
);

export const dashboards = pgTable('dashboards', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  description: text('description'),
  isShared: boolean('is_shared').notNull().default(false),
  isStarred: boolean('is_starred').notNull().default(false),
  schedule: jsonb('schedule').$type<Record<string, unknown> | null>(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const dashboardWidgets = pgTable(
  'dashboard_widgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dashboardId: uuid('dashboard_id').notNull().references(() => dashboards.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 20 }).notNull(),
    title: varchar('title', { length: 150 }).notNull(),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    layout: jsonb('layout').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('dashboard_widgets_dashboard_idx').on(t.dashboardId)],
);

export const boards = pgTable('boards', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  description: text('description'),
  formId: uuid('form_id').references(() => forms.id, { onDelete: 'set null' }),
  columns: jsonb('columns').$type<Array<{ key: string; label: string; color?: string }>>().notNull().default(sql`'[]'::jsonb`),
  tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const boardTasks = pgTable(
  'board_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    columnKey: varchar('column_key', { length: 60 }).notNull(),
    position: integer('position').notNull().default(0),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  t => [index('board_tasks_board_column_idx').on(t.boardId, t.columnKey, t.position)],
);

export const boardTaskComments = pgTable('board_task_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').notNull().references(() => boardTasks.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const kbTestRuns = pgTable(
  'kb_test_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    chatbotId: uuid('chatbot_id').references(() => chatbots.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    results: jsonb('results').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    bestScore: numeric('best_score', { precision: 5, scale: 4 }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('kb_test_runs_company_idx').on(t.companyId, t.createdAt)],
);
