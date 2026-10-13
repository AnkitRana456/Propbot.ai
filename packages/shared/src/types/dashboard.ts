import { z } from 'zod';
import {
  dashboardStatsSchema,
  recentLeadItemSchema,
  notificationItemSchema,
  dashboardSummaryResponseSchema,
} from '../schemas/dashboard.js';

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
export type RecentLeadItem = z.infer<typeof recentLeadItemSchema>;
export type NotificationItem = z.infer<typeof notificationItemSchema>;
export type DashboardSummaryResponse = z.infer<typeof dashboardSummaryResponseSchema>;
