import { z } from 'zod';

export const objectionCategoryEnum = z.enum([
  'price_too_high',
  'possession_far',
  'location_connectivity',
  'competitor_comparison',
  'amenities_concern',
  'builder_reputation',
  'other',
]);
export type ObjectionCategory = z.infer<typeof objectionCategoryEnum>;

export const objectionPlaybookSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  chatbotId: z.string().uuid().nullable().optional(),
  category: objectionCategoryEnum,
  title: z.string().min(2).max(200),
  triggerKeywords: z.array(z.string().min(1)),
  rebuttalText: z.string().min(10).max(2000),
  suggestedAction: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type ObjectionPlaybook = z.infer<typeof objectionPlaybookSchema>;

export const createObjectionPlaybookSchema = z.object({
  chatbotId: z.string().uuid().nullable().optional(),
  category: objectionCategoryEnum,
  title: z.string().min(2).max(200),
  triggerKeywords: z.array(z.string().min(1)).min(1),
  rebuttalText: z.string().min(10).max(2000),
  suggestedAction: z.string().optional(),
  isActive: z.boolean().default(true),
});
export type CreateObjectionPlaybookInput = z.infer<typeof createObjectionPlaybookSchema>;

export const updateObjectionPlaybookSchema = createObjectionPlaybookSchema.partial();
export type UpdateObjectionPlaybookInput = z.infer<typeof updateObjectionPlaybookSchema>;

export const playbooksListResponseSchema = z.object({
  playbooks: z.array(objectionPlaybookSchema),
  total: z.number(),
});
export type PlaybooksListResponse = z.infer<typeof playbooksListResponseSchema>;
