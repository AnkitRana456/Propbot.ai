import { z } from 'zod';

export const chatbotTypeEnum = z.enum(['web', 'whatsapp']);
export type ChatbotType = z.infer<typeof chatbotTypeEnum>;

export const chatbotStatusEnum = z.enum(['draft', 'active', 'paused']);
export type ChatbotStatus = z.infer<typeof chatbotStatusEnum>;

export const widgetPositionEnum = z.enum(['bottom-right', 'bottom-left']);
export type WidgetPosition = z.infer<typeof widgetPositionEnum>;

export const chatbotToneEnum = z.enum(['professional', 'friendly', 'luxury', 'casual']);
export type ChatbotTone = z.infer<typeof chatbotToneEnum>;

export const leadCaptureFieldSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'email', 'phone', 'select']),
  required: z.boolean().default(true),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});
export type LeadCaptureField = z.infer<typeof leadCaptureFieldSchema>;

export const businessDaySchema = z.object({
  day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  enabled: z.boolean().default(true),
  start: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format HH:MM')
    .default('09:00'),
  end: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format HH:MM')
    .default('18:00'),
});
export type BusinessDay = z.infer<typeof businessDaySchema>;

export const brochureItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  propertyName: z.string().optional(),
});
export type BrochureItem = z.infer<typeof brochureItemSchema>;

export const appearanceConfigSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}){1,2}$/, 'Invalid hex color')
    .default('#059669'),
  textColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}){1,2}$/, 'Invalid hex color')
    .default('#ffffff'),
  backgroundColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}){1,2}$/, 'Invalid hex color')
    .default('#ffffff'),
  headerColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}){1,2}$/, 'Invalid hex color')
    .default('#0f172a'),
  borderRadius: z.number().int().min(0).max(32).default(16),
  position: widgetPositionEnum.default('bottom-right'),
  botName: z.string().min(1).max(100).default('Property Advisor AI'),
  botAvatarUrl: z.string().url().or(z.literal('')).optional(),
  companyLogoUrl: z.string().url().or(z.literal('')).optional(),
  themeMode: z.enum(['light', 'dark', 'auto']).default('light'),
});
export type AppearanceConfig = z.infer<typeof appearanceConfigSchema>;

export const behaviorConfigSchema = z.object({
  systemPrompt: z
    .string()
    .max(2000)
    .default(
      'You are a professional real estate assistant helping visitors explore properties, schedule visits, and answer pricing inquiries.',
    ),
  tone: chatbotToneEnum.default('luxury'),
  defaultLanguage: z.string().min(2).max(10).default('en'),
  supportedLanguages: z
    .array(z.string())
    .default(['en', 'hi', 'hi-Latn', 'mr', 'ta', 'te', 'kn', 'bn', 'gu', 'ar']),
  temperature: z.number().min(0).max(1).default(0.7),
  greetingMessage: z
    .string()
    .min(1)
    .max(500)
    .default(
      'Hello! Welcome to our luxury real estate showcase. How can I help you find your dream property today?',
    ),
  quickQuestions: z
    .array(z.string().min(1).max(120))
    .max(6)
    .default([
      'Explore featured villas',
      'Schedule a private site visit',
      'Download pricing & brochure',
      'Check payment plan options',
    ]),
  translatableStrings: z
    .record(z.string(), z.record(z.string(), z.string()))
    .default({
      hi: {
        greetingMessage:
          'नमस्ते! हमारे लग्जरी रियल एस्टेट शोकेस में आपका स्वागत है। आज मैं आपके सपनों का घर खोजने में आपकी क्या मदद कर सकता हूँ?',
        connectButton: 'सलाहकार से बात करें',
      },
      'hi-Latn': {
        greetingMessage:
          'Namaste! Welcome to our luxury real estate showcase. Aaj main aapke dream home ko dhoondhne mein kya madad kar sakta hoon?',
        connectButton: 'Advisor se baat karein',
      },
    }),
});
export type BehaviorConfig = z.infer<typeof behaviorConfigSchema>;

export const leadCaptureConfigSchema = z.object({
  enabled: z.boolean().default(true),
  triggerAfterMessages: z.number().int().min(1).max(20).default(2),
  title: z.string().min(1).max(120).default('Connect with a Property Consultant'),
  subtitle: z
    .string()
    .max(250)
    .default(
      'Share your contact info to receive detailed floor plans and private viewing appointments.',
    ),
  fields: z.array(leadCaptureFieldSchema).default([
    {
      id: 'f1',
      name: 'fullName',
      label: 'Full Name',
      type: 'text',
      required: true,
      placeholder: 'John Doe',
    },
    {
      id: 'f2',
      name: 'email',
      label: 'Email Address',
      type: 'email',
      required: true,
      placeholder: 'john@example.com',
    },
    {
      id: 'f3',
      name: 'phone',
      label: 'Phone Number',
      type: 'phone',
      required: true,
      placeholder: '+1 (555) 000-0000',
    },
  ]),
});
export type LeadCaptureConfig = z.infer<typeof leadCaptureConfigSchema>;

export const businessHoursConfigSchema = z.object({
  enabled: z.boolean().default(false),
  timezone: z.string().default('Asia/Kolkata'),
  schedule: z.array(businessDaySchema).default([
    { day: 'mon', enabled: true, start: '09:00', end: '19:00' },
    { day: 'tue', enabled: true, start: '09:00', end: '19:00' },
    { day: 'wed', enabled: true, start: '09:00', end: '19:00' },
    { day: 'thu', enabled: true, start: '09:00', end: '19:00' },
    { day: 'fri', enabled: true, start: '09:00', end: '19:00' },
    { day: 'sat', enabled: true, start: '10:00', end: '17:00' },
    { day: 'sun', enabled: false, start: '10:00', end: '17:00' },
  ]),
  offlineMessage: z
    .string()
    .max(500)
    .default(
      'Our sales office is currently closed. Leave your contact info and our property advisor will connect with you first thing tomorrow!',
    ),
  fallbackEmail: z.string().email().or(z.literal('')).optional(),
  fallbackPhone: z.string().max(50).or(z.literal('')).optional(),
});
export type BusinessHoursConfig = z.infer<typeof businessHoursConfigSchema>;

export const wizardDraftSchema = z.object({
  currentStep: z.number().int().min(1).max(8).default(1),
  isCompleted: z.boolean().default(false),
});
export type WizardDraft = z.infer<typeof wizardDraftSchema>;

export const chatbotConfigSchema = z.object({
  description: z.string().max(500).default(''),
  appearance: appearanceConfigSchema.default({}),
  behavior: behaviorConfigSchema.default({}),
  leadCapture: leadCaptureConfigSchema.default({}),
  businessHours: businessHoursConfigSchema.default({}),
  brochures: z.array(brochureItemSchema).default([]),
  wizardDraft: wizardDraftSchema.default({}),
});
export type ChatbotConfig = z.infer<typeof chatbotConfigSchema>;

// DTO Schemas

export const createChatbotSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(255),
  type: chatbotTypeEnum.default('web'),
  status: chatbotStatusEnum.default('draft'),
  allowedDomains: z.array(z.string().min(1)).default([]),
  config: chatbotConfigSchema.partial().default({}),
});
export type CreateChatbotInput = z.infer<typeof createChatbotSchema>;

export const updateChatbotSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  type: chatbotTypeEnum.optional(),
  status: chatbotStatusEnum.optional(),
  allowedDomains: z.array(z.string()).optional(),
  config: chatbotConfigSchema.partial().optional(),
});
export type UpdateChatbotInput = z.infer<typeof updateChatbotSchema>;

export const updateChatbotStatusSchema = z.object({
  status: chatbotStatusEnum,
});
export type UpdateChatbotStatusInput = z.infer<typeof updateChatbotStatusSchema>;

export const chatbotResponseSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string(),
  type: chatbotTypeEnum,
  status: chatbotStatusEnum,
  publicKey: z.string(),
  config: chatbotConfigSchema,
  allowedDomains: z.array(z.string()),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
  deletedAt: z.string().or(z.date()).nullable().optional(),
  leadsCount: z.number().int().optional(),
  conversationsCount: z.number().int().optional(),
});
export type ChatbotResponse = z.infer<typeof chatbotResponseSchema>;

export const chatbotsListResponseSchema = z.object({
  chatbots: z.array(chatbotResponseSchema),
  total: z.number().int(),
});
export type ChatbotsListResponse = z.infer<typeof chatbotsListResponseSchema>;
