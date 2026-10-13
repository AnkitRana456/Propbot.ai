import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  uniqueIndex,
  jsonb,
  integer,
  boolean,
  text,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull(),
    team: varchar('team', { length: 100 }),
    status: varchar('status', { length: 50 }).notNull().default('pending_approval'),
    workingHours: jsonb('working_hours'),
    leadCapacity: integer('lead_capacity').default(50),
    assignedChatbots: text('assigned_chatbots')
      .array()
      .default(sql`ARRAY[]::text[]`),
    twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
    twoFactorSecret: varchar('two_factor_secret', { length: 255 }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  table => [uniqueIndex('users_company_email_idx').on(table.companyId, table.email)],
);

export const userInvitations = pgTable(
  'user_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull(),
    team: varchar('team', { length: 100 }),
    leadCapacity: integer('lead_capacity').default(50),
    workingHours: jsonb('working_hours'),
    tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('user_invitations_company_email_idx').on(table.companyId, table.email),
    uniqueIndex('user_invitations_token_hash_idx').on(table.tokenHash),
  ],
);
