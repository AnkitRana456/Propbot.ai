import type { IntegrationAdapter, SyncLeadPayload, SyncResult } from './integration.adapter.js';
import { pino } from 'pino';

const logger = pino({ name: 'crm-adapter', level: process.env.LOG_LEVEL || 'info' });

export class MockCRMProvider {
  private syncedLeads: Map<string, SyncLeadPayload> = new Map();

  recordLead(externalId: string, lead: SyncLeadPayload): void {
    this.syncedLeads.set(externalId, lead);
  }

  getLead(externalId: string): SyncLeadPayload | undefined {
    return this.syncedLeads.get(externalId);
  }

  clear(): void {
    this.syncedLeads.clear();
  }
}

export const mockCRMProvider = new MockCRMProvider();

export class CRMAdapter implements IntegrationAdapter {
  constructor(public providerName: 'hubspot' | 'zoho' | 'generic_rest') {}

  async syncLead(
    companyId: string,
    lead: SyncLeadPayload,
    _config: Record<string, unknown>,
  ): Promise<SyncResult> {
    const externalId = `${this.providerName}_${lead.leadId}`;

    mockCRMProvider.recordLead(externalId, lead);
    logger.info({ companyId, provider: this.providerName, leadId: lead.leadId }, 'Synced lead to CRM');

    return {
      success: true,
      externalId,
      message: `Lead synced to ${this.providerName} successfully`,
    };
  }
}

export const hubspotAdapter = new CRMAdapter('hubspot');
export const zohoAdapter = new CRMAdapter('zoho');
export const genericRestAdapter = new CRMAdapter('generic_rest');
