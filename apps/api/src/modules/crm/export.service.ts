import { eq, and, isNull, inArray, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { leads, contacts, users } from '../../db/schema/index.js';
import type { ExportLeadsInput } from '@propbot/shared';

export class ExportService {
  /**
   * Generates a CSV string representation of leads based on selected columns and filters.
   */
  async exportLeadsToCsv(companyId: string, input: ExportLeadsInput): Promise<string> {
    const conditions = [eq(leads.companyId, companyId), isNull(leads.deletedAt)];

    if (input.leadIds && input.leadIds.length > 0) {
      conditions.push(inArray(leads.id, input.leadIds));
    }
    if (input.status && input.status !== 'all') {
      conditions.push(eq(leads.status, input.status));
    }
    if (input.priority && input.priority !== 'all') {
      conditions.push(eq(leads.priority, input.priority));
    }
    if (input.intentLabel) {
      conditions.push(eq(leads.intentLabel, input.intentLabel));
    }

    const rows = await db
      .select({
        lead: leads,
        contact: contacts,
        agent: users,
      })
      .from(leads)
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .leftJoin(users, eq(leads.assignedAgentId, users.id))
      .where(and(...conditions))
      .orderBy(desc(leads.createdAt));

    const selectedColumns = input.columns.length > 0
      ? input.columns
      : ['name', 'phone', 'email', 'status', 'intentScore', 'priority', 'source', 'assignedAgent', 'createdAt'];

    // Header row
    const headers = selectedColumns.map(col => this.formatColumnHeader(col));
    const csvRows: string[] = [headers.join(',')];

    for (const { lead, contact, agent } of rows) {
      const rowValues = selectedColumns.map(col => {
        let val = '';
        switch (col) {
          case 'name':
            val = contact ? `${contact.firstName} ${contact.lastName || ''}`.trim() : 'Prospect';
            break;
          case 'phone':
            val = contact?.phone || '';
            break;
          case 'email':
            val = contact?.email || '';
            break;
          case 'status':
            val = lead.status;
            break;
          case 'lostReason':
            val = lead.lostReason || '';
            break;
          case 'intentScore':
            val = lead.intentScore.toString();
            break;
          case 'intentLabel':
            val = lead.intentLabel;
            break;
          case 'priority':
            val = lead.priority;
            break;
          case 'source':
            val = lead.source;
            break;
          case 'assignedAgent':
            val = agent?.name || 'Unassigned';
            break;
          case 'pageUrl':
            val = lead.pageUrl || '';
            break;
          case 'createdAt':
            val = lead.createdAt.toISOString();
            break;
          case 'nextFollowUp':
            val = lead.nextFollowUpAt ? lead.nextFollowUpAt.toISOString() : '';
            break;
          default:
            val = '';
        }
        return this.escapeCsvField(val);
      });

      csvRows.push(rowValues.join(','));
    }

    return csvRows.join('\r\n');
  }

  private formatColumnHeader(col: string): string {
    const map: Record<string, string> = {
      name: 'Full Name',
      phone: 'Phone',
      email: 'Email',
      status: 'Status',
      lostReason: 'Lost Reason',
      intentScore: 'Intent Score',
      intentLabel: 'Intent Category',
      priority: 'Priority',
      source: 'Source',
      assignedAgent: 'Assigned Agent',
      pageUrl: 'Landing Page URL',
      createdAt: 'Date Created',
      nextFollowUp: 'Next Follow-up',
    };
    return `"${map[col] || col}"`;
  }

  private escapeCsvField(val: string): string {
    if (val === null || val === undefined) return '""';
    const stringVal = String(val).replace(/"/g, '""');
    return `"${stringVal}"`;
  }
}

export const exportService = new ExportService();
