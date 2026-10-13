import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { companies } from './companies.js';

export const companySsoConfigs = pgTable(
  'company_sso_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    providerType: varchar('provider_type', { length: 50 }).notNull().default('saml'), // saml, oidc
    domain: varchar('domain', { length: 255 }).notNull(),
    entityId: varchar('entity_id', { length: 500 }),
    ssoUrl: text('sso_url'),
    certificate: text('certificate'),
    clientId: varchar('client_id', { length: 255 }),
    clientSecret: text('client_secret'),
    discoveryUrl: text('discovery_url'),
    isActive: boolean('is_active').notNull().default(false),
    enforceForDomain: boolean('enforce_for_domain').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('company_sso_domain_idx').on(table.domain),
    index('company_sso_company_idx').on(table.companyId),
  ],
);
