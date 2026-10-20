import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';

export const chatbots = pgTable(
  'chatbots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').references(() => companies.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 50 }).notNull().default('web'),
    status: varchar('status', { length: 50 }).notNull().default('draft'),
    publicKey: varchar('public_key', { length: 64 }).notNull(),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    deliveryRules: jsonb('delivery_rules')
      .notNull()
      .default(sql`'{}'::jsonb`),
    allowedDomains: text('allowed_domains')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /** Agent that answers for this chatbot. NULL keeps the legacy persona-from-config behaviour. FK lives in migration 0019. */
    agentId: uuid('agent_id'),
    totalLeads: integer('total_leads').notNull().default(0),
    brochureDownloads: integer('brochure_downloads').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  table => [
    uniqueIndex('chatbots_public_key_idx').on(table.publicKey),
    index('chatbots_company_idx').on(table.companyId),
    index('chatbots_client_idx').on(table.clientId),
  ],
);
