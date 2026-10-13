import { eq, and, desc, gte, lte } from 'drizzle-orm';
import type { AuditLogFilter } from '@propbot/shared';
import { db } from '../../db/index.js';
import { auditLogs } from '../../db/schema/index.js';

export interface LogAuditInput {
  companyId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  async log(input: LogAuditInput): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        companyId: input.companyId,
        userId: input.userId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        details: input.details ?? {},
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }

  async getAuditLogs(companyId: string, filter: AuditLogFilter) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 25;
    const offset = (page - 1) * limit;

    const conditions = [eq(auditLogs.companyId, companyId)];

    if (filter.action) {
      conditions.push(eq(auditLogs.action, filter.action));
    }
    if (filter.resourceType) {
      conditions.push(eq(auditLogs.resourceType, filter.resourceType));
    }
    if (filter.startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(filter.startDate)));
    }
    if (filter.endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(filter.endDate)));
    }

    const whereClause = and(...conditions);

    const logs = await db.query.auditLogs.findMany({
      where: whereClause,
      orderBy: [desc(auditLogs.createdAt)],
      limit,
      offset,
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const allMatching = await db.query.auditLogs.findMany({
      where: whereClause,
      columns: { id: true },
    });

    return {
      logs,
      pagination: {
        page,
        limit,
        total: allMatching.length,
        totalPages: Math.ceil(allMatching.length / limit),
      },
    };
  }
}

export const auditService = new AuditService();
