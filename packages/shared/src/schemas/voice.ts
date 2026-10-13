import { z } from 'zod';

// ==========================================
// Voice & Telephony Schemas
// ==========================================

export const callDirectionSchema = z.enum([
  'outbound_callback',
  'outbound_manual',
  'inbound',
]);

export const callStatusSchema = z.enum([
  'initiated',
  'ringing',
  'in_progress',
  'completed',
  'failed',
  'no_answer',
  'busy',
]);

export const callSentimentSchema = z.enum(['positive', 'neutral', 'negative']);

export const voiceCallSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  call_sid: z.string(),
  direction: callDirectionSchema,
  from_number: z.string(),
  to_number: z.string(),
  status: callStatusSchema,
  duration_seconds: z.number().int().nonnegative().default(0),
  recording_url: z.string().url().nullable().optional(),
  transcript: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  sentiment: callSentimentSchema.nullable().optional(),
  buyer_dna_extracted: z.record(z.unknown()).default({}),
  intent_score_delta: z.number().int().default(0),
  disclosed_as_ai: z.boolean().default(true),
  escalated_to_human: z.boolean().default(false),
  opted_out: z.boolean().default(false),
  metadata: z.record(z.unknown()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const initiateCallRequestSchema = z.object({
  leadId: z.string().uuid(),
  customGreeting: z.string().max(500).optional(),
});

export const manualCallLogRequestSchema = z.object({
  leadId: z.string().uuid(),
  direction: z.enum(['outbound_manual', 'inbound']).default('outbound_manual'),
  durationSeconds: z.number().int().min(0).max(14400),
  status: callStatusSchema.default('completed'),
  notes: z.string().min(1).max(2000),
  sentiment: callSentimentSchema.optional(),
  outcome: z.enum(['interested', 'callback_requested', 'visit_booked', 'not_interested', 'wrong_number', 'no_answer']).optional(),
  callerNumber: z.string().optional(),
});

export const telephonyWebhookPayloadSchema = z.object({
  callSid: z.string(),
  companyId: z.string().uuid().optional(),
  status: callStatusSchema,
  durationSeconds: z.number().int().optional(),
  recordingUrl: z.string().optional(),
  transcript: z.string().optional(),
  summary: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  disconnectReason: z.string().optional(),
});

export const manualCallLogSchema = manualCallLogRequestSchema;

export type CallDirection = z.infer<typeof callDirectionSchema>;
export type CallStatus = z.infer<typeof callStatusSchema>;
export type CallSentiment = z.infer<typeof callSentimentSchema>;
export type VoiceCall = z.infer<typeof voiceCallSchema>;
export type InitiateCallRequest = z.infer<typeof initiateCallRequestSchema>;
export type ManualCallLogRequest = z.infer<typeof manualCallLogRequestSchema>;
export type TelephonyWebhookPayload = z.infer<typeof telephonyWebhookPayloadSchema>;
