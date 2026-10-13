import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { auditLogs, users } from '../../db/schema/index.js';

export interface AuditExportOptions {
  startDate?: string;
  endDate?: string;
  action?: string;
  format?: 'json' | 'csv';
}

export class AuditExportService {
  /**
   * Fetches audit logs for export.
   */
  async exportLogs(companyId: string, options: AuditExportOptions) {
    const conditions = [eq(auditLogs.companyId, companyId)];

    if (options.action) {
      conditions.push(eq(auditLogs.action, options.action));
    }
    if (options.startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(options.startDate)));
    }
    if (options.endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(options.endDate)));
    }

    const logs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
        userEmail: users.email,
        userName: users.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(5000);

    if (options.format === 'csv') {
      return this.formatAsCsv(logs);
    }

    return logs;
  }

  private formatAsCsv(records: Array<Record<string, unknown>>): string {
    if (records.length === 0) {
      return 'id,action,resourceType,resourceId,userEmail,createdAt,details\n';
    }

    const headers = ['id', 'action', 'resourceType', 'resourceId', 'userEmail', 'createdAt', 'details'];
    const rows = records.map((r) => [
      r.id,
      r.action,
      r.resourceType,
      r.resourceId || '',
      r.userEmail || '',
      r.createdAt ? new Date(String(r.createdAt)).toISOString() : '',
      `"${JSON.stringify(r.details || {}).replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }
}

export const auditExportService = new AuditExportService();
