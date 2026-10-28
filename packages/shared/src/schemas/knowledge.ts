import { z } from 'zod';

export const knowledgeSourceTypeEnum = z.enum(['text', 'file', 'url', 'qa', 'property']);
export type KnowledgeSourceType = z.infer<typeof knowledgeSourceTypeEnum>;

export const knowledgeSourceStatusEnum = z.enum(['queued', 'processing', 'ready', 'failed']);
export type KnowledgeSourceStatus = z.infer<typeof knowledgeSourceStatusEnum>;

export const qaPairSchema = z.object({
  question: z.string().min(3, 'Question must be at least 3 characters'),
  answer: z.string().min(2, 'Answer must be at least 2 characters'),
});
export type QaPair = z.infer<typeof qaPairSchema>;

export const crawlConfigSchema = z.object({
  maxDepth: z.number().int().min(1).max(5).default(2),
  maxPages: z.number().int().min(1).max(100).default(20),
  sameDomainOnly: z.boolean().default(true),
  respectRobotsTxt: z.boolean().default(true),
});
export type CrawlConfig = z.input<typeof crawlConfigSchema>;

export const knowledgeSourceConfigSchema = z.object({
  rawText: z.string().optional(),
  qaPairs: z.array(qaPairSchema).optional(),
  crawlConfig: crawlConfigSchema.optional(),
  originalFileName: z.string().optional(),
  mimeType: z.string().optional(),
  propertyId: z.string().uuid().optional(),
});
export type KnowledgeSourceConfig = z.infer<typeof knowledgeSourceConfigSchema>;

// DTO Schemas
export const createTextSourceSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(255),
  content: z.string().min(10, 'Content must be at least 10 characters'),
});
export type CreateTextSourceInput = z.infer<typeof createTextSourceSchema>;

export const createCrawlSourceSchema = z.object({
  title: z.string().min(2).max(255),
  url: z.string().url('Must be a valid HTTP or HTTPS URL'),
  config: crawlConfigSchema.optional(),
});
export type CreateCrawlSourceInput = z.input<typeof createCrawlSourceSchema>;

export const createQaSourceSchema = z.object({
  title: z.string().min(2).max(255),
  pairs: z.array(qaPairSchema).min(1, 'At least one Q&A pair is required'),
});
export type CreateQaSourceInput = z.infer<typeof createQaSourceSchema>;

export const knowledgeSourceResponseSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  chatbotId: z.string().uuid(),
  title: z.string(),
  type: knowledgeSourceTypeEnum,
  sourceUrl: z.string().nullable().optional(),
  filePath: z.string().nullable().optional(),
  status: knowledgeSourceStatusEnum,
  errorMessage: z.string().nullable().optional(),
  chunkCount: z.number().int(),
  byteSize: z.number().int(),
  config: knowledgeSourceConfigSchema.optional(),
  lastTrainedAt: z.string().or(z.date()).nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type KnowledgeSourceResponse = z.infer<typeof knowledgeSourceResponseSchema>;

export const knowledgeSourcesListResponseSchema = z.object({
  sources: z.array(knowledgeSourceResponseSchema),
  total: z.number().int(),
});
export type KnowledgeSourcesListResponse = z.infer<typeof knowledgeSourcesListResponseSchema>;

// Retrieval & Hybrid RAG schemas
export const ragCitationSchema = z.object({
  sourceId: z.string().uuid(),
  sourceTitle: z.string(),
  sourceType: knowledgeSourceTypeEnum,
  pageNumber: z.number().int().optional(),
  sectionHeader: z.string().optional(),
  snippet: z.string(),
  similarityScore: z.number(),
});
export type RagCitation = z.infer<typeof ragCitationSchema>;

export const ragQuerySchema = z.object({
  query: z.string().min(2, 'Query must be at least 2 characters').max(1000),
  topK: z.number().int().min(1).max(10).default(4),
  similarityThreshold: z.number().min(0).max(1).default(0.7),
  streaming: z.boolean().default(false),
  history: z
    .array(z.object({ role: z.enum(['visitor', 'assistant']), content: z.string() }))
    .max(12)
    .optional(),
  visitorName: z.string().max(100).optional(),
});
export type RagQueryInput = z.input<typeof ragQuerySchema>;

export const ragQueryResponseSchema = z.object({
  answer: z.string(),
  confidence: z.number(),
  citations: z.array(ragCitationSchema),
  isGrounded: z.boolean(),
  isFallback: z.boolean(),
  overrideApplied: z.boolean().default(false),
  tokensUsed: z.object({
    prompt: z.number().int(),
    completion: z.number().int(),
    total: z.number().int(),
  }),
  latencyMs: z.number(),
  detectedLanguage: z.string().optional(),
});
export type RagQueryResponse = z.infer<typeof ragQueryResponseSchema>;

// Q&A Overrides (Fine-tune feedback loop)
export const createQaOverrideSchema = z.object({
  question: z.string().min(3),
  answer: z.string().min(2),
  source: z.enum(['correction', 'manual']).default('correction'),
});
export type CreateQaOverrideInput = z.input<typeof createQaOverrideSchema>;

export const qaOverrideResponseSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  chatbotId: z.string().uuid(),
  question: z.string(),
  answer: z.string(),
  source: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type QaOverrideResponse = z.infer<typeof qaOverrideResponseSchema>;

// Unanswered Questions (Inbox)
export const unansweredQuestionResponseSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  chatbotId: z.string().uuid(),
  question: z.string(),
  frequency: z.number().int(),
  status: z.enum(['pending', 'resolved', 'ignored']),
  resolvedAnswer: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type UnansweredQuestionResponse = z.infer<typeof unansweredQuestionResponseSchema>;

export const resolveUnansweredSchema = z.object({
  answer: z.string().min(2),
});
export type ResolveUnansweredInput = z.infer<typeof resolveUnansweredSchema>;
