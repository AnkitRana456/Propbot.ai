import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { integrations, auditLogs } from '../../db/schema/index.js';
import type {
  IntegrationItem,
  IntegrationProvider,
  UpdateIntegrationInput,
  PixelEventInput,
} from '@propbot/shared';
import type { SyncLeadPayload } from './integration.adapter.js';
import { googleSheetsAdapter } from './google-sheets.adapter.js';
import { hubspotAdapter, zohoAdapter, genericRestAdapter } from './crm.adapter.js';
import { conversionTrackingService } from './conversion-tracking.service.js';
import {
  encryptSecret,
  packEncryptedSecret,
  unpackEncryptedSecret,
  maskSecret,
} from '../../utils/crypto-vault.js';

export class IntegrationsService {
  /**
   * Encrypts sensitive credentials in config before saving to database.
   */
  private encryptConfig(config: Record<string, unknown>): Record<string, unknown> {
    const encrypted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (
        typeof value === 'string' &&
        value.length > 0 &&
        /(key|token|secret|password|auth)/i.test(key) &&
        !value.startsWith('vault:v1:')
      ) {
        encrypted[key] = packEncryptedSecret(encryptSecret(value));
      } else {
        encrypted[key] = value;
      }
    }
    return encrypted;
  }

  /**
   * Decrypts vault secrets in config for backend adapter execution.
   */
  decryptConfig(config: Record<string, unknown>): Record<string, unknown> {
    const decrypted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string' && value.startsWith('vault:v1:')) {
        decrypted[key] = unpackEncryptedSecret(value);
      } else {
        decrypted[key] = value;
      }
    }
    return decrypted;
  }

  /**
   * Masks secrets in config for safe client-side display in UI.
   */
  private maskConfig(config: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        if (value.startsWith('vault:v1:')) {
          const plain = unpackEncryptedSecret(value);
          masked[key] = maskSecret(plain);
        } else if (/(key|token|secret|password|auth)/i.test(key)) {
          masked[key] = maskSecret(value);
        } else {
          masked[key] = value;
        }
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }

  /**
   * Lists all configured integrations for a tenant with secrets masked.
   */
  async listIntegrations(companyId: string): Promise<IntegrationItem[]> {
    const rows = await db
      .select()
      .from(integrations)
      .where(eq(integrations.companyId, companyId));

    return rows.map(r => ({
      id: r.id,
      companyId: r.companyId,
      provider: r.provider as IntegrationProvider,
      status: r.status as IntegrationItem['status'],
      config: this.maskConfig(r.config as Record<string, unknown>),
      events: r.events as IntegrationItem['events'],
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /**
   * Updates or creates a provider integration with at-rest AES-256-GCM encryption.
   */
  async updateIntegration(
    companyId: string,
    provider: IntegrationProvider,
    input: UpdateIntegrationInput,
    userId?: string,
  ): Promise<IntegrationItem> {
    const [existing] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.companyId, companyId), eq(integrations.provider, provider)));

    const encryptedConfig = this.encryptConfig(input.config || {});

    let targetId = existing?.id;

    if (existing) {
      // Merge new config with existing to preserve previously encrypted keys if unchanged
      const mergedConfig = {
        ...(existing.config as Record<string, unknown>),
        ...encryptedConfig,
      };

      await db
        .update(integrations)
        .set({
          status: input.status,
          config: mergedConfig,
          events: input.events,
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existing.id));
    } else {
      const [inserted] = await db
        .insert(integrations)
        .values({
          companyId,
          provider,
          status: input.status,
          config: encryptedConfig,
          events: input.events,
        })
        .returning({ id: integrations.id });
      targetId = inserted!.id;
    }

    // Write audit log entry
    if (userId) {
      await db.insert(auditLogs).values({
        companyId,
        userId,
        action: existing ? 'integration.updated' : 'integration.created',
        resourceType: 'integration',
        resourceId: targetId || provider,
        details: { provider, status: input.status },
      }).catch(() => {});
    }

    const [updated] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.companyId, companyId), eq(integrations.provider, provider)));

    return {
      id: updated!.id,
      companyId: updated!.companyId,
      provider: updated!.provider as IntegrationProvider,
      status: updated!.status as IntegrationItem['status'],
      config: this.maskConfig(updated!.config as Record<string, unknown>),
      events: updated!.events as IntegrationItem['events'],
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    };
  }

  /**
   * Returns platform-level integration status for super_admin users.
   */
  getPlatformIntegrations() {
    return {
      openai: {
        configured: Boolean(process.env.OPENAI_API_KEY),
        maskedKey: maskSecret(process.env.OPENAI_API_KEY),
      },
      anthropic: {
        configured: Boolean(process.env.ANTHROPIC_API_KEY),
        maskedKey: maskSecret(process.env.ANTHROPIC_API_KEY),
      },
      gemini: {
        configured: Boolean(process.env.GEMINI_API_KEY),
        maskedKey: maskSecret(process.env.GEMINI_API_KEY),
      },
      whatsapp: {
        configured: Boolean(process.env.META_WHATSAPP_TOKEN),
        phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID || null,
        maskedToken: maskSecret(process.env.META_WHATSAPP_TOKEN),
      },
      storage: {
        configured: Boolean(process.env.R2_ACCESS_KEY_ID),
        bucket: process.env.R2_BUCKET_NAME || null,
      },
      smtp: {
        configured: Boolean(process.env.SMTP_HOST),
        host: process.env.SMTP_HOST || null,
      },
    };
  }

  /**
   * Manually tests a provider sync using decrypted credentials.
   */
  async testSync(
    companyId: string,
    provider: IntegrationProvider,
  ): Promise<{ success: boolean; message: string }> {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.companyId, companyId), eq(integrations.provider, provider)));

    const decryptedConfig = integration?.config
      ? this.decryptConfig(integration.config as Record<string, unknown>)
      : {};

    const dummyLead: SyncLeadPayload = {
      leadId: 'test_lead_001',
      name: 'Rohan Sharma',
      phone: '+919876543210',
      email: 'rohan@example.com',
      project: 'Prestige Palms',
      budget: '3 Cr',
      intentScore: 85,
      createdAt: new Date().toISOString(),
    };

    let result: { success: boolean; message?: string };
    switch (provider) {
      case 'google_sheets':
        result = await googleSheetsAdapter.syncLead(companyId, dummyLead, decryptedConfig);
        break;
      case 'hubspot':
        result = await hubspotAdapter.syncLead(companyId, dummyLead, decryptedConfig);
        break;
      case 'zoho':
        result = await zohoAdapter.syncLead(companyId, dummyLead, decryptedConfig);
        break;
      case 'generic_rest':
        result = await genericRestAdapter.syncLead(companyId, dummyLead, decryptedConfig);
        break;
      case 'meta_pixel':
      case 'google_ads':
        return { success: true, message: `${provider} active and ready for client-side events.` };
      default:
        return { success: false, message: `Unsupported provider: ${provider}` };
    }

    return {
      success: result.success,
      message: result.message || 'Sync completed successfully.',
    };
  }

  /**
   * Disconnects an integration and clears its credentials.
   */
  async disconnectIntegration(companyId: string, provider: IntegrationProvider, userId?: string): Promise<void> {
    await db
      .delete(integrations)
      .where(and(eq(integrations.companyId, companyId), eq(integrations.provider, provider)));

    if (userId) {
      await db.insert(auditLogs).values({
        companyId,
        userId,
        action: 'integration.disconnected',
        resourceType: 'integration',
        resourceId: provider,
        details: { provider },
      }).catch(() => {});
    }
  }

  /**
   * Tracks a conversion event for client-side pixels.
   */
  async trackConversion(companyId: string, input: PixelEventInput): Promise<void> {
    const list = await this.listIntegrations(companyId);
    const activePixels = list.filter(
      i => (i.provider === 'meta_pixel' || i.provider === 'google_ads') && i.status === 'active',
    );

    if (activePixels.length > 0) {
      await conversionTrackingService.trackConversion(companyId, input);
    }
  }
}

export const integrationsService = new IntegrationsService();
