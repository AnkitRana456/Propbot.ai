import { pgTable, uuid, varchar, text, numeric, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';
import { projects, units } from './properties.js';
import { leads } from './leads.js';
import { users } from './users.js';

/** A price breakup for one unit, optionally prepared for a lead and shared by link. */
export const costSheets = pgTable(
  'cost_sheets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id').notNull().references(() => units.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    token: varchar('token', { length: 64 }).notNull(),
    lines: jsonb('lines').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    totals: jsonb('totals').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    discount: numeric('discount', { precision: 14, scale: 2 }).notNull().default('0'),
    notes: text('notes'),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    viewCount: integer('view_count').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [
    uniqueIndex('cost_sheets_token_idx').on(t.token),
    index('cost_sheets_company_lead_idx').on(t.companyId, t.leadId),
    index('cost_sheets_company_unit_idx').on(t.companyId, t.unitId),
  ],
);
