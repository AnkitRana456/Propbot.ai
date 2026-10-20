import { z } from 'zod';

export const webhookEventTypeSchema = z.enum([
  'lead_captured',
  'lead_updated',
  'lead_qualified',
  'hot_lead',
  'appointment_booked',
  'appointment_changed',
  'brochure_requested',
  'handoff_requested',
  'conversation_closed',
  'payment_received',
]);

export const createWebhookEndpointSchema = z.object({
  name: z.string().min(2).max(100).default('Webhook Endpoint'),
  url: z.string().url('Must be a valid HTTP or HTTPS URL'),
  chatbotId: z.string().uuid().optional().nullable(),
  subscribedEvents: z.array(webhookEventTypeSchema).min(1, 'Select at least one event'),
  headers: z.record(z.string()).default({}),
  payloadTemplate: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateWebhookEndpointSchema = createWebhookEndpointSchema.partial();

export const webhookLogStatusSchema = z.enum([
  'all',
  'success',
  'retrying',
  'failed',
  'dead_letter',
]);

export const webhookLogsFilterSchema = z.object({
  leadId: z.string().optional(),
  endpointId: z.string().uuid().optional(),
  status: webhookLogStatusSchema.optional().default('all'),
  eventType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(5).max(100).default(25),
});

export const inboundPortalTypeSchema = z.enum([
  '99acres',
  'magicbricks',
  'housing',
  'meta_lead_ad',
  'google_lead_ad',
  'generic',
]);

export const inboundLeadWebhookSchema = z.object({
  portal: inboundPortalTypeSchema.default('generic'),
  name: z.string().min(1),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  project: z.string().optional(),
  budget: z.string().optional(),
  configuration: z.string().optional(),
  source: z.string().default('inbound_webhook'),
  externalLeadId: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const pixelEventSchema = z.object({
  eventName: z.enum(['Lead', 'Schedule', 'ViewContent', 'CompleteRegistration']),
  leadId: z.string().uuid().optional(),
  chatbotId: z.string().uuid().optional(),
  consentGiven: z.boolean(),
  metadata: z.record(z.unknown()).default({}),
});

export const integrationProviderSchema = z.enum([
  'google_sheets',
  'hubspot',
  'salesforce',
  'mailchimp',
  'zoho',
  'generic_rest',
  'meta_pixel',
  'google_ads',
]);

export const updateIntegrationSchema = z.object({
  status: z.enum(['active', 'disabled']).default('active'),
  config: z.record(z.unknown()).default({}),
  events: z.array(webhookEventTypeSchema).default(['lead_captured']),
});
