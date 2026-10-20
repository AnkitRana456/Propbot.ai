import { z } from 'zod';

// ------------------------------------------------------------------ Tags
export const TAG_ENTITY_TYPES = ['lead', 'contact', 'conversation'] as const;
export type TagEntityType = (typeof TAG_ENTITY_TYPES)[number];

export const tagAutoRuleSchema = z.object({
  /** Apply when the AI labels a conversation with this label (e.g. site_visit, loan, complaint). */
  aiLabel: z.string().min(1).max(40),
});
export const createTagSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#64748b'),
  entityType: z.enum(TAG_ENTITY_TYPES).default('lead'),
  autoRule: tagAutoRuleSchema.nullable().optional(),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;
export const updateTagSchema = createTagSchema.omit({ entityType: true }).partial();
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export const applyTagSchema = z.object({ entityType: z.enum(TAG_ENTITY_TYPES), entityIds: z.array(z.string().uuid()).min(1).max(200) });
export type ApplyTagInput = z.infer<typeof applyTagSchema>;
export interface TagItem {
  id: string;
  name: string;
  color: string;
  entityType: TagEntityType;
  autoRule: { aiLabel: string } | null;
  usageCount: number;
}

// ------------------------------------------------------------------ Groups (dynamic segments)
export const GROUP_FIELDS = ['status', 'intent_label', 'intent_score', 'source', 'created_days_ago', 'has_visit', 'visit_completed', 'has_tag', 'attribute'] as const;
export const GROUP_OPERATORS = ['equals', 'not_equals', 'in', 'gte', 'lte', 'between', 'contains', 'is_true', 'is_false'] as const;
export const groupRuleSchema = z.object({
  field: z.enum(GROUP_FIELDS),
  /** Form attribute key when field = attribute. */
  key: z.string().max(60).optional(),
  op: z.enum(GROUP_OPERATORS),
  value: z.union([z.string().max(200), z.number(), z.array(z.union([z.string().max(100), z.number()])).max(30)]).optional(),
});
export type GroupRule = z.infer<typeof groupRuleSchema>;
export const createGroupSchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(500).optional().nullable(),
  /** All rules must match. */
  rules: z.array(groupRuleSchema).max(12).default([]),
  isDynamic: z.boolean().default(true),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export const updateGroupSchema = createGroupSchema.partial();
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export interface GroupItem {
  id: string;
  name: string;
  description: string | null;
  rules: GroupRule[];
  isDynamic: boolean;
  memberCount: number;
  refreshedAt: string | null;
}
export interface GroupMemberItem {
  contactId: string;
  leadId: string | null;
  name: string;
  phone: string | null;
  status: string | null;
  intentLabel: string | null;
}

// ------------------------------------------------------------------ 360 view
export interface TimelineEntry {
  at: string;
  kind: 'message' | 'call' | 'visit' | 'activity' | 'note' | 'survey';
  title: string;
  detail: string | null;
  channel?: string | null;
  refId?: string | null;
}
export interface Contact360 {
  contact: { id: string; name: string; phone: string | null; email: string | null; lifecycleStage: string | null };
  lead: { id: string; status: string; source: string; intentScore: number; intentLabel: string; buyerDna: Record<string, unknown>; attributes: Record<string, unknown>; scoreHistory: Array<{ at?: string; score?: number }> } | null;
  tags: Array<{ id: string; name: string; color: string }>;
  insights: Array<{ conversationId: string; summary: string | null; intent: string | null; sentiment: string | null; labels: string[] }>;
  stats: { conversations: number; messages: number; calls: number; visits: number };
  timeline: TimelineEntry[];
}

// ------------------------------------------------------------------ Insights
export const INTENT_TAXONOMY = ['price_enquiry', 'site_visit', 'loan', 'resale', 'rental', 'complaint', 'broker', 'other'] as const;
export interface ConversationInsightItem {
  conversationId: string;
  summary: string | null;
  intent: string | null;
  labels: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  sentimentScore: number | null;
  model: string | null;
  generatedAt: string;
}

// ------------------------------------------------------------------ Surveys
export const createSurveySchema = z.object({
  name: z.string().min(2).max(150),
  kind: z.enum(['csat', 'nps', 'custom']).default('csat'),
  formId: z.string().uuid().nullable().optional(),
  trigger: z.object({ event: z.enum(['visit_completed', 'call_completed', 'manual']).default('visit_completed'), delayMinutes: z.number().int().min(0).max(10080).default(120) }).default({}),
  channel: z.enum(['whatsapp', 'email', 'web']).default('whatsapp'),
});
export type CreateSurveyInput = z.infer<typeof createSurveySchema>;
export const updateSurveySchema = createSurveySchema.partial().extend({ isActive: z.boolean().optional() });
export const recordSurveyResponseSchema = z.object({
  leadId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  /** 1-5 for CSAT, 0-10 for NPS. Omit to store an AI-estimated score from the conversation. */
  score: z.number().int().min(0).max(10).optional(),
  answers: z.record(z.unknown()).default({}),
});
export type RecordSurveyResponseInput = z.infer<typeof recordSurveyResponseSchema>;
export interface SurveyItem {
  id: string;
  name: string;
  kind: 'csat' | 'nps' | 'custom';
  formId: string | null;
  trigger: { event: string; delayMinutes: number };
  channel: string;
  isActive: boolean;
  responseCount: number;
}
export interface SurveyStats {
  kind: string;
  responses: number;
  estimated: number;
  /** CSAT: average 1-5. NPS: score -100..100. */
  score: number | null;
  distribution: Record<string, number>;
  promoters?: number;
  passives?: number;
  detractors?: number;
}

// ------------------------------------------------------------------ Dashboards
export const METRIC_KEYS = [
  'leads_total',
  'leads_by_source',
  'leads_by_stage',
  'leads_over_time',
  'leads_by_agency_partner',
  'visit_conversion',
  'visits_by_status',
  'first_response_minutes',
  'ai_resolution_rate',
  'call_outcomes',
  'campaign_performance',
  'csat_average',
  'funnel',
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
export const WIDGET_TYPES = ['kpi', 'bar', 'line', 'donut', 'funnel', 'table'] as const;
export const widgetConfigSchema = z.object({ metric: z.enum(METRIC_KEYS), days: z.number().int().min(1).max(365).default(30) });
export const createDashboardSchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(500).optional().nullable(),
  isShared: z.boolean().default(false),
});
export const updateDashboardSchema = createDashboardSchema.partial().extend({ isStarred: z.boolean().optional() });
export const createWidgetDefSchema = z.object({
  type: z.enum(WIDGET_TYPES),
  title: z.string().min(1).max(150),
  config: widgetConfigSchema,
  layout: z.object({ x: z.number().int().min(0).max(11).default(0), y: z.number().int().min(0).default(0), w: z.number().int().min(1).max(12).default(4), h: z.number().int().min(1).max(8).default(2) }).default({}),
});
export type CreateDashboardInput = z.infer<typeof createDashboardSchema>;
export type CreateWidgetDefInput = z.infer<typeof createWidgetDefSchema>;
export interface DashboardWidgetItem {
  id: string;
  type: (typeof WIDGET_TYPES)[number];
  title: string;
  config: { metric: MetricKey; days: number };
  layout: { x: number; y: number; w: number; h: number };
}
export interface DashboardItem {
  id: string;
  name: string;
  description: string | null;
  isShared: boolean;
  isStarred: boolean;
  createdBy: string | null;
  widgets: DashboardWidgetItem[];
  createdAt: string;
}
export type MetricData =
  | { kind: 'number'; value: number | null; unit?: string }
  | { kind: 'series'; points: Array<{ label: string; value: number }> };

// ------------------------------------------------------------------ Boards
export const createBoardSchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(500).optional().nullable(),
  formId: z.string().uuid().nullable().optional(),
  columns: z.array(z.object({ key: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/), label: z.string().min(1).max(60), color: z.string().max(9).optional() })).min(1).max(12).default([
    { key: 'todo', label: 'To do' },
    { key: 'doing', label: 'In progress' },
    { key: 'done', label: 'Done' },
  ]),
});
export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export const updateBoardSchema = createBoardSchema.partial();
export const createBoardTaskSchema = z.object({
  title: z.string().min(1).max(255),
  columnKey: z.string().max(60).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  data: z.record(z.unknown()).default({}),
});
export type CreateBoardTaskInput = z.infer<typeof createBoardTaskSchema>;
export const updateBoardTaskSchema = createBoardTaskSchema.partial();
export const moveBoardTaskSchema = z.object({ columnKey: z.string().max(60), position: z.number().int().min(0).default(0) });
export const boardTaskCommentSchema = z.object({ body: z.string().min(1).max(2000) });
export interface BoardItem {
  id: string;
  name: string;
  description: string | null;
  formId: string | null;
  columns: Array<{ key: string; label: string; color?: string }>;
  taskCount: number;
  createdAt: string;
}
export interface BoardTaskItem {
  id: string;
  title: string;
  columnKey: string;
  position: number;
  assigneeId: string | null;
  assigneeName: string | null;
  dueAt: string | null;
  leadId: string | null;
  data: Record<string, unknown>;
  commentCount: number;
  overdue: boolean;
}
export interface TaskCommentItem {
  id: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  createdAt: string;
}

// ------------------------------------------------------------------ KB tester
export const kbTestSchema = z.object({ chatbotId: z.string().uuid(), question: z.string().min(2).max(500) });
export interface KbTestResult {
  id: string;
  question: string;
  bestScore: number;
  grounded: boolean;
  results: Array<{ sourceTitle: string; snippet: string; score: number }>;
  createdAt: string;
}
