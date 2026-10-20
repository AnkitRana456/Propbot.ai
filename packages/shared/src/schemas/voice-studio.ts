import { z } from 'zod';

export const VOICE_LANGUAGES = ['en-IN', 'hi-IN', 'hinglish', 'mr-IN', 'ta-IN', 'te-IN', 'kn-IN'] as const;

export const voiceSettingsSchema = z
  .object({
    provider: z.enum(['gemini', 'google', 'elevenlabs', 'sarvam']).default('gemini'),
    voiceId: z.string().max(80).default('default'),
    language: z.enum(VOICE_LANGUAGES).default('en-IN'),
    accent: z.string().max(40).default('Indian English'),
    speed: z.number().min(0.7).max(1.3).default(1),
    pitch: z.number().min(-5).max(5).default(0),
    tone: z.enum(['warm', 'professional', 'energetic']).default('warm'),
  })
  .default({});

export const escalationRulesSchema = z
  .object({
    /** A caller saying any of these is handed to a person. */
    keywords: z.array(z.string().min(1).max(40)).max(20).default(['speak to a person', 'human', 'manager', 'complaint']),
    /** Hand over when the caller is asking for discounts or negotiation. */
    onPriceNegotiation: z.boolean().default(true),
    /** Hand over after this many strongly negative turns in a row. */
    negativeTurns: z.number().int().min(1).max(10).default(2),
    transferNumber: z.string().max(32).optional().nullable(),
  })
  .default({});

export const createVoiceAgentSchema = z.object({
  name: z.string().min(2).max(150),
  agentId: z.string().uuid().nullable().optional(),
  chatbotId: z.string().uuid().nullable().optional(),
  voice: voiceSettingsSchema,
  greeting: z.string().max(600).optional().nullable(),
  closing: z.string().max(600).optional().nullable(),
  escalationRules: escalationRulesSchema,
  recordingConsentScript: z.string().max(600).optional().nullable(),
  maxCallSeconds: z.number().int().min(30).max(3600).default(600),
});
export type CreateVoiceAgentInput = z.infer<typeof createVoiceAgentSchema>;
export const updateVoiceAgentSchema = createVoiceAgentSchema.partial().extend({ status: z.enum(['active', 'paused']).optional() });
export type UpdateVoiceAgentInput = z.infer<typeof updateVoiceAgentSchema>;

export interface VoiceAgentItem {
  id: string;
  name: string;
  agentId: string | null;
  chatbotId: string | null;
  voice: z.infer<typeof voiceSettingsSchema>;
  greeting: string | null;
  closing: string | null;
  escalationRules: z.infer<typeof escalationRulesSchema>;
  recordingConsentScript: string | null;
  maxCallSeconds: number;
  status: 'active' | 'paused';
  createdAt: string;
}

export const createPhoneNumberSchema = z.object({
  provider: z.enum(['plivo', 'exotel', 'twilio']),
  number: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use international format, e.g. +918040001000'),
  voiceAgentId: z.string().uuid().nullable().optional(),
  direction: z.enum(['inbound', 'outbound', 'both']).default('both'),
});
export type CreatePhoneNumberInput = z.infer<typeof createPhoneNumberSchema>;
export interface PhoneNumberItem {
  id: string;
  provider: string;
  number: string;
  voiceAgentId: string | null;
  direction: string;
  status: string;
  createdAt: string;
}

export const dndInputSchema = z.object({
  phones: z.array(z.string().min(7).max(20)).min(1).max(1000),
  reason: z.enum(['requested', 'regulator_list', 'imported']).default('imported'),
});
export type DndInput = z.infer<typeof dndInputSchema>;

export const callingWindowSchema = z
  .object({
    /** 0 = Sunday ... 6 = Saturday */
    days: z.array(z.number().int().min(0).max(6)).min(1).default([1, 2, 3, 4, 5, 6]),
    startHour: z.number().int().min(0).max(23).default(9),
    endHour: z.number().int().min(1).max(24).default(20),
    timezone: z.string().max(60).default('Asia/Kolkata'),
  })
  .default({});
export const retryPolicySchema = z
  .object({ maxAttempts: z.number().int().min(1).max(6).default(3), gapMinutes: z.number().int().min(5).max(1440).default(120) })
  .default({});

export const createCallCampaignSchema = z
  .object({
    name: z.string().min(2).max(150),
    voiceAgentId: z.string().uuid(),
    segmentId: z.string().uuid().optional(),
    leadIds: z.array(z.string().uuid()).max(500).optional(),
    callingWindow: callingWindowSchema,
    retryPolicy: retryPolicySchema,
    concurrency: z.number().int().min(1).max(20).default(3),
    startsAt: z.string().datetime().optional(),
  })
  .refine(v => Boolean(v.segmentId) !== Boolean(v.leadIds?.length), { message: 'Choose either a segment or a list of leads.', path: ['segmentId'] });
export type CreateCallCampaignInput = z.infer<typeof createCallCampaignSchema>;

export interface CallCampaignItem {
  id: string;
  name: string;
  voiceAgentId: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  concurrency: number;
  callingWindow: z.infer<typeof callingWindowSchema>;
  retryPolicy: z.infer<typeof retryPolicySchema>;
  stats: Record<string, number>;
  progress: { total: number; pending: number; calling: number; done: number; skipped: number; failed: number };
  startsAt: string | null;
  createdAt: string;
}

export const testCallTurnSchema = z.object({ utterance: z.string().min(1).max(1000) });
export type TestCallTurnInput = z.infer<typeof testCallTurnSchema>;
export const startTestCallSchema = z.object({ leadId: z.string().uuid().optional() });

export interface CallEventItem {
  id: string;
  type: string;
  speaker: string | null;
  payload: Record<string, unknown>;
  offsetMs: number;
  createdAt: string;
}
export interface VoiceCallListItem {
  id: string;
  direction: string;
  status: string;
  outcome: string | null;
  fromNumber: string;
  toNumber: string;
  leadId: string | null;
  contactName: string | null;
  voiceAgentId: string | null;
  campaignId: string | null;
  durationSeconds: number;
  sentiment: string | null;
  summary: string | null;
  escalatedToHuman: boolean;
  startedAt: string | null;
  createdAt: string;
}
export interface VoiceCallDetail extends VoiceCallListItem {
  transcript: string | null;
  recordingUrl: string | null;
  events: CallEventItem[];
}
export interface TestCallTurnResult {
  reply: string;
  ended: boolean;
  escalated: boolean;
  outcome: string | null;
  signals: Array<{ type: string; value: string }>;
}
export interface VoiceAnalytics {
  totalCalls: number;
  connectedRate: number;
  avgDurationSeconds: number;
  byOutcome: Record<string, number>;
  byDay: Array<{ day: string; calls: number }>;
  qualifiedCount: number;
  escalatedCount: number;
  dndCount: number;
}
