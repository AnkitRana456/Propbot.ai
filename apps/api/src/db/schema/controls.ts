import { pgTable, uuid, varchar, text, boolean, jsonb, numeric, timestamp, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies, apiKeys } from './companies.js';
import { users } from './users.js';
import { contacts } from './contacts.js';

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  leadUserId: uuid('lead_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const teamMembers = pgTable(
  'team_members',
  {
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  },
  t => [primaryKey({ columns: [t.teamId, t.userId] })],
);

export const policies = pgTable('policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  rules: jsonb('rules').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  isSystem: boolean('is_system').notNull().default(false),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const policyAssignments = pgTable(
  'policy_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    policyId: uuid('policy_id').notNull().references(() => policies.id, { onDelete: 'cascade' }),
    subjectType: varchar('subject_type', { length: 12 }).notNull(),
    subjectId: varchar('subject_id', { length: 80 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [uniqueIndex('policy_assignments_uniq').on(t.policyId, t.subjectType, t.subjectId), index('policy_assignments_subject_idx').on(t.companyId, t.subjectType, t.subjectId)],
);

export const policyChanges = pgTable('policy_changes', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  policyId: uuid('policy_id').references(() => policies.id, { onDelete: 'set null' }),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 30 }).notNull(),
  change: jsonb('change').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accessLogs = pgTable(
  'access_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 30 }).notNull(),
    resourceType: varchar('resource_type', { length: 40 }).notNull(),
    resourceId: varchar('resource_id', { length: 80 }),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 300 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('access_logs_company_created_idx').on(t.companyId, t.createdAt), index('access_logs_user_idx').on(t.userId, t.createdAt)],
);

export const notificationRules = pgTable('notification_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 60 }).notNull(),
  channels: text('channels').array().notNull().default(sql`ARRAY['in_app']::text[]`),
  conditions: jsonb('conditions').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const usageLedger = pgTable(
  'usage_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 30 }).notNull(),
    channel: varchar('channel', { length: 30 }),
    quantity: numeric('quantity', { precision: 16, scale: 4 }).notNull(),
    unit: varchar('unit', { length: 20 }).notNull(),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }).notNull().default('0'),
    refType: varchar('ref_type', { length: 30 }),
    refId: uuid('ref_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('usage_ledger_kind_idx').on(t.companyId, t.kind, t.occurredAt)],
);

export const consentRecords = pgTable(
  'consent_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 30 }).notNull(),
    purpose: varchar('purpose', { length: 40 }).notNull(),
    granted: boolean('granted').notNull(),
    source: varchar('source', { length: 40 }).notNull().default('chat'),
    evidence: jsonb('evidence').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('consent_records_contact_idx').on(t.companyId, t.contactId, t.channel, t.purpose, t.createdAt)],
);

export const dataRequests = pgTable('data_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 12 }).notNull(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  subjectLabel: varchar('subject_label', { length: 255 }),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
  resultRef: text('result_ref'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

/** Platform-wide product changelog (not tenant data). */
export const changelogEntries = pgTable('changelog_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  bodyMd: text('body_md').notNull(),
  category: varchar('category', { length: 30 }).notNull().default('feature'),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
});
