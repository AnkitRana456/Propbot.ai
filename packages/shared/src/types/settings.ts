import { z } from 'zod';
import {
  companyBrandingSchema,
  updateCompanyProfileSchema,
  customLeadFieldSchema,
  operationsSettingsSchema,
  aiControlsSettingsSchema,
  createApiKeySchema,
  setupTwoFactorVerifySchema,
  ipAllowlistSchema,
  dataRetentionSchema,
} from '../schemas/settings.js';

export type CompanyBranding = z.infer<typeof companyBrandingSchema>;
export type UpdateCompanyProfileInput = z.infer<typeof updateCompanyProfileSchema>;
export type CustomLeadField = z.infer<typeof customLeadFieldSchema>;
export type OperationsSettings = z.infer<typeof operationsSettingsSchema>;
export type AiControlsSettings = z.infer<typeof aiControlsSettingsSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type SetupTwoFactorVerifyInput = z.infer<typeof setupTwoFactorVerifySchema>;
export type IpAllowlistInput = z.infer<typeof ipAllowlistSchema>;
export type DataRetentionInput = z.infer<typeof dataRetentionSchema>;

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

export interface UserSessionRecord {
  familyId: string;
  device: string;
  ipAddress: string | null;
  lastActiveAt: string;
  isCurrent: boolean;
}

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl?: string;
}

export interface CompanySettingsResponse {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  branding?: CompanyBranding | null;
  operations?: OperationsSettings | null;
  aiControls?: AiControlsSettings | null;
  security?: {
    ipAllowlist?: string[] | null;
  } | null;
  createdAt: string;
}

