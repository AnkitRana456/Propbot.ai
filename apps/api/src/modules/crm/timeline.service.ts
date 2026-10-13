import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { leadActivities } from '../../db/schema/index.js';
import type { VisitorTimelineResponse, VisitorTimelineItem } from '@propbot/shared';

export class TimelineService {
  /**
   * Retrieves the unified Visitor Timeline for a lead.
   */
  async getVisitorTimeline(companyId: string, leadId: string): Promise<VisitorTimelineResponse> {
    const rows = await db
      .select()
      .from(leadActivities)
      .where(and(eq(leadActivities.companyId, companyId), eq(leadActivities.leadId, leadId)))
      .orderBy(desc(leadActivities.createdAt));

    const items: VisitorTimelineItem[] = rows.map(r => ({
      id: r.id,
      activityType: r.activityType,
      title: r.title,
      description: r.description,
      metadata: (r.metadata as Record<string, unknown>) || {},
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      items,
      total: items.length,
    };
  }

  /**
   * Records a manual or programmatic activity on the visitor timeline.
   */
  async logActivity(params: {
    companyId: string;
    leadId: string;
    contactId: string;
    activityType: string;
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<VisitorTimelineItem> {
    const [row] = await db
      .insert(leadActivities)
      .values({
        companyId: params.companyId,
        leadId: params.leadId,
        contactId: params.contactId,
        activityType: params.activityType,
        title: params.title,
        description: params.description,
        metadata: params.metadata || {},
      })
      .returning();

    if (!row) {
      throw new Error('Failed to log timeline activity');
    }

    return {
      id: row.id,
      activityType: row.activityType,
      title: row.title,
      description: row.description,
      metadata: (row.metadata as Record<string, unknown>) || {},
      createdAt: row.createdAt.toISOString(),
    };
  }
}

export const timelineService = new TimelineService();
