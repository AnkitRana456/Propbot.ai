import type { IntegrationAdapter, SyncLeadPayload, SyncResult } from './integration.adapter.js';
import { pino } from 'pino';

const logger = pino({ name: 'google-sheets-adapter', level: process.env.LOG_LEVEL || 'info' });

export class MockGoogleSheetsProvider {
  private sheets: Map<string, Array<Array<string | number | undefined>>> = new Map();

  appendRow(spreadsheetId: string, row: Array<string | number | undefined>): void {
    if (!this.sheets.has(spreadsheetId)) {
      this.sheets.set(spreadsheetId, []);
    }
    this.sheets.get(spreadsheetId)!.push(row);
  }

  getRows(spreadsheetId: string): Array<Array<string | number | undefined>> {
    return this.sheets.get(spreadsheetId) || [];
  }

  clear(spreadsheetId?: string): void {
    if (spreadsheetId) {
      this.sheets.delete(spreadsheetId);
    } else {
      this.sheets.clear();
    }
  }
}

export const mockGoogleSheets = new MockGoogleSheetsProvider();

export class GoogleSheetsAdapter implements IntegrationAdapter {
  providerName = 'google_sheets';

  async syncLead(
    companyId: string,
    lead: SyncLeadPayload,
    config: Record<string, unknown>,
  ): Promise<SyncResult> {
    const spreadsheetId = String(config.spreadsheetId || 'default_propbot_leads_sheet');
    const row = [
      new Date().toISOString(),
      lead.leadId,
      lead.name,
      lead.phone,
      lead.email || '',
      lead.project || '',
      lead.budget || '',
      lead.intentScore || 0,
      lead.stage || 'new',
      lead.source || 'website',
    ];

    // Mock Provider append for dev & test
    mockGoogleSheets.appendRow(spreadsheetId, row);
    logger.info({ companyId, spreadsheetId, leadId: lead.leadId }, 'Appended lead row to Google Sheets');

    return {
      success: true,
      externalId: `row_${Date.now()}`,
      message: 'Lead appended to Google Sheets successfully',
    };
  }
}

export const googleSheetsAdapter = new GoogleSheetsAdapter();
