import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';
import { chatbots } from './chatbots.js';
import { contacts } from './contacts.js';
import { users } from './users.js';
import { leads } from './leads.js';

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    chatbotId: uuid('chatbot_id')
      .notNull()
      .references(() => chatbots.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    channel: varchar('channel', { length: 50 }).notNull().default('web'),
    status: varchar('status', { length: 50 }).notNull().default('bot'),
    assignedAgentId: uuid('assigned_agent_id').references(() => users.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('conversations_company_bot_idx').on(table.companyId, table.chatbotId),
    index('conversations_contact_idx').on(table.contactId),
    index('conversations_company_lead_idx').on(table.companyId, table.leadId),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderType: varchar('sender_type', { length: 50 }).notNull(),
    senderId: varchar('sender_id', { length: 255 }),
    content: text('content').notNull(),
    tokensUsed: integer('tokens_used'),
    latencyMs: integer('latency_ms'),
    sentiment: varchar('sentiment', { length: 50 }),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('messages_conversation_created_idx').on(table.conversationId, table.createdAt),
    index('messages_company_idx').on(table.companyId),
  ],
);
