import { pgTable, uuid, varchar, text, bigint, numeric, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';
import { users } from './users.js';
import { leads } from './leads.js';
import { contacts } from './contacts.js';
import { projects, units } from './properties.js';
import { usageLedger } from './controls.js';

export const companyBillingProfiles = pgTable('company_billing_profiles', {
  companyId: uuid('company_id').primaryKey().references(() => companies.id, { onDelete: 'cascade' }),
  legalName: varchar('legal_name', { length: 200 }),
  gstin: varchar('gstin', { length: 20 }),
  pan: varchar('pan', { length: 12 }),
  stateCode: varchar('state_code', { length: 4 }),
  address: jsonb('address').$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
  billingEmail: varchar('billing_email', { length: 255 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Booking-token links, plan payments and credit top-ups (migration 0020). Amounts are in minor units (paise). */
export const paymentOrders = pgTable(
  'payment_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 20 }).notNull(),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    unitId: uuid('unit_id').references(() => units.id, { onDelete: 'set null' }),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    provider: varchar('provider', { length: 20 }).notNull(),
    providerOrderId: varchar('provider_order_id', { length: 120 }),
    providerPaymentId: varchar('provider_payment_id', { length: 120 }),
    paymentLinkUrl: text('payment_link_url'),
    status: varchar('status', { length: 24 }).notNull().default('created'),
    receiptNo: varchar('receipt_no', { length: 40 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('payment_orders_company_status_idx').on(t.companyId, t.status, t.createdAt)],
);

export const paymentRefunds = pgTable('payment_refunds', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').notNull().references(() => paymentOrders.id, { onDelete: 'cascade' }),
  amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
  reason: text('reason'),
  providerRefundId: varchar('provider_refund_id', { length: 120 }),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Raw provider webhook log; the unique event id makes redelivery harmless. */
export const paymentEvents = pgTable(
  'payment_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 20 }).notNull(),
    eventId: varchar('event_id', { length: 160 }).notNull(),
    type: varchar('type', { length: 80 }).notNull(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    payload: jsonb('payload').$type<unknown>().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [uniqueIndex('payment_events_event_uniq').on(t.provider, t.eventId)],
);

export const usageCreditAccounts = pgTable('usage_credit_accounts', {
  companyId: uuid('company_id').primaryKey().references(() => companies.id, { onDelete: 'cascade' }),
  balance: numeric('balance', { precision: 16, scale: 4 }).notNull().default('0'),
  autoTopup: jsonb('auto_topup').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const usageCreditTransactions = pgTable(
  'usage_credit_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    delta: numeric('delta', { precision: 16, scale: 4 }).notNull(),
    reason: varchar('reason', { length: 20 }).notNull(),
    paymentOrderId: uuid('payment_order_id').references(() => paymentOrders.id, { onDelete: 'set null' }),
    usageLedgerId: uuid('usage_ledger_id').references(() => usageLedger.id, { onDelete: 'set null' }),
    balanceAfter: numeric('balance_after', { precision: 16, scale: 4 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('usage_credit_tx_company_idx').on(t.companyId, t.createdAt)],
);
