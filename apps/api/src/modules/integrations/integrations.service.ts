import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { integrations } from '../../db/schema/index.js';
import type {
  IntegrationItem,
  IntegrationProvider,
  UpdateIntegrationInput,
  PixelEventInput,
} from '@propbot/shared';
import { googleSheetsAdapter } from './google-sheets.adapter.js';
import { hubspotAdapter, zohoAdapter, genericRestAdapter } from './crm.adapter.js';
import { conversionTrackingService } from './conversion-tracking.service.js';

export class IntegrationsService {
  /**
   * Lists all configured integrations for a tenant.
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
      config: r.config as Record<string, unknown>,
      events: r.events as IntegrationItem['events'],
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /**
   * Updates or creates a provider integration.
   */
  async updateIntegration(
    companyId: string,
    provider: IntegrationProvider,
    input: UpdateIntegrationInput,
  ): Promise<IntegrationItem> {
    const [existing] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.companyId, companyId), eq(integrations.provider, provider)));

    if (existing) {
      await db
        .update(integrations)
        .set({
          status: input.status,
          config: input.config,
          events: input.events,
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existing.id));
    } else {
      await db.insert(integrations).values({
        companyId,
        provider,
        status: input.status,
        config: input.config,
        events: input.events,
      });
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
      config: updated!.config as Record<string, unknown>,
      events: updated!.events as IntegrationItem['events'],
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    };
  }

  /**
   * Manually tests a provider sync.
   */
  async testSync(
    companyId: string,
    provider: IntegrationProvider,
  ): Promise<{ success: boolean; message: string }> {
    const dummyLead = {
      leadId: 'test_lead_001',
      name: 'Rohan Sharma',
      phone: '+919876543210',
      email: 'rohan@example.com',
      project: 'Prestige Palms',
      budget: '3 Cr',
      intentScore: 85,
      createdAt: new Date().toISOString(),
    };

    if (provider === 'google_sheets') {
      const res = await googleSheetsAdapter.syncLead(companyId, dummyLead, {});
      return { success: res.success, message: res.message || 'Synced' };
    }

    if (provider === 'hubspot') {
      const res = await hubspotAdapter.syncLead(companyId, dummyLead, {});
      return { success: res.success, message: res.message || 'Synced' };
    }

    if (provider === 'zoho') {
      const res = await zohoAdapter.syncLead(companyId, dummyLead, {});
      return { success: res.success, message: res.message || 'Synced' };
    }

    if (provider === 'generic_rest') {
      const res = await genericRestAdapter.syncLead(companyId, dummyLead, {});
      return { success: res.success, message: res.message || 'Synced' };
    }

    return { success: true, message: `${provider} test successful` };
  }

  /**
   * Tracks an ad conversion event with consent guard.
   */
  async trackConversion(companyId: string, input: PixelEventInput) {
    return conversionTrackingService.trackConversion(companyId, input);
  }
}

export const integrationsService = new IntegrationsService();
