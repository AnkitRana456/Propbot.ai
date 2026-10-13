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
import { chatbots } from './chatbots.js';
import { leads } from './leads.js';

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull().default('Webhook Endpoint'),
    chatbotId: uuid('chatbot_id').references(() => chatbots.id, { onDelete: 'set null' }),
    url: text('url').notNull(),
    secret: varchar('secret', { length: 255 }).notNull(),
    subscribedEvents: text('subscribed_events')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    headers: jsonb('headers')
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    payloadTemplate: text('payload_template'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index('webhook_endpoints_company_idx').on(table.companyId)],
);

export const webhookLogs = pgTable(
  'webhook_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    leadName: varchar('lead_name', { length: 255 }),
    chatbotId: uuid('chatbot_id').references(() => chatbots.id, { onDelete: 'set null' }),
    eventId: varchar('event_id', { length: 100 }),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).notNull(), // success | retrying | failed | dead_letter
    statusCode: integer('status_code'),
    attempt: integer('attempt').notNull().default(1),
    maxAttempts: integer('max_attempts').notNull().default(3),
    requestPayload: jsonb('request_payload').notNull(),
    requestHeaders: jsonb('request_headers')
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    responseBody: text('response_body'),
    responseHeaders: jsonb('response_headers')
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    durationMs: integer('duration_ms'),
    errorMessage: text('error_message'),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('webhook_logs_endpoint_created_idx').on(table.endpointId, table.createdAt),
    index('webhook_logs_company_idx').on(table.companyId),
    index('webhook_logs_status_idx').on(table.companyId, table.status),
    index('webhook_logs_lead_idx').on(table.companyId, table.leadId),
  ],
);

export const integrations = pgTable(
  'integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull(), // google_sheets | hubspot | zoho | generic_rest | meta_pixel | google_ads
    status: varchar('status', { length: 50 }).notNull().default('active'),
    config: jsonb('config')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    events: text('events')
      .array()
      .notNull()
      .default(sql`ARRAY['lead_captured']::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('integrations_company_idx').on(table.companyId),
    index('integrations_company_provider_idx').on(table.companyId, table.provider),
  ],
);
