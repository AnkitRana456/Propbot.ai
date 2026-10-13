import { z } from 'zod';
import { userRoleSchema, userStatusSchema } from './auth.js';

export const userWorkingHoursSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:MM'),
  end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:MM'),
  timezone: z.string().default('Asia/Kolkata'),
  days: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: userRoleSchema.optional(),
  team: z.string().max(100).optional().nullable(),
  leadCapacity: z.number().int().min(1).max(500).optional(),
  workingHours: userWorkingHoursSchema.optional().nullable(),
  assignedChatbots: z.array(z.string().uuid()).optional(),
  status: userStatusSchema.optional(),
});

export const inviteUserSchema = z.object({
  email: z.string().email(),
  role: userRoleSchema,
  team: z.string().max(100).optional(),
  leadCapacity: z.number().int().min(1).max(500).optional().default(50),
  workingHours: userWorkingHoursSchema.optional(),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const userFilterSchema = z.object({
  q: z.string().optional(),
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
  team: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const auditLogFilterSchema = z.object({
  action: z.string().optional(),
  resourceType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(25),
});

export const clientDeliveryRulesSchema = z.object({
  workingHoursEnabled: z.boolean().default(false),
  workingHours: userWorkingHoursSchema.optional(),
  roundRobinMemberIds: z.array(z.string().uuid()).default([]),
  duplicateWindowHours: z.number().int().min(1).max(720).default(24),
  emailDelivery: z.boolean().default(true),
  whatsappDelivery: z.boolean().default(true),
  webhookDelivery: z.boolean().default(false),
  webhookUrl: z.string().url().optional(),
});

export const createClientCompanySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase alphanumeric characters and hyphens'),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  deliveryRules: clientDeliveryRulesSchema.optional(),
});

export const updateClientDeliveryRulesSchema = z.object({
  deliveryRules: clientDeliveryRulesSchema,
});

export const assignChatbotClientSchema = z.object({
  clientId: z.string().uuid().nullable(),
  deliveryRules: clientDeliveryRulesSchema.optional(),
});
