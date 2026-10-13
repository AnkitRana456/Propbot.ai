import { z } from 'zod';
import {
  userWorkingHoursSchema,
  updateUserSchema,
  inviteUserSchema,
  acceptInviteSchema,
  userFilterSchema,
  auditLogFilterSchema,
  clientDeliveryRulesSchema,
  createClientCompanySchema,
  updateClientDeliveryRulesSchema,
  assignChatbotClientSchema,
} from '../schemas/users.js';

export type UserWorkingHours = z.infer<typeof userWorkingHoursSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type UserFilter = z.input<typeof userFilterSchema>;
export type AuditLogFilter = z.input<typeof auditLogFilterSchema>;
export type ClientDeliveryRules = z.infer<typeof clientDeliveryRulesSchema>;
export type CreateClientCompanyInput = z.infer<typeof createClientCompanySchema>;
export type UpdateClientDeliveryRulesInput = z.infer<typeof updateClientDeliveryRulesSchema>;
export type AssignChatbotClientInput = z.infer<typeof assignChatbotClientSchema>;

export interface UserKpiMetrics {
  totalUsers: number;
  activeUsers: number;
  pendingApproval: number;
  companiesCount: number;
}

export interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string | null;
  status: string;
  workingHours?: UserWorkingHours | null;
  leadCapacity?: number | null;
  assignedChatbots?: string[] | null;
  twoFactorEnabled?: boolean | null;
  createdAt: string;
  company?: { name: string; slug: string };
}

export interface UserInvitationItem {
  id: string;
  companyId: string;
  email: string;
  role: string;
  team?: string | null;
  status: string;
  assignedChatbots?: string[] | null;
  invitedBy?: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  companyId: string;
  userId: string | null;
  userName?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface AgencyClientItem {
  id: string;
  name: string;
  slug: string;
  parentCompanyId: string | null;
  deliveryRules?: ClientDeliveryRules | null;
  leadCreditsBalance?: number;
  chatbotsCount?: number;
  leadsCount?: number;
  createdAt: string;
}

export interface ClientPortalData {
  company: { id: string; name: string };
  chatbots: Array<{ id: string; name: string; type: string; status: string }>;
  leads: Array<{
    id: string;
    companyId: string;
    contactId: string;
    status: string;
    intentScore: number | null;
    intentLabel: string | null;
    createdAt: string;
  }>;
}

