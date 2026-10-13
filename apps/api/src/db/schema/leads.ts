import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';
import { contacts } from './contacts.js';
import { chatbots } from './chatbots.js';
import { users } from './users.js';

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'restrict' }),
    chatbotId: uuid('chatbot_id').references(() => chatbots.id, { onDelete: 'set null' }),
    assignedAgentId: uuid('assigned_agent_id').references(() => users.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 50 }).notNull().default('new'),
    lostReason: text('lost_reason'),
    priority: varchar('priority', { length: 50 }).notNull().default('medium'),
    intentScore: integer('intent_score').notNull().default(0),
    intentLabel: varchar('intent_label', { length: 50 }).notNull().default('cold'),
    buyerDna: jsonb('buyer_dna')
      .notNull()
      .default(sql`'{}'::jsonb`),
    scoreExplanation: jsonb('score_explanation')
      .notNull()
      .default(sql`'[]'::jsonb`),
    scoreHistory: jsonb('score_history')
      .notNull()
      .default(sql`'[]'::jsonb`),
    handoffBrief: jsonb('handoff_brief'),
    nextBestAction: jsonb('next_best_action'),
    duplicateMergeSuggestion: jsonb('duplicate_merge_suggestion'),
    customFields: jsonb('custom_fields')
      .notNull()
      .default(sql`'{}'::jsonb`),
    phoneVerified: boolean('phone_verified').notNull().default(false),
    tags: jsonb('tags')
      .notNull()
      .default(sql`'[]'::jsonb`),
    pageUrl: varchar('page_url', { length: 500 }),
    nextFollowUpAt: timestamp('next_follow_up_at', { withTimezone: true }),
    source: varchar('source', { length: 100 }).notNull().default('chat'),
    slaStartedAt: timestamp('sla_started_at', { withTimezone: true }),
    slaBreachedAt: timestamp('sla_breached_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  table => [
    index('leads_company_status_priority_idx').on(table.companyId, table.status, table.priority),
    index('leads_company_intent_idx').on(table.companyId, table.intentScore),
    index('leads_company_contact_idx').on(table.companyId, table.contactId),
    index('leads_company_next_follow_up_idx').on(table.companyId, table.nextFollowUpAt),
    index('leads_company_assigned_status_idx').on(table.companyId, table.assignedAgentId, table.status),
  ],
);

export const leadActivities = pgTable(
  'lead_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    activityType: varchar('activity_type', { length: 100 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('lead_activities_lead_created_idx').on(table.leadId, table.createdAt),
    index('lead_activities_company_idx').on(table.companyId),
  ],
);

export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  table => [
    index('notes_lead_idx').on(table.leadId),
    index('notes_company_idx').on(table.companyId),
  ],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    assignedUserId: uuid('assigned_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 255 }).notNull(),
    type: varchar('type', { length: 50 }).notNull().default('follow_up'),
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    priority: varchar('priority', { length: 50 }).notNull().default('medium'),
    description: text('description'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('tasks_company_user_status_due_idx').on(
      table.companyId,
      table.assignedUserId,
      table.status,
      table.dueDate,
    ),
    index('tasks_lead_status_due_idx').on(table.leadId, table.status, table.dueDate),
  ],
);
