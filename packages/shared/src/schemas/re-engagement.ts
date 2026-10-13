import { z } from 'zod';

export const reEngagementIntervalEnum = z.enum(['day_1', 'day_3', 'day_7', 'day_30']);
export type ReEngagementInterval = z.infer<typeof reEngagementIntervalEnum>;

export const reEngagementTriggerSchema = z.object({
  id: z.string().uuid().optional(),
  interval: reEngagementIntervalEnum,
  days: z.number().int().min(1).max(60),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean().default(true),
  hookType: z.enum(['new_inventory', 'price_alert', 'site_visit_reminder', 'market_update']),
});
export type ReEngagementTrigger = z.infer<typeof reEngagementTriggerSchema>;

export const reEngagementLogItemSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  leadId: z.string().uuid(),
  leadName: z.string().optional(),
  leadPhone: z.string().optional(),
  channel: z.string(),
  intervalDays: z.number(),
  hookTemplate: z.string(),
  messageContent: z.string(),
  status: z.enum(['sent', 'failed', 'skipped_opt_out', 'queued']),
  sentAt: z.string().or(z.date()),
});
export type ReEngagementLogItem = z.infer<typeof reEngagementLogItemSchema>;

export const reEngagementSweepResultSchema = z.object({
  processedCount: z.number(),
  dispatchedCount: z.number(),
  skippedOptOutCount: z.number(),
  failedCount: z.number(),
  dispatchedLeads: z.array(z.string().uuid()),
});
export type ReEngagementSweepResult = z.infer<typeof reEngagementSweepResultSchema>;
