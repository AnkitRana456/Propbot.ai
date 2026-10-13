import { z } from 'zod';
import { userWorkingHoursSchema } from './users.js';

export const companyBrandingSchema = z.object({
  logoUrl: z.string().url().optional().or(z.literal('')),
  primaryColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color')
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color')
    .optional(),
  faviconUrl: z.string().url().optional().or(z.literal('')),
  whiteLabel: z.boolean().default(false),
  customDomain: z.string().optional().or(z.literal('')),
});

export const updateCompanyProfileSchema = z.object({
  name: z.string().min(2).max(100),
  branding: companyBrandingSchema.optional(),
});

export const customLeadFieldSchema = z.object({
  id: z.string(),
  key: z.string().min(1).regex(/^[a-z0-9_]+$/, 'Key must be alphanumeric snake_case'),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'select', 'boolean', 'date']),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});

export const operationsSettingsSchema = z.object({
  businessHours: userWorkingHoursSchema.optional(),
  pipelineStages: z.array(z.string()).min(1).optional(),
  tags: z.array(z.string()).optional(),
  customLeadFields: z.array(customLeadFieldSchema).optional(),
  notifications: z
    .object({
      emailAlerts: z.boolean().default(true),
      whatsappAlerts: z.boolean().default(true),
      browserPush: z.boolean().default(true),
      hotLeadSlaMinutes: z.number().int().min(1).max(1440).default(15),
    })
    .optional(),
});

export const aiControlsSettingsSchema = z.object({
  killSwitch: z.boolean(),
  allowedTiers: z.array(z.enum(['T0', 'T1', 'T2'])).min(1),
  dailyActionCap: z.number().int().min(1).max(10000),
  approvalRouting: z
    .object({
      priceApproverRole: z.string().default('company_admin'),
      legalApproverRole: z.string().default('company_admin'),
    })
    .optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(2).max(100),
  permissions: z.array(z.string()).min(1),
});

export const setupTwoFactorVerifySchema = z.object({
  token: z.string().length(6, 'TOTP code must be 6 digits'),
});

export const ipAllowlistSchema = z.object({
  ips: z.array(z.string()).default([]),
});

export const dataRetentionSchema = z.object({
  retentionDays: z.number().int().min(30).max(3650).default(365),
});
