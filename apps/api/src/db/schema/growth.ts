import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  numeric,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { users } from './users.js';
import { contacts } from './contacts.js';
import { leads } from './leads.js';
import { projects } from './properties.js';

export const segments = pgTable(
  'segments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    filterCriteria: jsonb('filter_criteria').notNull().default({}),
    cachedCount: integer('cached_count').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('segments_company_idx').on(table.companyId),
  ],
);

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    segmentId: uuid('segment_id')
      .references(() => segments.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    channel: varchar('channel', { length: 50 }).notNull().default('whatsapp'), // whatsapp, email, sms
    status: varchar('status', { length: 50 }).notNull().default('draft'), // draft, scheduled, running, paused, completed, cancelled
    scheduleType: varchar('schedule_type', { length: 50 }).notNull().default('immediate'), // immediate, scheduled, drip
    sendWindowStart: varchar('send_window_start', { length: 10 }).default('09:00'),
    sendWindowEnd: varchar('send_window_end', { length: 10 }).default('20:00'),
    frequencyCap: integer('frequency_cap').notNull().default(2), // max per week
    variantA: jsonb('variant_a').notNull(),
    variantB: jsonb('variant_b'),
    aBTestEnabled: boolean('a_b_test_enabled').notNull().default(false),
    stats: jsonb('stats').notNull().default({
      recipients: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      clicked: 0,
      optedOut: 0,
    }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('campaigns_company_idx').on(table.companyId),
    index('campaigns_status_idx').on(table.companyId, table.status),
  ],
);

export const campaignRecipients = pgTable(
  'campaign_recipients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .references(() => contacts.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .references(() => leads.id, { onDelete: 'set null' }),
    variant: varchar('variant', { length: 10 }).notNull().default('A'), // A or B
    status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, sent, delivered, read, clicked, opted_out, failed
    channelMessageId: text('channel_message_id'),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('campaign_recipients_campaign_idx').on(table.campaignId),
    index('campaign_recipients_company_idx').on(table.companyId),
    index('campaign_recipients_contact_idx').on(table.contactId),
  ],
);

export const bookingTransactions = pgTable(
  'booking_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    unitId: varchar('unit_id', { length: 100 }),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'set null' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 10 }).notNull().default('INR'),
    provider: varchar('provider', { length: 50 }).notNull().default('razorpay'), // razorpay, stripe, mock
    paymentLinkId: varchar('payment_link_id', { length: 255 }),
    paymentLinkUrl: text('payment_link_url'),
    status: varchar('status', { length: 50 }).notNull().default('created'), // created, pending, paid, failed, refunded
    orderId: varchar('order_id', { length: 255 }),
    paymentId: varchar('payment_id', { length: 255 }),
    receiptUrl: text('receipt_url'),
    metadata: jsonb('metadata').notNull().default({}),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('booking_transactions_company_idx').on(table.companyId),
    index('booking_transactions_lead_idx').on(table.companyId, table.leadId),
    index('booking_transactions_link_idx').on(table.paymentLinkId),
  ],
);
