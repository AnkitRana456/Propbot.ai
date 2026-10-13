import { describe, it, expect, beforeEach } from 'vitest';
import {
  googleSheetsAdapter,
  mockGoogleSheets,
} from '../../src/modules/integrations/google-sheets.adapter.js';
import { integrationsService } from '../../src/modules/integrations/integrations.service.js';

describe('Native Google Sheets Sync Integration & Mock Provider', () => {
  const companyId = '99999999-9999-9999-9999-999999999913';
  const spreadsheetId = 'sheet_leads_master_001';

  beforeEach(() => {
    mockGoogleSheets.clear();
  });

  it('googleSheetsAdapter.syncLead formats row and appends to mock Google Sheets provider', async () => {
    const leadPayload = {
      leadId: 'lead_abc_123',
      name: 'Karan Malhotra',
      phone: '+919876500013',
      email: 'karan@example.com',
      project: 'Prestige Park Grove',
      budget: '3.5 Cr',
      intentScore: 88,
      stage: 'site_visit_scheduled',
      source: 'whatsapp',
      createdAt: new Date().toISOString(),
    };

    const res = await googleSheetsAdapter.syncLead(companyId, leadPayload, { spreadsheetId });
    expect(res.success).toBe(true);
    expect(res.externalId).toBeDefined();

    // Verify row was appended to mock spreadsheet
    const rows = mockGoogleSheets.getRows(spreadsheetId);
    expect(rows.length).toBe(1);

    const appendedRow = rows[0]!;
    expect(appendedRow).toContain('lead_abc_123');
    expect(appendedRow).toContain('Karan Malhotra');
    expect(appendedRow).toContain('+919876500013');
    expect(appendedRow).toContain('Prestige Park Grove');
    expect(appendedRow).toContain(88);
  });

  it('integrationsService.testSync triggers successful Google Sheets test row append', async () => {
    const res = await integrationsService.testSync(companyId, 'google_sheets');
    expect(res.success).toBe(true);

    const rows = mockGoogleSheets.getRows('default_propbot_leads_sheet');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toContain('Rohan Sharma');
  });
});
