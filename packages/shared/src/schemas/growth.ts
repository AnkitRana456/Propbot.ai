import { z } from 'zod';

// ==========================================
// 1. Segments Schemas
// ==========================================

export const segmentFilterCriteriaSchema = z.object({
  intentLabels: z.array(z.enum(['hot', 'warm', 'cold'])).optional(),
  minIntentScore: z.number().min(0).max(100).optional(),
  maxIntentScore: z.number().min(0).max(100).optional(),
  statuses: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  projectId: z.string().uuid().optional(),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
  bhk: z.array(z.number()).optional(),
  lastActiveDays: z.number().min(1).optional(),
});

export const createSegmentRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  filterCriteria: segmentFilterCriteriaSchema,
});

export const updateSegmentRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  filterCriteria: segmentFilterCriteriaSchema.optional(),
});

export const previewSegmentCountRequestSchema = z.object({
  filterCriteria: segmentFilterCriteriaSchema,
});

// ==========================================
// 2. Campaigns Schemas
// ==========================================

export const campaignChannelSchema = z.enum(['whatsapp', 'email', 'sms']);
export const campaignStatusSchema = z.enum(['draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled']);

export const campaignMessageVariantSchema = z.object({
  subject: z.string().optional(),
  templateName: z.string().optional(),
  body: z.string().min(1),
});

export const createCampaignRequestSchema = z.object({
  name: z.string().min(1).max(255),
  segmentId: z.string().uuid().optional(),
  channel: campaignChannelSchema.default('whatsapp'),
  scheduleType: z.enum(['immediate', 'scheduled', 'drip']).default('immediate'),
  sendWindowStart: z.string().default('09:00'),
  sendWindowEnd: z.string().default('20:00'),
  frequencyCap: z.number().int().min(1).max(10).default(2),
  variantA: campaignMessageVariantSchema,
  variantB: campaignMessageVariantSchema.optional(),
  aBTestEnabled: z.boolean().default(false),
  scheduledAt: z.string().datetime().optional(),
});

// ==========================================
// 3. Ask Your Pipeline Schemas
// ==========================================

export const leadCitationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string().optional(),
  email: z.string().optional(),
  intentScore: z.number(),
  intentLabel: z.string(),
  status: z.string(),
  stage: z.string().optional(),
  score: z.number().optional(),
  lastContactedAt: z.string().nullable().optional(),
});

export const askPipelineRequestSchema = z
  .object({
    question: z.string().max(1000).optional(),
    query: z.string().max(1000).optional(),
  })
  .refine(
    (data) => Boolean((data.question && data.question.trim().length > 0) || (data.query && data.query.trim().length > 0)),
    {
      message: 'Please provide a valid question or query for your pipeline.',
    },
  )
  .transform((data) => {
    const text = (data.question?.trim() || data.query?.trim())!;
    return {
      question: text,
      query: text,
    };
  });

export const askPipelineResponseSchema = z.object({
  answer: z.string(),
  toolUsed: z.string(),
  citations: z.array(leadCitationSchema),
});

// ==========================================
// 4. Booking Payments Schemas
// ==========================================

export const bookingPaymentProviderSchema = z.enum(['razorpay', 'stripe', 'mock']);

export const createBookingPaymentLinkRequestSchema = z.object({
  leadId: z.string().uuid(),
  unitId: z.string().min(1).max(100).optional(),
  projectId: z.string().uuid().optional(),
  amount: z.number().positive(),
  currency: z.string().default('INR'),
  provider: bookingPaymentProviderSchema.default('razorpay'),
  notes: z.string().max(500).optional(),
});

// ==========================================
// 5. RERA-Aware Marketing Copy Schemas
// ==========================================

export const generateReraCopyRequestSchema = z.object({
  projectId: z.string().uuid(),
  platform: z.enum(['whatsapp', 'meta_ads', 'google_ads', 'email']),
  targetAudience: z.string().optional(),
  focusAspects: z.array(z.string()).optional(), // e.g. ["amenities", "location", "payment_plan"]
});

export const generateReraCopyResponseSchema = z.object({
  headline: z.string(),
  body: z.string(),
  callToAction: z.string(),
  reraNumber: z.string(),
  complianceFlags: z.array(z.string()),
  isCompliant: z.boolean(),
  requiresReview: z.boolean(),
});

// Types export
export type SegmentFilterCriteria = z.infer<typeof segmentFilterCriteriaSchema>;
export type CreateSegmentRequest = z.infer<typeof createSegmentRequestSchema>;
export type CreateCampaignRequest = z.infer<typeof createCampaignRequestSchema>;
export type AskPipelineRequest = z.infer<typeof askPipelineRequestSchema>;
export type AskPipelineResponse = z.infer<typeof askPipelineResponseSchema>;
export type CreateBookingPaymentLinkRequest = z.infer<typeof createBookingPaymentLinkRequestSchema>;
export type GenerateReraCopyRequest = z.infer<typeof generateReraCopyRequestSchema>;
export type GenerateReraCopyResponse = z.infer<typeof generateReraCopyResponseSchema>;
export type LeadCitation = z.infer<typeof leadCitationSchema>;
