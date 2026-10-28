import { z } from 'zod';
import { nextBestActionItemSchema } from './actions.js';

export const leadStatusEnum = z.enum([
  'new',
  'contacted',
  'qualified',
  'site_visit_scheduled',
  'site_visit_done',
  'negotiation',
  'booked',
  'converted',
  'lost',
]);
export type LeadStatus = z.infer<typeof leadStatusEnum>;

export const leadPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
export type LeadPriority = z.infer<typeof leadPriorityEnum>;

export const intentLabelEnum = z.enum(['cold', 'warm', 'hot']);
export type IntentLabel = z.infer<typeof intentLabelEnum>;

// Buyer DNA Schema (15 exact fields specified by PDF)
export const buyerDnaSchema = z.object({
  budgetMin: z.number().nullable().default(null),
  budgetMax: z.number().nullable().default(null),
  bhk: z.array(z.string()).default([]),
  localities: z.array(z.string()).default([]),
  propertyType: z.string().nullable().default(null),
  purpose: z.string().nullable().default(null), // 'end_use' | 'investment' | 'rental'
  timeline: z.string().nullable().default(null), // 'immediate' | '3_months' | '6_months' | '1_year' | 'flexible'
  financing: z.string().nullable().default(null), // 'self_funded' | 'bank_loan' | 'pre_approved'
  familySize: z.number().int().positive().nullable().default(null),
  mustHaves: z.array(z.string()).default([]),
  dealBreakers: z.array(z.string()).default([]),
  objections: z.array(z.string()).default([]),
  competitorsMentioned: z.array(z.string()).default([]),
  language: z.string().default('en'),
  confidence: z.record(z.number().min(0).max(1)).default({}),
  explicitFields: z.array(z.string()).default([]),
});
export type BuyerDna = z.infer<typeof buyerDnaSchema>;

export const scoreHistoryItemSchema = z.object({
  score: z.number().min(0).max(100),
  delta: z.number(),
  reason: z.string(),
  timestamp: z.string(),
});
export type ScoreHistoryItem = z.infer<typeof scoreHistoryItemSchema>;

export const handoffBriefSchema = z.object({
  summary: z.string(),
  buyerDnaSummary: z.string(),
  objectionsAndCompetitors: z.array(z.string()),
  matchingProperties: z.array(z.string()).default([]),
  suggestedOpeningLine: z.string(),
  nextBestAction: z.string(),
  generatedAt: z.string(),
});
export type HandoffBrief = z.infer<typeof handoffBriefSchema>;

export const duplicateMergeSuggestionSchema = z.object({
  existingContactId: z.string().uuid(),
  existingLeadId: z.string().uuid(),
  matchingField: z.enum(['phone', 'email']),
  matchingValue: z.string(),
  conflictFields: z.array(z.string()).default([]),
  suggestedAction: z.string(),
});
export type DuplicateMergeSuggestion = z.infer<typeof duplicateMergeSuggestionSchema>;

export const scoringConfigSchema = z.object({
  thresholds: z
    .object({
      coldMax: z.number().default(34),
      warmMin: z.number().default(35),
      warmMax: z.number().default(69),
      hotMin: z.number().default(70),
    })
    .default({
      coldMax: 34,
      warmMin: 35,
      warmMax: 69,
      hotMin: 70,
    }),
  weights: z
    .object({
      requestedSiteVisit: z.number().default(25),
      sharedPhone: z.number().default(20),
      askedPricePaymentPlan: z.number().default(15),
      budgetFitInventory: z.number().default(15),
      urgencyWords: z.number().default(15),
      viewedShortlistRoom: z.number().default(15),
      askedPossessionDate: z.number().default(10),
      returnedToChat: z.number().default(10),
      messagesDepth5: z.number().default(5),
      messagesDepth10: z.number().default(5),
      sentimentPositive: z.number().default(5),
      timeOnPage: z.number().default(5),
      brokerCasualDeduction: z.number().default(-25),
    })
    .default({
      requestedSiteVisit: 25,
      sharedPhone: 20,
      askedPricePaymentPlan: 15,
      budgetFitInventory: 15,
      urgencyWords: 15,
      viewedShortlistRoom: 15,
      askedPossessionDate: 10,
      returnedToChat: 10,
      messagesDepth5: 5,
      messagesDepth10: 5,
      sentimentPositive: 5,
      timeOnPage: 5,
      brokerCasualDeduction: -25,
    }),
});
export type ScoringConfig = z.infer<typeof scoringConfigSchema>;

// Lead capture input from chat/widget
export const captureLeadInputSchema = z.object({
  chatbotId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().min(7, 'Valid phone number is required').max(30),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  budget: z.string().optional(),
  bhk: z.string().optional(),
  location: z.string().optional(),
  purpose: z.string().optional(),
  timeline: z.string().optional(),
  loanNeed: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
  /** Attribution captured by the widget (utm_source ... utm_agencypartner). */
  utmParams: z.record(z.string()).optional(),
  ipAddress: z.string().max(64).optional(),
  userAgent: z.string().max(500).optional(),
  referrerUrl: z.string().max(500).optional(),
  landingPage: z.string().max(500).optional(),
  /** Defaults to "chat". Other values: brochure_download, whatsapp, ... */
  source: z.string().max(100).optional(),
  /** Keep the stored name when the lead already exists (e.g. a WhatsApp placeholder must not overwrite a real name). */
  preserveName: z.boolean().optional(),
});
export type CaptureLeadInput = z.infer<typeof captureLeadInputSchema>;

export const updateLeadStatusInputSchema = z
  .object({
    status: leadStatusEnum,
    lostReason: z.string().optional(),
  })
  .refine(
    data => {
      if (data.status === 'lost' && (!data.lostReason || !data.lostReason.trim())) {
        return false;
      }
      return true;
    },
    {
      message: 'Lost reason is required when marking a lead as lost',
      path: ['lostReason'],
    },
  );
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusInputSchema>;

/** Inline edits from the leads grid. Every field is optional but at least one must be present. */
export const updateLeadInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100).optional(),
    phone: z.string().min(7, 'Valid phone number is required').max(30).optional(),
    email: z.string().email('Invalid email address').or(z.literal('')).optional(),
    /** Upper budget in rupees; null clears it. */
    budgetMax: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
    nextFollowUpAt: z.string().datetime().nullable().optional(),
  })
  .refine(v => Object.keys(v).length > 0, { message: 'Nothing to update' });
export type UpdateLeadInput = z.infer<typeof updateLeadInputSchema>;

export const mergeLeadInputSchema = z.object({
  sourceLeadId: z.string().uuid(),
  targetLeadId: z.string().uuid(),
});
export type MergeLeadInput = z.infer<typeof mergeLeadInputSchema>;

export const leadItemResponseSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  contactId: z.string().uuid(),
  chatbotId: z.string().uuid().nullable().optional(),
  conversationId: z.string().uuid().nullable().optional(),
  assignedAgentId: z.string().uuid().nullable().optional(),
  assignedAgentName: z.string().nullable().optional(),
  name: z.string(),
  firstName: z.string(),
  lastName: z.string().nullable().optional(),
  phone: z.string(),
  email: z.string().nullable().optional(),
  status: leadStatusEnum,
  lostReason: z.string().nullable().optional(),
  priority: leadPriorityEnum,
  intentScore: z.number().min(0).max(100),
  intentLabel: intentLabelEnum,
  scoreExplanation: z.array(z.string()),
  scoreHistory: z.array(scoreHistoryItemSchema).optional(),
  buyerDna: buyerDnaSchema,
  handoffBrief: handoffBriefSchema.nullable().optional(),
  nextBestAction: nextBestActionItemSchema.nullable().optional(),
  duplicateMergeSuggestion: duplicateMergeSuggestionSchema.nullable().optional(),
  phoneVerified: z.boolean(),
  tags: z.array(z.string()).default([]),
  pageUrl: z.string().nullable().optional(),
  nextFollowUpAt: z.string().nullable().optional(),
  source: z.string(),
  slaStartedAt: z.string().nullable().optional(),
  slaBreachedAt: z.string().nullable().optional(),
  utmParams: z.record(z.unknown()).nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  deviceType: z.string().nullable().optional(),
  osName: z.string().nullable().optional(),
  browserName: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  referrerUrl: z.string().nullable().optional(),
  landingPage: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LeadItemResponse = z.infer<typeof leadItemResponseSchema>;

export const leadsListResponseSchema = z.object({
  items: z.array(leadItemResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});
export type LeadsListResponse = z.infer<typeof leadsListResponseSchema>;
