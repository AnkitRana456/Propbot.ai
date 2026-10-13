export interface SyncLeadPayload {
  leadId: string;
  name: string;
  phone: string;
  email?: string;
  stage?: string;
  intentScore?: number;
  project?: string;
  budget?: string;
  source?: string;
  createdAt: string;
}

export interface SyncResult {
  success: boolean;
  externalId?: string;
  message?: string;
}

export interface IntegrationAdapter {
  providerName: string;
  syncLead(companyId: string, lead: SyncLeadPayload, config: Record<string, unknown>): Promise<SyncResult>;
}
