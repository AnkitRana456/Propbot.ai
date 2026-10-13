import type { z } from 'zod';
import type {
  webhookEventTypeSchema,
  createWebhookEndpointSchema,
  updateWebhookEndpointSchema,
  webhookLogsFilterSchema,
  inboundLeadWebhookSchema,
  pixelEventSchema,
  integrationProviderSchema,
  updateIntegrationSchema,
} from '../schemas/webhooks.js';

export type WebhookEventType = z.infer<typeof webhookEventTypeSchema>;
export type CreateWebhookEndpointInput = z.infer<typeof createWebhookEndpointSchema>;
export type UpdateWebhookEndpointInput = z.infer<typeof updateWebhookEndpointSchema>;
export type WebhookLogsFilter = z.infer<typeof webhookLogsFilterSchema>;
export type InboundLeadWebhookInput = z.infer<typeof inboundLeadWebhookSchema>;
export type PixelEventInput = z.infer<typeof pixelEventSchema>;
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;
export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;

export interface WebhookEndpointItem {
  id: string;
  companyId: string;
  name: string;
  chatbotId: string | null;
  chatbotName?: string | null;
  url: string;
  maskedSecret: string;
  subscribedEvents: WebhookEventType[];
  headers: Record<string, string>;
  payloadTemplate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookLogItem {
  id: string;
  companyId: string;
  endpointId: string;
  endpointName: string;
  endpointUrl: string;
  leadId: string | null;
  leadName: string | null;
  chatbotId: string | null;
  chatbotName: string | null;
  eventId: string | null;
  eventType: string;
  status: 'success' | 'retrying' | 'failed' | 'dead_letter';
  statusCode: number | null;
  attempt: number;
  maxAttempts: number;
  requestPayload: Record<string, unknown>;
  requestHeaders: Record<string, string>;
  responseBody: string | null;
  responseHeaders: Record<string, string>;
  durationMs: number | null;
  errorMessage: string | null;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookKpis {
  totalWebhooks: number;
  successRate: number;
  failedCount: number;
  avgDurationMs: number;
}

export interface OutboundWebhookEnvelope {
  id: string;
  event: WebhookEventType;
  company_id: string;
  chatbot_id?: string | null;
  timestamp: string;
  attempt: number;
  data: Record<string, unknown>;
}

export interface IntegrationItem {
  id: string;
  companyId: string;
  provider: IntegrationProvider;
  status: 'active' | 'disabled' | 'error';
  config: Record<string, unknown>;
  events: WebhookEventType[];
  createdAt: string;
  updatedAt: string;
}
