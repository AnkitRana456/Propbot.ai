import { z } from 'zod';

// ------------------------------------------------------------------ Inbox
export const INBOX_STATUSES = ['bot', 'needs_human', 'open', 'pending', 'resolved', 'closed'] as const;
export type InboxStatus = (typeof INBOX_STATUSES)[number];
export const INBOX_CHANNELS = ['web', 'whatsapp', 'instagram', 'messenger', 'email', 'api', 'voice'] as const;
export const INBOX_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export const inboxQuerySchema = z.object({
  status: z.enum(INBOX_STATUSES).optional(),
  channel: z.string().max(30).optional(),
  /** `me`, `unassigned` or a user id. */
  assignee: z.string().max(40).optional(),
  priority: z.enum(INBOX_PRIORITIES).optional(),
  search: z.string().max(100).optional(),
  tag: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});
export type InboxQuery = z.infer<typeof inboxQuerySchema>;

export const inboxReplySchema = z.object({
  content: z.string().min(1).max(4000),
  /** Approved template to send outside the 24-hour WhatsApp window. */
  templateName: z.string().max(120).optional(),
  templateLanguage: z.string().max(12).optional(),
  mediaUrl: z.string().url().max(1000).optional(),
});
export type InboxReplyInput = z.infer<typeof inboxReplySchema>;

export const inboxUpdateSchema = z.object({
  status: z.enum(INBOX_STATUSES).optional(),
  priority: z.enum(INBOX_PRIORITIES).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(15).optional(),
});
export type InboxUpdateInput = z.infer<typeof inboxUpdateSchema>;

export const inboxNoteSchema = z.object({
  body: z.string().min(1).max(2000),
  mentions: z.array(z.string().uuid()).max(10).default([]),
});
export type InboxNoteInput = z.infer<typeof inboxNoteSchema>;

export interface InboxConversationItem {
  id: string;
  channel: string;
  status: string;
  priority: string;
  tags: string[];
  contactName: string;
  contactPhone: string | null;
  leadId: string | null;
  leadStatus: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  aiPaused: boolean;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastSender: string | null;
  /** Visitor messages since anyone last replied. */
  awaitingReply: number;
  createdAt: string;
}

export interface InboxMessageItem {
  id: string;
  senderType: string;
  senderId: string | null;
  content: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface InboxNoteItem {
  id: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  mentions: string[];
  createdAt: string;
}

export interface InboxConversationDetail extends InboxConversationItem {
  messages: InboxMessageItem[];
  notes: InboxNoteItem[];
  contact: { id: string | null; email: string | null; attributes: Record<string, unknown>; visitCount: number };
  /** WhatsApp only: the free-form reply window closed 24h after the last visitor message. */
  serviceWindowExpired: boolean;
  firstResponseAt: string | null;
}

// ------------------------------------------------------------------ Lead sources
export const LEAD_SOURCE_TYPES = ['generic', 'meta_lead_ads', 'google_ads', '99acres', 'magicbricks', 'housing'] as const;
export type LeadSourceType = (typeof LEAD_SOURCE_TYPES)[number];

export const createLeadSourceSchema = z.object({
  name: z.string().min(2).max(150),
  sourceType: z.enum(LEAD_SOURCE_TYPES).default('generic'),
  /** Incoming field -> `name` | `phone` | `email` | `budget` | `bhk` | `location` | `attribute:<form key>`. */
  fieldMapping: z.record(z.string().max(80)).default({}),
  chatbotId: z.string().uuid().nullable().optional(),
  formId: z.string().uuid().nullable().optional(),
  attribution: z.record(z.string().max(200)).default({}),
});
export type CreateLeadSourceInput = z.infer<typeof createLeadSourceSchema>;

export const updateLeadSourceSchema = createLeadSourceSchema.omit({ sourceType: true }).partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateLeadSourceInput = z.infer<typeof updateLeadSourceSchema>;

export const csvImportSchema = z.object({
  /** Raw CSV text with a header row. */
  csv: z.string().min(5).max(500_000),
});
export type CsvImportInput = z.infer<typeof csvImportSchema>;

export interface LeadSourceItem {
  id: string;
  name: string;
  sourceType: LeadSourceType;
  keyPrefix: string;
  fieldMapping: Record<string, string>;
  chatbotId: string | null;
  formId: string | null;
  attribution: Record<string, string>;
  isActive: boolean;
  totalReceived: number;
  lastReceivedAt: string | null;
  createdAt: string;
}
export interface LeadSourceEventItem {
  id: string;
  status: 'received' | 'processed' | 'duplicate' | 'rejected' | 'failed';
  leadId: string | null;
  error: string | null;
  payload: unknown;
  createdAt: string;
}

// ------------------------------------------------------------------ Channels
export const CONNECTABLE_CHANNELS = ['instagram', 'messenger', 'email', 'api'] as const;
export const createChannelConnectionSchema = z.object({
  channel: z.enum(CONNECTABLE_CHANNELS),
  name: z.string().min(2).max(150),
  externalAccountId: z.string().max(255).optional().nullable(),
  chatbotId: z.string().uuid().nullable().optional(),
  config: z.record(z.unknown()).default({}),
  /** Tokens; stored encrypted and never returned. */
  secrets: z.record(z.string().max(2000)).default({}),
});
export type CreateChannelConnectionInput = z.infer<typeof createChannelConnectionSchema>;
export const updateChannelConnectionSchema = createChannelConnectionSchema.omit({ channel: true }).partial().extend({
  status: z.enum(['connected', 'disconnected']).optional(),
});
export type UpdateChannelConnectionInput = z.infer<typeof updateChannelConnectionSchema>;

export interface ChannelConnectionItem {
  id: string;
  channel: string;
  name: string;
  status: string;
  externalAccountId: string | null;
  chatbotId: string | null;
  config: Record<string, unknown>;
  secretKeys: string[];
  lastError: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

// ------------------------------------------------------------------ Templates
export const templateBodySchema = z.object({
  header: z.string().max(60).optional(),
  body: z.string().min(1).max(1024),
  footer: z.string().max(60).optional(),
  buttons: z.array(z.object({ type: z.enum(['quick_reply', 'url', 'phone']), text: z.string().min(1).max(25), value: z.string().max(500).optional() })).max(3).default([]),
});
export const createTemplateSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]{2,99}$/, 'Lowercase letters, numbers and underscores only'),
  language: z.string().min(2).max(12).default('en'),
  category: z.enum(['marketing', 'utility', 'authentication']).default('utility'),
  content: templateBodySchema,
  /** One example per {{n}} variable, in order. */
  sampleValues: z.array(z.string().max(200)).max(10).default([]),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export const updateTemplateSchema = createTemplateSchema.omit({ name: true, language: true }).partial();
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export interface MessageTemplateItem {
  id: string;
  channel: string;
  name: string;
  language: string;
  category: string;
  content: z.infer<typeof templateBodySchema>;
  sampleValues: string[];
  variableCount: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'paused';
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------------ Widgets
export const widgetNudgeSchema = z.object({
  id: z.string().min(1).max(40),
  message: z.string().min(1).max(200),
  /** Substring of the page URL, e.g. `/pricing`. Empty = every page. */
  urlContains: z.string().max(200).default(''),
  delaySeconds: z.number().int().min(0).max(600).default(15),
});
export const createWidgetSchema = z.object({
  name: z.string().min(2).max(150),
  chatbotId: z.string().uuid().nullable().optional(),
  allowedDomains: z.array(z.string().min(3).max(200)).max(20).default([]),
  styling: z.object({ brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#B84A22'), position: z.enum(['left', 'right']).default('right'), launcherLabel: z.string().max(40).default('Chat with us') }).default({}),
  sections: z.object({ homeTitle: z.string().max(80).default('Hi there'), homeSubtitle: z.string().max(160).default('How can we help you find a home?'), quickActions: z.array(z.string().max(60)).max(6).default([]), showHistory: z.boolean().default(true), showHelpCentre: z.boolean().default(false) }).default({}),
  nudges: z.array(widgetNudgeSchema).max(10).default([]),
});
export type CreateWidgetInput = z.infer<typeof createWidgetSchema>;
export const updateWidgetSchema = createWidgetSchema.partial().extend({ isActive: z.boolean().optional() });
export type UpdateWidgetInput = z.infer<typeof updateWidgetSchema>;

export interface WidgetItem {
  id: string;
  name: string;
  chatbotId: string | null;
  allowedDomains: string[];
  styling: Record<string, unknown>;
  sections: Record<string, unknown>;
  nudges: Array<z.infer<typeof widgetNudgeSchema>>;
  isActive: boolean;
  createdAt: string;
}
