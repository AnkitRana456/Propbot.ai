import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';
import { agents } from './agents.js';
import { leads } from './leads.js';
import { contacts } from './contacts.js';
import { users } from './users.js';
import { segments } from './growth.js';
import { voiceCalls } from './voice.js';

/** Voice persona on top of an agent "brain" (migration 0020). */
export const voiceAgents = pgTable('voice_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 150 }).notNull(),
  voice: jsonb('voice').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  greeting: text('greeting'),
  closing: text('closing'),
  escalationRules: jsonb('escalation_rules').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  recordingConsentScript: text('recording_consent_script'),
  maxCallSeconds: integer('max_call_seconds').notNull().default(600),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const phoneNumbers = pgTable(
  'phone_numbers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 30 }).notNull(),
    number: varchar('number', { length: 32 }).notNull(),
    voiceAgentId: uuid('voice_agent_id').references(() => voiceAgents.id, { onDelete: 'set null' }),
    direction: varchar('direction', { length: 12 }).notNull().default('both'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    providerRef: varchar('provider_ref', { length: 120 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [uniqueIndex('phone_numbers_number_uniq').on(t.provider, t.number)],
);

export const callEvents = pgTable(
  'call_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    callId: uuid('call_id').notNull().references(() => voiceCalls.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 30 }).notNull(),
    speaker: varchar('speaker', { length: 12 }),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    offsetMs: integer('offset_ms').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('call_events_call_idx').on(t.callId, t.offsetMs)],
);

export const callCampaigns = pgTable('call_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  voiceAgentId: uuid('voice_agent_id').notNull().references(() => voiceAgents.id, { onDelete: 'restrict' }),
  segmentId: uuid('segment_id').references(() => segments.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  callingWindow: jsonb('calling_window').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  retryPolicy: jsonb('retry_policy').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  concurrency: integer('concurrency').notNull().default(3),
  stats: jsonb('stats').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const callCampaignTargets = pgTable(
  'call_campaign_targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id').notNull().references(() => callCampaigns.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    phone: varchar('phone', { length: 32 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    outcome: varchar('outcome', { length: 30 }),
    callId: uuid('call_id').references(() => voiceCalls.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [uniqueIndex('call_campaign_targets_phone_uniq').on(t.campaignId, t.phone)],
);

export const dndNumbers = pgTable(
  'dnd_numbers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    phone: varchar('phone', { length: 32 }).notNull(),
    reason: varchar('reason', { length: 60 }).notNull().default('requested'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [uniqueIndex('dnd_numbers_company_phone_uniq').on(t.companyId, t.phone)],
);
