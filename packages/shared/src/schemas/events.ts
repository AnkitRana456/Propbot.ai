import { z } from 'zod';

const baseEventSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  timestamp: z.string().datetime(),
  attempts: z.number().int().nonnegative().default(0),
  last_error: z.string().nullable().optional(),
});

export const leadCreatedEventSchema = baseEventSchema.extend({
  type: z.literal('lead_created'),
  payload: z.object({
    lead_id: z.string().uuid(),
    contact_id: z.string().uuid().optional(),
    chatbot_id: z.string().uuid().optional(),
    source: z.string(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

export const leadUpdatedEventSchema = baseEventSchema.extend({
  type: z.literal('lead_updated'),
  payload: z.object({
    lead_id: z.string().uuid(),
    changes: z.record(z.unknown()),
  }),
});

export const intentChangedEventSchema = baseEventSchema.extend({
  type: z.literal('intent_changed'),
  payload: z.object({
    lead_id: z.string().uuid(),
    previous_score: z.number().min(0).max(100),
    new_score: z.number().min(0).max(100),
    reasons: z.array(z.string()).optional(),
  }),
});

export const leadHotEventSchema = baseEventSchema.extend({
  type: z.literal('lead_hot'),
  payload: z.object({
    lead_id: z.string().uuid(),
    intent_score: z.number().min(70).max(100),
    summary: z.string().optional(),
  }),
});

export const leadStatusChangedEventSchema = baseEventSchema.extend({
  type: z.literal('lead_status_changed'),
  payload: z.object({
    lead_id: z.string().uuid(),
    previous_status: z.string(),
    new_status: z.string(),
    reason: z.string().optional(),
  }),
});

export const messageReceivedEventSchema = baseEventSchema.extend({
  type: z.literal('message_received'),
  payload: z.object({
    conversation_id: z.string().uuid(),
    lead_id: z.string().uuid().optional(),
    channel: z.string(),
    content: z.string(),
  }),
});

export const visitBookedEventSchema = baseEventSchema.extend({
  type: z.literal('visit_booked'),
  payload: z.object({
    appointment_id: z.string().uuid(),
    lead_id: z.string().uuid(),
    project_id: z.string().uuid().optional(),
    scheduled_at: z.string().datetime(),
  }),
});

export const visitChangedEventSchema = baseEventSchema.extend({
  type: z.literal('visit_changed'),
  payload: z.object({
    appointment_id: z.string().uuid(),
    lead_id: z.string().uuid(),
    status: z.enum(['rescheduled', 'cancelled', 'completed', 'no_show']),
    previous_scheduled_at: z.string().datetime().optional(),
    new_scheduled_at: z.string().datetime().optional(),
  }),
});

export const brochureOpenedEventSchema = baseEventSchema.extend({
  type: z.literal('brochure_opened'),
  payload: z.object({
    lead_id: z.string().uuid(),
    project_id: z.string().uuid(),
    brochure_id: z.string().uuid().optional(),
  }),
});

export const roomViewedEventSchema = baseEventSchema.extend({
  type: z.literal('room_viewed'),
  payload: z.object({
    lead_id: z.string().uuid(),
    room_token: z.string(),
    time_spent_seconds: z.number().nonnegative().optional(),
  }),
});

export const handoffRequestedEventSchema = baseEventSchema.extend({
  type: z.literal('handoff_requested'),
  payload: z.object({
    conversation_id: z.string().uuid(),
    lead_id: z.string().uuid().optional(),
    reason: z.string(),
  }),
});

export const paymentReceivedEventSchema = baseEventSchema.extend({
  type: z.literal('payment_received'),
  payload: z.object({
    lead_id: z.string().uuid(),
    payment_id: z.string(),
    amount: z.number().positive(),
    currency: z.string().default('INR'),
  }),
});

export const surveyCompletedEventSchema = baseEventSchema.extend({
  type: z.literal('survey_completed'),
  payload: z.object({
    lead_id: z.string().uuid(),
    rating: z.number().min(1).max(5),
    feedback: z.string().optional(),
    interested_in_booking: z.boolean().optional(),
  }),
});

export const domainEventTypeSchema = z.enum([
  'lead_created',
  'lead_updated',
  'intent_changed',
  'lead_hot',
  'lead_status_changed',
  'message_received',
  'visit_booked',
  'visit_changed',
  'brochure_opened',
  'room_viewed',
  'handoff_requested',
  'payment_received',
  'survey_completed',
]);

export const domainEventSchema = z.discriminatedUnion('type', [
  leadCreatedEventSchema,
  leadUpdatedEventSchema,
  intentChangedEventSchema,
  leadHotEventSchema,
  leadStatusChangedEventSchema,
  messageReceivedEventSchema,
  visitBookedEventSchema,
  visitChangedEventSchema,
  brochureOpenedEventSchema,
  roomViewedEventSchema,
  handoffRequestedEventSchema,
  paymentReceivedEventSchema,
  surveyCompletedEventSchema,
]);
