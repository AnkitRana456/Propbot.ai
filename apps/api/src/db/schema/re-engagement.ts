import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { leads } from './leads.js';

export const reEngagementLogs = pgTable(
  're_engagement_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 50 }).notNull().default('whatsapp'),
    intervalDays: integer('interval_days').notNull(), // 1, 3, 7, 30
    hookTemplate: text('hook_template').notNull(),
    messageContent: text('message_content').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('sent'), // sent, failed, skipped_opt_out, queued
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('re_engagement_logs_company_lead_idx').on(table.companyId, table.leadId),
    index('re_engagement_logs_company_sent_idx').on(table.companyId, table.sentAt),
  ],
);
