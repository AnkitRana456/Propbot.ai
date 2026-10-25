import { z } from 'zod';

export const whatsappConfigStatusSchema = z.enum(['connected', 'disconnected', 'pending']);
export type WhatsappConfigStatus = z.infer<typeof whatsappConfigStatusSchema>;

export const whatsappAutomationSettingsSchema = z.object({
  enableAutomation: z.boolean().default(true),
  aiAutoReplies: z.boolean().default(true),
  pauseAfterAgentReply: z.boolean().default(true),
  frustrationHandoff: z.boolean().default(true),
  autoAssignOwner: z.boolean().default(true),
  handoffKeywords: z.array(z.string()).default(['agent', 'human', 'representative', 'complaint']),
  handoffMessage: z
    .string()
    .default('A property advisor will continue this conversation shortly.'),
});
export type WhatsappAutomationSettings = z.infer<typeof whatsappAutomationSettingsSchema>;

export const metaCredentialsSchema = z.object({
  phoneNumberId: z.string().min(1, 'Phone Number ID is required'),
  businessPhoneNumber: z.string().min(1, 'Business WhatsApp Number is required'),
  accessToken: z.string().min(1, 'Permanent Access Token is required'),
  appSecret: z.string().optional(),
  templateName: z.string().default('property_inquiry_details'),
  chatbotId: z.string().uuid().nullable().optional(),
  verifyToken: z.string().optional(),
});
export type MetaCredentials = z.infer<typeof metaCredentialsSchema>;

export const updateWhatsappConfigSchema = z.object({
  chatbotId: z.string().uuid().nullable().optional(),
  phoneNumberId: z.string().min(1, 'Phone Number ID is required'),
  /** WhatsApp Business Account ID, needed to send message templates for review. */
  businessAccountId: z.string().trim().max(64).optional(),
  businessPhoneNumber: z.string().min(1, 'Business WhatsApp Number is required'),
  accessToken: z.string().min(1, 'Access Token is required'),
  appSecret: z.string().optional(),
  templateName: z.string().min(1, 'Template name is required'),
  enableAutomation: z.boolean().default(true),
  aiAutoReplies: z.boolean().default(true),
  pauseAfterAgentReply: z.boolean().default(true),
  frustrationHandoff: z.boolean().default(true),
  autoAssignOwner: z.boolean().default(true),
  handoffKeywords: z.array(z.string()).default(['agent', 'human', 'representative', 'complaint']),
  handoffMessage: z.string().min(1, 'Handoff message is required'),
});
export type UpdateWhatsappConfigInput = z.infer<typeof updateWhatsappConfigSchema>;

export const whatsappConfigResponseSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  chatbotId: z.string().uuid().nullable().optional(),
  chatbotName: z.string().nullable().optional(),
  phoneNumberId: z.string().nullable().optional(),
  businessAccountId: z.string().nullable().optional(),
  businessPhoneNumber: z.string().nullable().optional(),
  maskedAccessToken: z.string().nullable().optional(),
  hasAppSecret: z.boolean(),
  verifyToken: z.string(),
  callbackUrl: z.string(),
  templateName: z.string().nullable().optional(),
  enableAutomation: z.boolean(),
  aiAutoReplies: z.boolean(),
  pauseAfterAgentReply: z.boolean(),
  frustrationHandoff: z.boolean(),
  autoAssignOwner: z.boolean(),
  handoffKeywords: z.array(z.string()),
  handoffMessage: z.string(),
  status: whatsappConfigStatusSchema,
  updatedAt: z.string(),
});
export type WhatsappConfigResponse = z.infer<typeof whatsappConfigResponseSchema>;

export const whatsappOverviewKpiSchema = z.object({
  messagesToday: z.number().int().nonnegative(),
  aiResolutionRate: z.number().min(0).max(100),
  handoffsCount: z.number().int().nonnegative(),
  avgFirstResponseSeconds: z.number().nonnegative(),
  activeConversations: z.number().int().nonnegative(),
  totalConnectedNumbers: z.number().int().nonnegative(),
});
export type WhatsappOverviewKpi = z.infer<typeof whatsappOverviewKpiSchema>;

export const whatsappConversationFilterTabSchema = z.enum([
  'all',
  'mine',
  'unassigned',
  'ai_handled',
  'needs_human',
  'closed',
]);
export type WhatsappConversationFilterTab = z.infer<typeof whatsappConversationFilterTabSchema>;

export const whatsappConversationFilterSchema = z.object({
  tab: whatsappConversationFilterTabSchema.optional().default('all'),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});
export type WhatsappConversationFilter = z.infer<typeof whatsappConversationFilterSchema>;

export const sendInboxMessageSchema = z.object({
  content: z.string().min(1, 'Message content cannot be empty'),
  templateName: z.string().optional(),
  mediaUrl: z.string().url().optional(),
});
export type SendInboxMessageInput = z.infer<typeof sendInboxMessageSchema>;

export const broadcastCampaignSchema = z.object({
  name: z.string().min(2, 'Campaign name must be at least 2 characters'),
  templateName: z.string().min(1, 'Approved template name is required'),
  segment: z
    .object({
      minIntentScore: z.number().min(0).max(100).optional(),
      status: z.string().optional(),
      city: z.string().optional(),
    })
    .default({}),
});
export type BroadcastCampaignInput = z.infer<typeof broadcastCampaignSchema>;
