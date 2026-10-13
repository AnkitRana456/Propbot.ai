import { z } from 'zod';

// ==========================================
// Enterprise & Security Schemas
// ==========================================

export const ssoProviderTypeSchema = z.enum(['saml', 'oidc']);

export const companySsoConfigSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  provider_type: ssoProviderTypeSchema,
  domain: z.string().min(3).max(255),
  entity_id: z.string().max(500).nullable().optional(),
  sso_url: z.string().url().nullable().optional(),
  certificate: z.string().nullable().optional(),
  client_id: z.string().max(255).nullable().optional(),
  client_secret: z.string().nullable().optional(),
  discovery_url: z.string().url().nullable().optional(),
  is_active: z.boolean().default(false),
  enforce_for_domain: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const updateSsoConfigRequestSchema = z.object({
  providerType: ssoProviderTypeSchema.default('saml'),
  domain: z.string().min(3).max(255),
  entityId: z.string().max(500).optional(),
  ssoUrl: z.string().url().optional(),
  certificate: z.string().optional(),
  clientId: z.string().max(255).optional(),
  clientSecret: z.string().optional(),
  discoveryUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  enforceForDomain: z.boolean().default(false),
});

export const configureSsoRequestSchema = z.object({
  ssoProvider: z.string().default('saml'),
  domain: z.string().min(3).max(255),
  issuer: z.string().optional(),
  ssoUrl: z.string().optional(),
  certificate: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  isEnforced: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const ssoLoginRequestSchema = z.object({
  email: z.string().email(),
});

export const ssoCallbackPayloadSchema = z.object({
  domain: z.string(),
  samlResponse: z.string().optional(),
  idToken: z.string().optional(),
  code: z.string().optional(),
  relayState: z.string().optional(),
  email: z.string().optional(),
  name: z.string().optional(),
  assertion: z.string().optional(),
});

export const auditLogExportFilterSchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
});

export const rotateApiKeyRequestSchema = z.object({
  gracePeriodHours: z.number().int().min(1).max(72).default(24),
});

export const systemUptimeStatusSchema = z.object({
  status: z.enum(['operational', 'degraded', 'outage']),
  uptimePercentage: z.number().min(0).max(100),
  timestamp: z.string().datetime(),
  components: z.array(
    z.object({
      name: z.string(),
      status: z.enum(['operational', 'degraded', 'outage']),
      latencyMs: z.number(),
    }),
  ),
});

export type SsoProviderType = z.infer<typeof ssoProviderTypeSchema>;
export type CompanySsoConfig = z.infer<typeof companySsoConfigSchema>;
export type UpdateSsoConfigRequest = z.infer<typeof updateSsoConfigRequestSchema>;
export type ConfigureSsoRequest = z.infer<typeof configureSsoRequestSchema>;
export type SsoLoginRequest = z.infer<typeof ssoLoginRequestSchema>;
export type SsoCallbackPayload = z.infer<typeof ssoCallbackPayloadSchema>;
export type AuditLogExportFilter = z.infer<typeof auditLogExportFilterSchema>;
export type RotateApiKeyRequest = z.infer<typeof rotateApiKeyRequestSchema>;
export type SystemUptimeStatus = z.infer<typeof systemUptimeStatusSchema>;
