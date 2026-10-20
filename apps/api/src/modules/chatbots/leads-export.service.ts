import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { chatbots, contacts, leads } from '../../db/schema/index.js';

/**
 * Neutralises spreadsheet formula injection: a cell starting with = + - @ (or tab / CR) is executed as a
 * formula by Excel / Sheets, so lead-supplied text such as `=HYPERLINK(...)` gets a leading apostrophe.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const LEAD_EXPORT_COLUMNS = [
  'LeadId',
  'Name',
  'Phone',
  'Email',
  'PhoneVerified',
  'Status',
  'Source',
  'VisitCount',
  'UTMSource',
  'UTMMedium',
  'UTMCampaign',
  'UTMTerm',
  'UTMContent',
  'UTMSubSource',
  'UTMAgencyPartner',
  'PageUrl',
  'CreatedAt',
  'LastSeenAt',
] as const;

export class LeadsExportService {
  /**
   * CSV of every lead captured by a chatbot, including leads of a chatbot that was soft-deleted.
   * Deleting a chatbot keeps its leads, and this export is the way to take a copy before any future
   * permanent removal (there is intentionally no hard-delete code path).
   */
  async exportChatbotLeadsCsv(companyId: string, chatbotId: string): Promise<{ filename: string; csv: string; count: number } | null> {
    const [bot] = await db
      .select({ id: chatbots.id, name: chatbots.name })
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.companyId, companyId)));
    if (!bot) return null;

    const rows = await db
      .select({ lead: leads, contact: contacts })
      .from(leads)
      .innerJoin(contacts, eq(contacts.id, leads.contactId))
      .where(and(eq(leads.companyId, companyId), eq(leads.chatbotId, chatbotId), isNull(leads.deletedAt)))
      .orderBy(desc(leads.createdAt));

    const lines = [LEAD_EXPORT_COLUMNS.join(',')];
    for (const { lead, contact } of rows) {
      const utm = (lead.utmParams ?? {}) as Record<string, string>;
      lines.push(
        [
          lead.id,
          `${contact.firstName} ${contact.lastName ?? ''}`.trim(),
          contact.phone,
          contact.email ?? '',
          lead.phoneVerified,
          lead.status,
          lead.source,
          lead.visitCount,
          utm.utm_source ?? '',
          utm.utm_medium ?? '',
          utm.utm_campaign ?? '',
          utm.utm_term ?? '',
          utm.utm_content ?? '',
          utm.utm_sub_source ?? '',
          utm.utm_agencypartner ?? '',
          lead.pageUrl ?? '',
          lead.createdAt.toISOString(),
          lead.lastSeenAt.toISOString(),
        ]
          .map(csvCell)
          .join(','),
      );
    }

    const safeName = bot.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'chatbot';
    return { filename: `leads-${safeName}.csv`, csv: `\uFEFF${lines.join('\r\n')}\r\n`, count: rows.length };
  }
}

export const leadsExportService = new LeadsExportService();
