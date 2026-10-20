import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  boolean,
  bigint,
  integer,
  text,
  index,
  AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentCompanyId: uuid('parent_company_id').references((): AnyPgColumn => companies.id, {
    onDelete: 'set null',
  }),
  isAgency: boolean('is_agency').notNull().default(false),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  plan: varchar('plan', { length: 50 }).notNull().default('trial'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  branding: jsonb('branding')
    .notNull()
    .default(sql`'{}'::jsonb`),
  settings: jsonb('settings')
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const companyAiSettings = pgTable('company_ai_settings', {
  companyId: uuid('company_id')
    .primaryKey()
    .references(() => companies.id, { onDelete: 'cascade' }),
  killSwitch: boolean('kill_switch').notNull().default(false),
  allowedTiers: text('allowed_tiers')
    .array()
    .notNull()
    .default(sql`ARRAY['T0', 'T1']::text[]`),
  dailyActionCap: integer('daily_action_cap').notNull().default(100),
  scoringConfig: jsonb('scoring_config')
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 20 }).notNull(),
    keyHash: varchar('key_hash', { length: 255 }).notNull().unique(),
    permissions: text('permissions')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    // Developer platform columns (migration 0020)
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    usageCount: bigint('usage_count', { mode: 'number' }).notNull().default(0),
    createdBy: uuid('created_by'),
  },
  table => [index('api_keys_company_prefix_idx').on(table.companyId, table.keyPrefix)],
);
