import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  date,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import { companies } from './companies.js';
import { chatbots } from './chatbots.js';

export const dailyAnalyticsRollups = pgTable(
  'daily_analytics_rollups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    chatbotId: uuid('chatbot_id').references(() => chatbots.id, { onDelete: 'set null' }),
    date: date('date').notNull(),
    totalConversations: integer('total_conversations').notNull().default(0),
    totalMessages: integer('total_messages').notNull().default(0),
    totalLeads: integer('total_leads').notNull().default(0),
    qualifiedLeads: integer('qualified_leads').notNull().default(0),
    visitsBooked: integer('visits_booked').notNull().default(0),
    visitsDone: integer('visits_done').notNull().default(0),
    dealsBooked: integer('deals_booked').notNull().default(0),
    avgLatencyMs: integer('avg_latency_ms').notNull().default(0),
    tokensUsed: integer('tokens_used').notNull().default(0),
    positiveSentimentCount: integer('positive_sentiment_count').notNull().default(0),
    negativeSentimentCount: integer('negative_sentiment_count').notNull().default(0),
    metricsJson: jsonb('metrics_json')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('daily_rollups_company_date_idx').on(table.companyId, table.date),
    index('daily_rollups_company_bot_date_idx').on(table.companyId, table.chatbotId, table.date),
    uniqueIndex('daily_rollups_unique_entry_idx').on(
      table.companyId,
      table.chatbotId,
      table.date,
    ),
  ],
);

export const campaignSpends = pgTable(
  'campaign_spends',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    campaignName: varchar('campaign_name', { length: 255 }).notNull(),
    source: varchar('source', { length: 100 }).notNull(),
    spendAmount: integer('spend_amount').notNull().default(0),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('campaign_spends_company_campaign_idx').on(
      table.companyId,
      table.campaignName,
      table.periodStart,
    ),
  ],
);

export const reportSchedules = pgTable(
  'report_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    frequency: varchar('frequency', { length: 50 }).notNull().default('weekly'),
    recipients: jsonb('recipients')
      .notNull()
      .default(sql`'[]'::jsonb`),
    format: varchar('format', { length: 50 }).notNull().default('csv'),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('report_schedules_company_idx').on(table.companyId),
  ],
);

export const dailyAnalyticsRollupsRelations = relations(dailyAnalyticsRollups, ({ one }) => ({
  company: one(companies, {
    fields: [dailyAnalyticsRollups.companyId],
    references: [companies.id],
  }),
  chatbot: one(chatbots, {
    fields: [dailyAnalyticsRollups.chatbotId],
    references: [chatbots.id],
  }),
}));

export const campaignSpendsRelations = relations(campaignSpends, ({ one }) => ({
  company: one(companies, {
    fields: [campaignSpends.companyId],
    references: [companies.id],
  }),
}));

export const reportSchedulesRelations = relations(reportSchedules, ({ one }) => ({
  company: one(companies, {
    fields: [reportSchedules.companyId],
    references: [companies.id],
  }),
}));
