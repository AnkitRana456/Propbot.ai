import { z } from 'zod';

// ==========================================
// Enums
// ==========================================

export const appointmentStatusEnum = z.enum([
  'scheduled',
  'confirmed',
  'completed',
  'no_show',
  'cancelled',
  'rescheduled',
]);

export const appointmentTypeEnum = z.enum(['site_visit', 'consultation', 'video_call']);

export const calendarStatusEnum = z.enum(['synced', 'dashboard_only', 'failed_sync']);

// ==========================================
// Appointment Item Schema
// ==========================================

export const appointmentItemSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  leadId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  assignedAgentId: z.string().uuid().nullable().optional(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().default(45),
  status: appointmentStatusEnum.default('scheduled'),
  appointmentType: appointmentTypeEnum.default('site_visit'),
  location: z.string().max(255).nullable().optional(),
  meetingLink: z.string().max(500).nullable().optional(),
  calendarEventId: z.string().max(255).nullable().optional(),
  calendarStatus: calendarStatusEnum.default('dashboard_only'),
  notes: z.string().nullable().optional(),
  cancellationReason: z.string().nullable().optional(),
  rescheduledFromId: z.string().uuid().nullable().optional(),
  reminderSent24h: z.boolean().default(false),
  reminderSent2h: z.boolean().default(false),
  surveyToken: z.string().nullable().optional(),
  surveyRating: z.number().int().min(1).max(5).nullable().optional(),
  surveyFeedback: z.string().nullable().optional(),
  surveyInterestedInBooking: z.enum(['yes', 'maybe', 'no']).nullable().optional(),
  surveyCompletedAt: z.string().datetime().nullable().optional(),
  // Joined context fields
  leadName: z.string().optional(),
  leadPhone: z.string().optional(),
  leadEmail: z.string().optional(),
  leadSource: z.string().optional(),
  projectName: z.string().optional(),
  projectLocation: z.string().optional(),
  assignedAgentName: z.string().optional(),
  assignedAgentEmail: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ==========================================
// Request / Input Schemas
// ==========================================

export const createAppointmentInputSchema = z.object({
  leadId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  assignedAgentId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().default(45).optional(),
  appointmentType: appointmentTypeEnum.default('site_visit').optional(),
  location: z.string().max(255).optional(),
  meetingLink: z.string().max(500).optional(),
  notes: z.string().optional(),
});

export const updateAppointmentInputSchema = createAppointmentInputSchema.partial();

export const rescheduleAppointmentInputSchema = z.object({
  scheduledAt: z.string().datetime(),
  reason: z.string().max(500).optional(),
});

export const updateAppointmentStatusInputSchema = z.object({
  status: appointmentStatusEnum,
  cancellationReason: z.string().max(500).optional(),
});

// ==========================================
// Availability & Slots
// ==========================================

export const availableSlotSchema = z.object({
  time: z.string(), // e.g. "10:00"
  datetime: z.string().datetime(), // ISO string
  available: z.boolean(),
  agentId: z.string().uuid().optional(),
  agentName: z.string().optional(),
});

export const availableSlotsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

export const availableSlotsResponseSchema = z.object({
  date: z.string(),
  slots: z.array(availableSlotSchema),
});

export const availabilitySettingsSchema = z.object({
  workingDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5, 6]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).default('18:00'),
  slotDurationMinutes: z.number().int().positive().default(45),
  bufferMinutes: z.number().int().nonnegative().default(15),
  maxVisitsPerSlot: z.number().int().positive().default(1),
  blackoutDates: z.array(z.string()).default([]),
});

// ==========================================
// Chat Booking Tool
// ==========================================

export const bookVisitChatInputSchema = z.object({
  projectId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime(),
  visitorName: z.string().min(1).max(100),
  visitorPhone: z.string().min(6).max(20),
  visitorEmail: z.string().email().optional(),
  notes: z.string().optional(),
  conversationId: z.string().uuid().optional(),
});

// ==========================================
// Survey Schemas
// ==========================================

export const appointmentSurveyInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(2000).optional(),
  interestedInBooking: z.enum(['yes', 'maybe', 'no']).default('maybe'),
});

// ==========================================
// KPI & Listing Responses
// ==========================================

export const appointmentsKpiResponseSchema = z.object({
  upcoming: z.number().int().nonnegative(),
  today: z.number().int().nonnegative(),
  calendarSynced: z.number().int().nonnegative(),
  all: z.number().int().nonnegative(),
});

export const appointmentsListResponseSchema = z.object({
  items: z.array(appointmentItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  kpis: appointmentsKpiResponseSchema.optional(),
});

// ==========================================
// Google Calendar Integration
// ==========================================

export const calendarIntegrationStatusSchema = z.object({
  isConnected: z.boolean(),
  provider: z.string(),
  email: z.string().optional(),
  calendarId: z.string().optional(),
  lastSyncedAt: z.string().datetime().optional(),
  /** A local stand-in used in development; no real events are created. */
  simulated: z.boolean().optional(),
  /** Whether this server has Google keys, so a real connection is possible. */
  configured: z.boolean().optional(),
});
