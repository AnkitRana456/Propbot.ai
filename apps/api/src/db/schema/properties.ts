import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';
import { leads } from './leads.js';

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    builderName: varchar('builder_name', { length: 255 }).notNull(),
    reraNo: varchar('rera_no', { length: 100 }),
    location: varchar('location', { length: 255 }).notNull(),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    mapUrl: text('map_url'),
    status: varchar('status', { length: 50 }).notNull().default('under_construction'),
    possessionDate: varchar('possession_date', { length: 100 }),
    overview: text('overview'),
    amenities: jsonb('amenities')
      .notNull()
      .default(sql`'[]'::jsonb`),
    usps: jsonb('usps')
      .notNull()
      .default(sql`'[]'::jsonb`),
    gallery: jsonb('gallery')
      .notNull()
      .default(sql`'[]'::jsonb`),
    highlightPhotos: jsonb('highlight_photos')
      .notNull()
      .default(sql`'[]'::jsonb`),
    masterPlanUrl: text('master_plan_url'),
    videoTourUrl: text('video_tour_url'),
    /** Charges, taxes and rules used to build cost sheets for this project's units. */
    costSheetConfig: jsonb('cost_sheet_config').$type<Record<string, unknown> | null>(),
    floorPlans: jsonb('floor_plans')
      .notNull()
      .default(sql`'[]'::jsonb`),
    priceSheetUrl: text('price_sheet_url'),
    paymentPlans: jsonb('payment_plans')
      .notNull()
      .default(sql`'[]'::jsonb`),
    offers: jsonb('offers')
      .notNull()
      .default(sql`'[]'::jsonb`),
    localityInsights: jsonb('locality_insights')
      .notNull()
      .default(sql`'{}'::jsonb`),
    pricingDetails: jsonb('pricing_details')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  table => [
    index('projects_company_idx').on(table.companyId),
    index('projects_status_idx').on(table.status),
    index('projects_company_location_idx').on(table.companyId, table.location),
  ],
);

export const units = pgTable(
  'units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    tower: varchar('tower', { length: 100 }),
    floor: integer('floor'),
    unitNumber: varchar('unit_number', { length: 50 }).notNull(),
    bhk: integer('bhk').notNull(),
    carpetAreaSqft: numeric('carpet_area_sqft', { precision: 10, scale: 2 }).notNull(),
    superAreaSqft: numeric('super_area_sqft', { precision: 10, scale: 2 }),
    price: numeric('price', { precision: 14, scale: 2 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('available'),
    facing: varchar('facing', { length: 50 }),
    furnishing: varchar('furnishing', { length: 50 }).default('unfurnished'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  table => [
    index('units_company_project_status_idx').on(table.companyId, table.projectId, table.status),
    index('units_company_bhk_price_idx').on(table.companyId, table.bhk, table.price),
  ],
);

export const brochures = pgTable(
  'brochures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    fileUrl: text('file_url').notNull(),
    isGated: boolean('is_gated').notNull().default(true),
    downloadCount: integer('download_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index('brochures_company_project_idx').on(table.companyId, table.projectId)],
);

export const shortlistRooms = pgTable(
  'shortlist_rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 64 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    matchedPreferences: jsonb('matched_preferences')
      .notNull()
      .default(sql`'{}'::jsonb`),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    viewsCount: integer('views_count').notNull().default(0),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
    totalTimeSpentSeconds: integer('total_time_spent_seconds').notNull().default(0),
    favoriteProjectId: uuid('favorite_project_id')
      .references(() => projects.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 50 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('shortlist_rooms_company_lead_idx').on(table.companyId, table.leadId),
    index('shortlist_rooms_token_idx').on(table.token),
    index('shortlist_rooms_expires_at_idx').on(table.expiresAt),
  ],
);

export const shortlistItems = pgTable(
  'shortlist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shortlistId: uuid('shortlist_id')
      .notNull()
      .references(() => shortlistRooms.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id')
      .references(() => units.id, { onDelete: 'set null' }),
    orderIndex: integer('order_index').notNull().default(0),
    matchScore: integer('match_score').notNull().default(100),
    matchHighlights: jsonb('match_highlights')
      .notNull()
      .default(sql`'[]'::jsonb`),
    viewCount: integer('view_count').notNull().default(0),
    timeSpentSeconds: integer('time_spent_seconds').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('shortlist_items_room_project_idx').on(table.shortlistId, table.projectId),
  ],
);
