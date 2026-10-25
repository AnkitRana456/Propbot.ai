import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';
import { leads } from './leads.js';
import { projects } from './properties.js';
import { users } from './users.js';

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    assignedAgentId: uuid('assigned_agent_id').references(() => users.id, { onDelete: 'set null' }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(45),
    status: varchar('status', { length: 50 }).notNull().default('scheduled'),
    appointmentType: varchar('appointment_type', { length: 50 }).notNull().default('site_visit'),
    location: varchar('location', { length: 255 }),
    meetingLink: varchar('meeting_link', { length: 500 }),
    calendarEventId: varchar('calendar_event_id', { length: 255 }),
    calendarStatus: varchar('calendar_status', { length: 50 }).notNull().default('dashboard_only'),
    notes: text('notes'),
    cancellationReason: text('cancellation_reason'),
    rescheduledFromId: uuid('rescheduled_from_id'),
    reminderSent24h: boolean('reminder_sent_24h').notNull().default(false),
    reminderSent2h: boolean('reminder_sent_2h').notNull().default(false),
    surveyToken: varchar('survey_token', { length: 100 }),
    surveyRating: integer('survey_rating'),
    surveyFeedback: text('survey_feedback'),
    surveyInterestedInBooking: varchar('survey_interested_in_booking', { length: 20 }),
    surveyCompletedAt: timestamp('survey_completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('appointments_company_scheduled_status_idx').on(
      table.companyId,
      table.scheduledAt,
      table.status,
    ),
    index('appointments_conflict_check_idx').on(
      table.companyId,
      table.scheduledAt,
      table.assignedAgentId,
      table.status,
    ),
    index('appointments_lead_idx').on(table.leadId),
    uniqueIndex('appointments_survey_token_idx').on(table.surveyToken),
  ],
);

export const calendarIntegrations = pgTable(
  'calendar_integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull().default('google'),
    isConnected: boolean('is_connected').notNull().default(false),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenExpiry: timestamp('token_expiry', { withTimezone: true }),
    calendarId: varchar('calendar_id', { length: 255 }).default('primary'),
    accountEmail: varchar('account_email', { length: 255 }),
    simulated: boolean('simulated').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('calendar_integrations_company_idx').on(table.companyId),
    uniqueIndex('calendar_integrations_company_user_idx').on(table.companyId, table.userId),
  ],
);

export const availabilitySettings = pgTable(
  'availability_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    workingDays: jsonb('working_days').notNull().$type<number[]>().default([1, 2, 3, 4, 5, 6]),
    startTime: varchar('start_time', { length: 10 }).notNull().default('09:00'),
    endTime: varchar('end_time', { length: 10 }).notNull().default('18:00'),
    slotDurationMinutes: integer('slot_duration_minutes').notNull().default(45),
    bufferMinutes: integer('buffer_minutes').notNull().default(15),
    maxVisitsPerSlot: integer('max_visits_per_slot').notNull().default(1),
    blackoutDates: jsonb('blackout_dates').notNull().$type<string[]>().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('availability_settings_company_idx').on(table.companyId),
    uniqueIndex('availability_settings_company_agent_project_idx').on(
      table.companyId,
      table.agentId,
      table.projectId,
    ),
  ],
);
