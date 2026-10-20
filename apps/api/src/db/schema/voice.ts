import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { leads } from './leads.js';
import { contacts } from './contacts.js';

export const voiceCalls = pgTable(
  'voice_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .references(() => leads.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .references(() => contacts.id, { onDelete: 'set null' }),
    callSid: varchar('call_sid', { length: 255 }).notNull(),
    direction: varchar('direction', { length: 50 }).notNull().default('outbound_callback'), // outbound_callback, outbound_manual, inbound
    fromNumber: varchar('from_number', { length: 50 }).notNull(),
    toNumber: varchar('to_number', { length: 50 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('initiated'), // initiated, ringing, in_progress, completed, failed, no_answer, busy
    durationSeconds: integer('duration_seconds').notNull().default(0),
    recordingUrl: text('recording_url'),
    transcript: text('transcript'),
    summary: text('summary'),
    sentiment: varchar('sentiment', { length: 50 }), // positive, neutral, negative
    buyerDnaExtracted: jsonb('buyer_dna_extracted').notNull().default({}),
    intentScoreDelta: integer('intent_score_delta').notNull().default(0),
    disclosedAsAi: boolean('disclosed_as_ai').notNull().default(true),
    escalatedToHuman: boolean('escalated_to_human').notNull().default(false),
    optedOut: boolean('opted_out').notNull().default(false),
    // Voice studio columns (migration 0020)
    voiceAgentId: uuid('voice_agent_id'),
    campaignId: uuid('campaign_id'),
    outcome: varchar('outcome', { length: 30 }),
    language: varchar('language', { length: 12 }),
    sentimentScore: numeric('sentiment_score', { precision: 4, scale: 3 }),
    recordingConsent: boolean('recording_consent'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('voice_calls_company_idx').on(table.companyId),
    index('voice_calls_lead_idx').on(table.companyId, table.leadId),
    index('voice_calls_sid_idx').on(table.callSid),
  ],
);
