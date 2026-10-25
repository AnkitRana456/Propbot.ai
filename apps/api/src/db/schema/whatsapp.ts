import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';
import { chatbots } from './chatbots.js';

export const whatsappConfigs = pgTable(
  'whatsapp_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    chatbotId: uuid('chatbot_id').references(() => chatbots.id, { onDelete: 'set null' }),
    phoneNumberId: varchar('phone_number_id', { length: 100 }),
    businessAccountId: varchar('business_account_id', { length: 64 }),
    businessPhoneNumber: varchar('business_phone_number', { length: 50 }),
    accessToken: text('access_token'),
    appSecret: text('app_secret'),
    verifyToken: varchar('verify_token', { length: 255 }).notNull(),
    templateName: varchar('template_name', { length: 255 }).default('property_inquiry_details'),
    enableAutomation: boolean('enable_automation').notNull().default(true),
    aiAutoReplies: boolean('ai_auto_replies').notNull().default(true),
    pauseAfterAgentReply: boolean('pause_after_agent_reply').notNull().default(true),
    frustrationHandoff: boolean('frustration_handoff').notNull().default(true),
    autoAssignOwner: boolean('auto_assign_owner').notNull().default(true),
    handoffKeywords: text('handoff_keywords')
      .array()
      .notNull()
      .default(sql`ARRAY['agent', 'human', 'representative', 'complaint']::text[]`),
    handoffMessage: text('handoff_message')
      .notNull()
      .default('A property advisor will continue this conversation shortly.'),
    status: varchar('status', { length: 50 }).notNull().default('disconnected'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('whatsapp_configs_company_unique_idx').on(table.companyId),
    index('whatsapp_configs_phone_number_idx').on(table.phoneNumberId),
    index('whatsapp_configs_company_idx').on(table.companyId),
  ],
);

export const whatsappInboundEvents = pgTable(
  'whatsapp_inbound_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    wamid: varchar('wamid', { length: 255 }).notNull(),
    fromPhone: varchar('from_phone', { length: 50 }).notNull(),
    eventType: varchar('event_type', { length: 50 }).notNull().default('message'),
    status: varchar('status', { length: 50 }).notNull().default('received'),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('whatsapp_inbound_company_wamid_idx').on(table.companyId, table.wamid),
    index('whatsapp_inbound_created_idx').on(table.createdAt),
    index('whatsapp_inbound_company_idx').on(table.companyId),
  ],
);

export const whatsappCampaigns = pgTable(
  'whatsapp_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    templateName: varchar('template_name', { length: 255 }).notNull(),
    segment: jsonb('segment')
      .notNull()
      .default(sql`'{}'::jsonb`),
    totalRecipients: integer('total_recipients').notNull().default(0),
    sentCount: integer('sent_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    status: varchar('status', { length: 50 }).notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index('whatsapp_campaigns_company_idx').on(table.companyId)],
);
