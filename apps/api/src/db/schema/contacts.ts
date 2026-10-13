import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { organizations } from './organizations.js';

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }).notNull(),
    altPhone: varchar('alt_phone', { length: 50 }),
    lifecycleStage: varchar('lifecycle_stage', { length: 50 }).notNull().default('lead'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  table => [
    index('contacts_company_phone_idx').on(table.companyId, table.phone),
    index('contacts_company_email_idx').on(table.companyId, table.email),
  ],
);
