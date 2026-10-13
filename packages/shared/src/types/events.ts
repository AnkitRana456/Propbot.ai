import { z } from 'zod';
import {
  domainEventSchema,
  domainEventTypeSchema,
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
} from '../schemas/events.js';

export type DomainEventType = z.infer<typeof domainEventTypeSchema>;
export type DomainEvent = z.infer<typeof domainEventSchema>;

export type LeadCreatedEvent = z.infer<typeof leadCreatedEventSchema>;
export type LeadUpdatedEvent = z.infer<typeof leadUpdatedEventSchema>;
export type IntentChangedEvent = z.infer<typeof intentChangedEventSchema>;
export type LeadHotEvent = z.infer<typeof leadHotEventSchema>;
export type LeadStatusChangedEvent = z.infer<typeof leadStatusChangedEventSchema>;
export type MessageReceivedEvent = z.infer<typeof messageReceivedEventSchema>;
export type VisitBookedEvent = z.infer<typeof visitBookedEventSchema>;
export type VisitChangedEvent = z.infer<typeof visitChangedEventSchema>;
export type BrochureOpenedEvent = z.infer<typeof brochureOpenedEventSchema>;
export type RoomViewedEvent = z.infer<typeof roomViewedEventSchema>;
export type HandoffRequestedEvent = z.infer<typeof handoffRequestedEventSchema>;
export type PaymentReceivedEvent = z.infer<typeof paymentReceivedEventSchema>;
export type SurveyCompletedEvent = z.infer<typeof surveyCompletedEventSchema>;
