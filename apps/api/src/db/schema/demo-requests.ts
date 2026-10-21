import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';

/** Demo enquiries from the public marketing site. Not tenant data: there is no company yet. */
export const demoRequests = pgTable(
  'demo_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    email: varchar('email', { length: 190 }).notNull(),
    mobile: varchar('mobile', { length: 30 }).notNull(),
    agency: varchar('agency', { length: 160 }).notNull(),
    listings: varchar('listings', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('new'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('demo_requests_created_idx').on(t.createdAt), index('demo_requests_email_idx').on(t.email)],
);
