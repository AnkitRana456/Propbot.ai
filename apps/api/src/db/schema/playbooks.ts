import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';
import { chatbots } from './chatbots.js';

export const objectionPlaybooks = pgTable(
  'objection_playbooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    chatbotId: uuid('chatbot_id').references(() => chatbots.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 100 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    triggerKeywords: jsonb('trigger_keywords')
      .notNull()
      .default(sql`'[]'::jsonb`),
    rebuttalText: text('rebuttal_text').notNull(),
    suggestedAction: varchar('suggested_action', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('objection_playbooks_company_cat_idx').on(table.companyId, table.category),
    index('objection_playbooks_company_bot_idx').on(table.companyId, table.chatbotId),
  ],
);
