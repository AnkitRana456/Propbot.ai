import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    industry: varchar('industry', { length: 100 }),
    website: varchar('website', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    address: text('address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  table => [index('organizations_company_idx').on(table.companyId)],
);
