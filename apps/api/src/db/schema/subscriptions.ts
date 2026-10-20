import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  text,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    plan: varchar('plan', { length: 50 }).notNull().default('trial'),
    status: varchar('status', { length: 50 }).notNull().default('active'),
    billingCycle: varchar('billing_cycle', { length: 20 }).notNull().default('monthly'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    limits: jsonb('limits')
      .notNull()
      .default(sql`'{}'::jsonb`),
    leadCreditsBalance: integer('lead_credits_balance').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [uniqueIndex('subscriptions_company_idx').on(table.companyId)],
);

export const subscriptionInvoices = pgTable(
  'subscription_invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, {
      onDelete: 'set null',
    }),
    invoiceNumber: varchar('invoice_number', { length: 100 }).notNull(),
    amount: integer('amount').notNull(),
    currency: varchar('currency', { length: 10 }).notNull().default('INR'),
    status: varchar('status', { length: 50 }).notNull().default('paid'),
    provider: varchar('provider', { length: 50 }).notNull(),
    providerInvoiceId: varchar('provider_invoice_id', { length: 255 }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    pdfUrl: text('pdf_url'),
    // GST (migration 0020): amount is the gross paid; tax is the inclusive share of it
    taxAmount: integer('tax_amount').notNull().default(0),
    taxBreakdown: jsonb('tax_breakdown').notNull().default(sql`'{}'::jsonb`),
    billingSnapshot: jsonb('billing_snapshot').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index('subscription_invoices_company_idx').on(table.companyId, table.createdAt)],
);

export const leadCreditTransactions = pgTable(
  'lead_credit_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    description: text('description').notNull(),
    referenceId: varchar('reference_id', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index('lead_credit_tx_company_idx').on(table.companyId, table.createdAt)],
);
