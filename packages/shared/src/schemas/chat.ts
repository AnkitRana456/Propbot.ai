import { z } from 'zod';
import { ragCitationSchema } from './knowledge.js';

export const visitorDeviceSchema = z.object({
  browser: z.string().optional(),
  os: z.string().optional(),
  deviceType: z.enum(['mobile', 'tablet', 'desktop']).default('desktop'),
  screenResolution: z.string().optional(),
});
export type VisitorDevice = z.infer<typeof visitorDeviceSchema>;

export const utmParamsSchema = z.object({
  source: z.string().optional(),
  medium: z.string().optional(),
  campaign: z.string().optional(),
  term: z.string().optional(),
  content: z.string().optional(),
});
export type UtmParams = z.infer<typeof utmParamsSchema>;

// 1. Session creation & resumption
export const createSessionSchema = z.object({
  visitorId: z.string().min(5).max(100),
  pageUrl: z.string().url().optional(),
  referrer: z.string().optional(),
  utmParams: utmParamsSchema.optional(),
  device: visitorDeviceSchema.optional(),
  consentGiven: z.boolean().default(true),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const sessionResponseSchema = z.object({
  sessionToken: z.string(),
  conversationId: z.string().uuid(),
  chatbotId: z.string().uuid(),
  isNewSession: z.boolean(),
  status: z.enum(['bot', 'agent', 'closed']),
  assignedAgentName: z.string().nullable().optional(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

// 2. Public Chatbot Config (Safe to expose on client)
export const publicChatbotConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['web', 'whatsapp']),
  status: z.enum(['active', 'paused', 'draft']),
  appearance: z.object({
    primaryColor: z.string(),
    textColor: z.string().optional(),
    backgroundColor: z.string().optional(),
    headerColor: z.string().optional(),
    borderRadius: z.number(),
    position: z.enum(['bottom-right', 'bottom-left']),
    botName: z.string(),
    botAvatarUrl: z.string().optional(),
    companyLogoUrl: z.string().optional(),
    themeMode: z.enum(['light', 'dark']).default('light'),
  }),
  behavior: z.object({
    greetingMessage: z.string(),
    quickQuestions: z.array(z.string()),
    tone: z.string().optional(),
    defaultLanguage: z.string().default('en'),
  }),
  businessHours: z.object({
    enabled: z.boolean().default(false),
    isCurrentlyOpen: z.boolean().default(true),
    offlineMessage: z.string().optional(),
  }).optional(),
});
export type PublicChatbotConfigResponse = z.infer<typeof publicChatbotConfigSchema>;

// 3. Send Message
export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  sessionToken: z.string().min(10),
  message: z.string().min(1, 'Message cannot be empty').max(1000, 'Message cannot exceed 1000 characters'),
  projectContext: z.string().optional(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// 4. Message History Item
export const chatMessageItemSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderType: z.enum(['visitor', 'bot', 'agent', 'system']),
  senderId: z.string().nullable().optional(),
  content: z.string(),
  citations: z.array(ragCitationSchema).optional(),
  isGrounded: z.boolean().optional(),
  createdAt: z.string().or(z.date()),
});
export type ChatMessageItem = z.infer<typeof chatMessageItemSchema>;

export const chatHistoryResponseSchema = z.object({
  conversationId: z.string().uuid(),
  status: z.enum(['bot', 'agent', 'closed']),
  messages: z.array(chatMessageItemSchema),
});
export type ChatHistoryResponse = z.infer<typeof chatHistoryResponseSchema>;

// 5. Visitor Feedback
export const chatFeedbackSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid().optional(),
  rating: z.enum(['positive', 'negative']),
  comment: z.string().max(500).optional(),
});
export type ChatFeedbackInput = z.infer<typeof chatFeedbackSchema>;

// 6. Widget Interaction Event
export const widgetEventSchema = z.object({
  conversationId: z.string().uuid().optional(),
  visitorId: z.string().min(5),
  eventType: z.enum([
    'widget_open',
    'widget_close',
    'page_view',
    'quick_reply_click',
    'cta_click',
    'brochure_click',
    'property_view',
    'exit_intent_trigger',
  ]),
  eventData: z.record(z.unknown()).default({}),
  pageUrl: z.string().optional(),
});
export type WidgetEventInput = z.infer<typeof widgetEventSchema>;
