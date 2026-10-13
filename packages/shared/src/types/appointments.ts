import { z } from 'zod';
import type {
  appointmentStatusEnum,
  appointmentTypeEnum,
  calendarStatusEnum,
  appointmentItemSchema,
  createAppointmentInputSchema,
  updateAppointmentInputSchema,
  rescheduleAppointmentInputSchema,
  updateAppointmentStatusInputSchema,
  availableSlotSchema,
  availableSlotsQuerySchema,
  availableSlotsResponseSchema,
  availabilitySettingsSchema,
  bookVisitChatInputSchema,
  appointmentSurveyInputSchema,
  appointmentsKpiResponseSchema,
  appointmentsListResponseSchema,
  calendarIntegrationStatusSchema,
} from '../schemas/appointments.js';

export type AppointmentStatus = z.infer<typeof appointmentStatusEnum>;
export type AppointmentType = z.infer<typeof appointmentTypeEnum>;
export type CalendarStatus = z.infer<typeof calendarStatusEnum>;

export type AppointmentItem = z.infer<typeof appointmentItemSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentInputSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentInputSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentInputSchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusInputSchema>;

export type AvailableSlot = z.infer<typeof availableSlotSchema>;
export type AvailableSlotsQuery = z.infer<typeof availableSlotsQuerySchema>;
export type AvailableSlotsResponse = z.infer<typeof availableSlotsResponseSchema>;
export type AvailabilitySettings = z.infer<typeof availabilitySettingsSchema>;

export type BookVisitChatInput = z.infer<typeof bookVisitChatInputSchema>;
export type AppointmentSurveyInput = z.infer<typeof appointmentSurveyInputSchema>;

export type AppointmentsKpiResponse = z.infer<typeof appointmentsKpiResponseSchema>;
export type AppointmentsListResponse = z.infer<typeof appointmentsListResponseSchema>;
export type CalendarIntegrationStatus = z.infer<typeof calendarIntegrationStatusSchema>;
