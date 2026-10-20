import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';
import { leads } from './leads.js';

/**
 * Durable queue for lead e-mail alerts and CRM sync (migration 0017).
 * kind: lead_email_alert | crm_sync    provider: smtp | hubspot | salesforce | mailchimp
 * status: pending | success | skipped | dead_letter
 */
export const deliveryJobs = pgTable(
  'delivery_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 30 }).notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    eventId: uuid('event_id'),
    payload: jsonb('payload')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(4),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    lastError: text('last_error'),
    externalId: varchar('external_id', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('delivery_jobs_due_idx')
      .on(table.nextAttemptAt)
      .where(sql`${table.status} = 'pending'`),
    index('delivery_jobs_company_lead_idx').on(table.companyId, table.leadId),
    uniqueIndex('delivery_jobs_event_kind_provider_uniq')
      .on(table.eventId, table.kind, table.provider)
      .where(sql`${table.eventId} IS NOT NULL`),
  ],
);
