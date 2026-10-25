import { pgTable, uuid, varchar, text, integer, boolean, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';
import { users } from './users.js';
import { contacts } from './contacts.js';
import { chatbots } from './chatbots.js';
import { conversations } from './conversations.js';
import { leads } from './leads.js';
import { forms } from './agents.js';

/** One person across channels: wa_id, Instagram IGSID, Messenger PSID, e-mail address (migration 0020). */
export const contactIdentities = pgTable(
  'contact_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 30 }).notNull(),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    handle: varchar('handle', { length: 255 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [uniqueIndex('contact_identities_channel_ext_uniq').on(t.companyId, t.channel, t.externalId)],
);

export const channelConnections = pgTable(
  'channel_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 30 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    externalAccountId: varchar('external_account_id', { length: 255 }),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    secrets: jsonb('secrets').$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    chatbotId: uuid('chatbot_id').references(() => chatbots.id, { onDelete: 'set null' }),
    lastError: text('last_error'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('channel_connections_company_idx').on(t.companyId, t.channel)],
);

export const leadSources = pgTable('lead_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  sourceType: varchar('source_type', { length: 30 }).notNull().default('generic'),
  apiKeyPrefix: varchar('api_key_prefix', { length: 16 }).notNull(),
  apiKeyHash: varchar('api_key_hash', { length: 128 }).notNull(),
  fieldMapping: jsonb('field_mapping').$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
  chatbotId: uuid('chatbot_id').references(() => chatbots.id, { onDelete: 'set null' }),
  formId: uuid('form_id').references(() => forms.id, { onDelete: 'set null' }),
  attribution: jsonb('attribution').$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
  isActive: boolean('is_active').notNull().default(true),
  kioskToken: varchar('kiosk_token', { length: 64 }),
  totalReceived: integer('total_received').notNull().default(0),
  lastReceivedAt: timestamp('last_received_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const leadSourceEvents = pgTable(
  'lead_source_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    leadSourceId: uuid('lead_source_id').notNull().references(() => leadSources.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').$type<unknown>().notNull(),
    status: varchar('status', { length: 20 }).notNull().default('received'),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('lead_source_events_source_created_idx').on(t.leadSourceId, t.createdAt)],
);

export const conversationNotes = pgTable('conversation_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  body: text('body').notNull(),
  mentions: uuid('mentions').array().notNull().default(sql`ARRAY[]::uuid[]`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messageTemplates = pgTable('message_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  channel: varchar('channel', { length: 30 }).notNull().default('whatsapp'),
  name: varchar('name', { length: 120 }).notNull(),
  language: varchar('language', { length: 12 }).notNull().default('en'),
  category: varchar('category', { length: 20 }).notNull().default('utility'),
  components: jsonb('components').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  sampleValues: jsonb('sample_values').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  providerTemplateId: varchar('provider_template_id', { length: 120 }),
  rejectionReason: text('rejection_reason'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const widgets = pgTable('widgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  chatbotId: uuid('chatbot_id').references(() => chatbots.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 150 }).notNull(),
  allowedDomains: text('allowed_domains').array().notNull().default(sql`ARRAY[]::text[]`),
  styling: jsonb('styling').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  sections: jsonb('sections').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  nudges: jsonb('nudges').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
