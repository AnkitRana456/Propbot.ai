import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { users } from './users.js';
import { leads } from './leads.js';

export const agentActions = pgTable(
  'agent_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    agentName: varchar('agent_name', { length: 100 }).notNull(),
    actionType: varchar('action_type', { length: 100 }).notNull(),
    tier: varchar('tier', { length: 10 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('proposed'),
    args: jsonb('args').notNull(),
    result: jsonb('result'),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('agent_actions_company_status_tier_idx').on(table.companyId, table.status, table.tier),
    index('agent_actions_company_lead_idx').on(table.companyId, table.leadId),
    index('agent_actions_status_expires_idx').on(table.status, table.expiresAt),
  ],
);
