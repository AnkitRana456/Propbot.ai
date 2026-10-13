import { z } from 'zod';

export const dashboardStatsSchema = z.object({
  totalLeads: z.number().int().nonnegative(),
  newLeads: z.number().int().nonnegative(),
  qualifiedLeads: z.number().int().nonnegative(),
  convertedLeads: z.number().int().nonnegative(),
  activeChatbots: z.number().int().nonnegative(),
  todayVisits: z.number().int().nonnegative(),
});

export const recentLeadItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable().optional(),
  status: z.string(),
  priority: z.string(),
  intentScore: z.number().int().min(0).max(100),
  intentLabel: z.string(),
  source: z.string(),
  createdAt: z.string(),
});

export const notificationItemSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  isRead: z.boolean(),
  createdAt: z.string(),
});

export const dashboardSummaryResponseSchema = z.object({
  stats: dashboardStatsSchema,
  recentLeads: z.array(recentLeadItemSchema),
  unreadNotificationsCount: z.number().int().nonnegative(),
});
