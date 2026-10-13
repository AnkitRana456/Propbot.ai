import { z } from 'zod';

export const analyticsFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  chatbotId: z.string().uuid().optional(),
  period: z.enum(['today', '7d', '30d', '90d', 'custom']).optional().default('30d'),
});
export type AnalyticsFilter = z.infer<typeof analyticsFilterSchema>;

export const metricWithDeltaSchema = z.object({
  current: z.number(),
  previous: z.number(),
  deltaPercent: z.number(),
  unit: z.string().optional(),
});
export type MetricWithDelta = z.infer<typeof metricWithDeltaSchema>;

export const analyticsKpisResponseSchema = z.object({
  totalConversations: metricWithDeltaSchema,
  leadsGenerated: metricWithDeltaSchema,
  conversionRate: metricWithDeltaSchema,
  avgResponseTimeSeconds: metricWithDeltaSchema,
  satisfactionRate: metricWithDeltaSchema,
  activeChatbots: z.number(),
});
export type AnalyticsKpisResponse = z.infer<typeof analyticsKpisResponseSchema>;

// CTA Funnel: Shown -> Clicked -> Started -> Completed -> Failed
export const ctaFunnelItemSchema = z.object({
  stage: z.enum(['shown', 'clicked', 'started', 'completed', 'failed']),
  label: z.string(),
  count: z.number(),
  conversionFromPrevPercent: z.number(),
  conversionFromTopPercent: z.number(),
});
export type CtaFunnelItem = z.infer<typeof ctaFunnelItemSchema>;

export const ctaFunnelResponseSchema = z.object({
  stages: z.array(ctaFunnelItemSchema),
});
export type CtaFunnelResponse = z.infer<typeof ctaFunnelResponseSchema>;

// Real Estate 7-Stage Funnel: Visitor -> Chat -> Lead -> Qualified -> Visit booked -> Visit done -> Booked
export const realEstateFunnelItemSchema = z.object({
  stage: z.enum(['visitor', 'chat', 'lead', 'qualified', 'visit_booked', 'visit_done', 'booked']),
  label: z.string(),
  count: z.number(),
  conversionFromPrevPercent: z.number(),
  conversionFromTopPercent: z.number(),
  dropOffPercent: z.number(),
});
export type RealEstateFunnelItem = z.infer<typeof realEstateFunnelItemSchema>;

export const realEstateFunnelResponseSchema = z.object({
  stages: z.array(realEstateFunnelItemSchema),
});
export type RealEstateFunnelResponse = z.infer<typeof realEstateFunnelResponseSchema>;

// Performance Timeseries
export const performanceDataPointSchema = z.object({
  date: z.string(),
  conversations: z.number(),
  leads: z.number(),
  conversionRate: z.number(),
});
export type PerformanceDataPoint = z.infer<typeof performanceDataPointSchema>;

export const performanceResponseSchema = z.object({
  points: z.array(performanceDataPointSchema),
  channelShare: z.object({
    web: z.number(),
    whatsapp: z.number(),
  }),
});
export type PerformanceResponse = z.infer<typeof performanceResponseSchema>;

// Engagement: Peak hours heatmap, messages per chat, drop-off turns
export const peakHourItemSchema = z.object({
  dayOfWeek: z.number(), // 0 = Sun, 1 = Mon, ..., 6 = Sat
  hour: z.number(), // 0 - 23
  count: z.number(),
});
export type PeakHourItem = z.infer<typeof peakHourItemSchema>;

export const messagesPerChatBucketSchema = z.object({
  bucket: z.string(),
  count: z.number(),
  percentage: z.number(),
});
export type MessagesPerChatBucket = z.infer<typeof messagesPerChatBucketSchema>;

export const dropOffStepSchema = z.object({
  step: z.string(),
  count: z.number(),
  percentage: z.number(),
});
export type DropOffStep = z.infer<typeof dropOffStepSchema>;

export const engagementResponseSchema = z.object({
  heatmap: z.array(peakHourItemSchema),
  messagesPerChat: z.array(messagesPerChatBucketSchema),
  dropOffSteps: z.array(dropOffStepSchema),
});
export type EngagementResponse = z.infer<typeof engagementResponseSchema>;

// Top Queries
export const queryClusterSchema = z.object({
  theme: z.string(),
  count: z.number(),
  sampleQueries: z.array(z.string()),
});
export type QueryCluster = z.infer<typeof queryClusterSchema>;

export const unansweredQuerySchema = z.object({
  id: z.string(),
  query: z.string(),
  askedAt: z.string(),
  confidence: z.number().optional(),
  chatbotName: z.string().optional(),
});
export type UnansweredQuery = z.infer<typeof unansweredQuerySchema>;

export const topQueriesResponseSchema = z.object({
  clusters: z.array(queryClusterSchema),
  unanswered: z.array(unansweredQuerySchema),
});
export type TopQueriesResponse = z.infer<typeof topQueriesResponseSchema>;

// Real Estate Insights
export const leadQualityItemSchema = z.object({
  category: z.string(),
  name: z.string(),
  leadsCount: z.number(),
  qualifiedCount: z.number(),
  visitsCount: z.number(),
  conversionRate: z.number(),
  spend: z.number().optional(),
  costPerLead: z.number().optional(),
});
export type LeadQualityItem = z.infer<typeof leadQualityItemSchema>;

export const demandDistributionItemSchema = z.object({
  label: z.string(),
  count: z.number(),
  percentage: z.number(),
});
export type DemandDistributionItem = z.infer<typeof demandDistributionItemSchema>;

export const objectionItemSchema = z.object({
  objection: z.string(),
  count: z.number(),
  percentage: z.number(),
});
export type ObjectionItem = z.infer<typeof objectionItemSchema>;

export const responseTimeCohortSchema = z.object({
  bucket: z.string(),
  leadsCount: z.number(),
  conversionRate: z.number(),
});
export type ResponseTimeCohort = z.infer<typeof responseTimeCohortSchema>;

export const realEstateInsightsResponseSchema = z.object({
  leadQualityBySource: z.array(leadQualityItemSchema),
  leadQualityByProject: z.array(leadQualityItemSchema),
  leadQualityByCampaign: z.array(leadQualityItemSchema),
  demandByLocality: z.array(demandDistributionItemSchema),
  demandByBhk: z.array(demandDistributionItemSchema),
  demandByBudget: z.array(demandDistributionItemSchema),
  mostAskedObjections: z.array(objectionItemSchema),
  responseTimeVsConversion: z.array(responseTimeCohortSchema),
  speedToLeadMinutes: z.object({
    average: z.number(),
    median: z.number(),
    slaBreachRate: z.number(),
  }),
});
export type RealEstateInsightsResponse = z.infer<typeof realEstateInsightsResponseSchema>;

// AI Cost & Quality Panel
export const aiQualityResponseSchema = z.object({
  llmCostTotal: z.number(),
  llmCostPerLead: z.number(),
  totalTokensUsed: z.number(),
  approvalQueueStats: z.object({
    proposed: z.number(),
    approved: z.number(),
    rejected: z.number(),
    pending: z.number(),
  }),
  evalAccuracyTrend: z.array(
    z.object({
      runDate: z.string(),
      accuracyPercent: z.number(),
      hallucinationRatePercent: z.number(),
    }),
  ),
});
export type AiQualityResponse = z.infer<typeof aiQualityResponseSchema>;

// Attribution
export const attributionItemSchema = z.object({
  campaign: z.string(),
  source: z.string(),
  medium: z.string().optional(),
  visitors: z.number(),
  leads: z.number(),
  visitsBooked: z.number(),
  dealsClosed: z.number(),
  conversionRate: z.number(),
  spend: z.number().optional(),
  costPerLead: z.number().optional(),
});
export type AttributionItem = z.infer<typeof attributionItemSchema>;

export const attributionResponseSchema = z.object({
  model: z.enum(['first_touch', 'last_touch', 'linear']),
  campaigns: z.array(attributionItemSchema),
});
export type AttributionResponse = z.infer<typeof attributionResponseSchema>;

// Forecast
export const forecastPointSchema = z.object({
  date: z.string(),
  predictedValue: z.number(),
  confidenceLower: z.number(),
  confidenceUpper: z.number(),
  isEstimate: z.boolean().default(true),
});
export type ForecastPoint = z.infer<typeof forecastPointSchema>;

export const forecastResponseSchema = z.object({
  metric: z.enum(['conversations', 'leads']),
  historicalDaysUsed: z.number(),
  isEstimate: z.literal(true),
  methodology: z.string(),
  points: z.array(forecastPointSchema),
  projectedTotal: z.number(),
});
export type ForecastResponse = z.infer<typeof forecastResponseSchema>;

// Campaign Spends
export const createCampaignSpendSchema = z.object({
  campaignName: z.string().min(1, 'Campaign name is required'),
  source: z.string().min(1, 'Source is required'),
  spendAmount: z.number().min(0, 'Spend must be non-negative'),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD required'),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD required'),
});
export type CreateCampaignSpendInput = z.infer<typeof createCampaignSpendSchema>;

export const campaignSpendItemSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  campaignName: z.string(),
  source: z.string(),
  spendAmount: z.number(),
  periodStart: z.string(),
  periodEnd: z.string(),
  createdAt: z.string(),
});
export type CampaignSpendItem = z.infer<typeof campaignSpendItemSchema>;
