import { z } from 'zod';

// ------------------------------------------------------------------ Teams
export const createTeamSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  leadUserId: z.string().uuid().nullable().optional(),
  memberIds: z.array(z.string().uuid()).max(100).default([]),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export const updateTeamSchema = createTeamSchema.partial();
export interface TeamItem {
  id: string;
  name: string;
  description: string | null;
  leadUserId: string | null;
  members: Array<{ id: string; name: string; role: string }>;
}

// ------------------------------------------------------------------ Policies (ABAC on top of roles)
export const POLICY_MODULES = ['leads', 'contacts', 'inbox', 'calls', 'exports', 'inventory', '*'] as const;
export const POLICY_ACTIONS = ['view', 'add', 'change', 'delete', 'export'] as const;
export type PolicyModule = (typeof POLICY_MODULES)[number];
export type PolicyAction = (typeof POLICY_ACTIONS)[number];

export const policyConditionsSchema = z
  .object({
    /** Only inside these hours (24h) in the given timezone. */
    businessHours: z.object({ days: z.array(z.number().int().min(0).max(6)).min(1).default([1, 2, 3, 4, 5, 6]), startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(1).max(24), timezone: z.string().max(60).default('Asia/Kolkata') }).optional(),
    /** Only when the person belongs to one of these teams. */
    teamIds: z.array(z.string().uuid()).max(20).optional(),
  })
  .default({});
export type PolicyConditions = z.infer<typeof policyConditionsSchema>;

export const policyRuleSchema = z.object({
  module: z.enum(POLICY_MODULES),
  actions: z.array(z.enum(POLICY_ACTIONS)).min(1),
  conditions: policyConditionsSchema,
});
export type PolicyRule = z.infer<typeof policyRuleSchema>;

export const createPolicySchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  rules: z.array(policyRuleSchema).min(1).max(30),
});
export type CreatePolicyInput = z.infer<typeof createPolicySchema>;
export const updatePolicySchema = createPolicySchema.partial();

export const POLICY_SUBJECT_TYPES = ['user', 'role', 'team', 'api_key'] as const;
export const assignPolicySchema = z.object({ subjectType: z.enum(POLICY_SUBJECT_TYPES), subjectId: z.string().min(1).max(80) });
export type AssignPolicyInput = z.infer<typeof assignPolicySchema>;
export const evaluatePolicySchema = z.object({ userId: z.string().uuid(), module: z.enum(POLICY_MODULES), action: z.enum(POLICY_ACTIONS) });

export interface PolicyItem {
  id: string;
  name: string;
  description: string | null;
  rules: PolicyRule[];
  assignments: Array<{ id: string; subjectType: string; subjectId: string; label: string }>;
  createdAt: string;
  updatedAt: string;
}
export interface PolicyChangeItem {
  id: string;
  policyId: string | null;
  action: string;
  actorName: string | null;
  change: Record<string, unknown>;
  createdAt: string;
}
export interface PolicyDecision {
  governed: boolean;
  allowed: boolean;
  reason: string;
}

// ------------------------------------------------------------------ Access logs & privacy
export const accessLogQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().max(30).optional(),
  resourceType: z.string().max(40).optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export interface AccessLogItem {
  id: string;
  userId: string | null;
  userName: string | null;
  apiKeyId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  ipAddress: string | null;
  createdAt: string;
}
export const privacySettingsSchema = z.object({
  /** Roles that see masked phone numbers and e-mail addresses. */
  maskRoles: z.array(z.enum(['company_admin', 'sales_manager', 'agent', 'viewer'])).max(4),
});
export type PrivacySettings = z.infer<typeof privacySettingsSchema>;

// ------------------------------------------------------------------ Notification rules
export const NOTIFICATION_EVENTS = ['lead_hot', 'handoff_requested', 'visit_booked', 'lead_created', 'call_completed', 'sla_breach', 'webhook_failed', 'credits_low', 'payment_received', 'payment_failed'] as const;
export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'whatsapp', 'slack'] as const;
export const createNotificationRuleSchema = z.object({
  eventType: z.enum(NOTIFICATION_EVENTS),
  channels: z.array(z.enum(NOTIFICATION_CHANNELS)).min(1),
  /** Omit for a company-wide default. A personal rule replaces the default for that person. */
  userId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
});
export type CreateNotificationRuleInput = z.infer<typeof createNotificationRuleSchema>;
export interface NotificationRuleItem {
  id: string;
  eventType: string;
  channels: string[];
  userId: string | null;
  isActive: boolean;
}
export interface NotificationEntry {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  linkUrl: string | null;
  createdAt: string;
}

// ------------------------------------------------------------------ Usage
export interface UsageSummary {
  days: number;
  llm: { tokens: number; costUsd: number; calls: number; byPurpose: Record<string, number> };
  messages: { total: number; byChannel: Record<string, number> };
  calls: { minutes: number; count: number };
  daily: Array<{ day: string; tokens: number; messages: number }>;
}

// ------------------------------------------------------------------ Consent & data requests (DPDP)
export const recordConsentSchema = z.object({
  contactId: z.string().uuid(),
  channel: z.enum(['whatsapp', 'sms', 'voice', 'email']),
  purpose: z.enum(['marketing', 'service', 'call_recording']),
  granted: z.boolean(),
  source: z.string().max(40).default('manual'),
  evidence: z.record(z.unknown()).default({}),
});
export type RecordConsentInput = z.infer<typeof recordConsentSchema>;
export interface ConsentItem {
  id: string;
  contactId: string;
  channel: string;
  purpose: string;
  granted: boolean;
  source: string;
  createdAt: string;
}
export const createDataRequestSchema = z.object({ kind: z.enum(['export', 'delete']), contactId: z.string().uuid() });
export type CreateDataRequestInput = z.infer<typeof createDataRequestSchema>;
export interface DataRequestItem {
  id: string;
  kind: 'export' | 'delete';
  contactId: string | null;
  subjectLabel: string | null;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  createdAt: string;
  completedAt: string | null;
}

// ------------------------------------------------------------------ Changelog
export interface ChangelogItem {
  id: string;
  title: string;
  bodyMd: string;
  category: string;
  publishedAt: string;
}
