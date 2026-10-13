import { eq, and, sql, inArray, gte, lte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { segments, leads, contacts } from '../../db/schema/index.js';
import type { SegmentFilterCriteria, CreateSegmentRequest } from '@propbot/shared';

export class SegmentsService {
  /**
   * Evaluates dynamic lead count matching the specified segment filter criteria.
   */
  async evaluateCount(companyId: string, criteria: SegmentFilterCriteria): Promise<number> {
    const conditions = [
      eq(leads.companyId, companyId),
      sql`${leads.deletedAt} IS NULL`,
    ];

    if (criteria.intentLabels && criteria.intentLabels.length > 0) {
      conditions.push(inArray(leads.intentLabel, criteria.intentLabels));
    }

    if (criteria.minIntentScore !== undefined) {
      conditions.push(gte(leads.intentScore, criteria.minIntentScore));
    }

    if (criteria.maxIntentScore !== undefined) {
      conditions.push(lte(leads.intentScore, criteria.maxIntentScore));
    }

    if (criteria.statuses && criteria.statuses.length > 0) {
      conditions.push(inArray(leads.status, criteria.statuses));
    }

    if (criteria.sources && criteria.sources.length > 0) {
      conditions.push(inArray(leads.source, criteria.sources));
    }

    if (criteria.lastActiveDays) {
      const cutoff = new Date(Date.now() - criteria.lastActiveDays * 86400000);
      conditions.push(gte(leads.updatedAt, cutoff));
    }

    // Buyer DNA budget checks if specified
    if (criteria.budgetMin !== undefined) {
      conditions.push(sql`(${leads.buyerDna}->>'budgetMax')::numeric >= ${criteria.budgetMin}`);
    }

    if (criteria.budgetMax !== undefined) {
      conditions.push(sql`(${leads.buyerDna}->>'budgetMax')::numeric <= ${criteria.budgetMax}`);
    }

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(...conditions));

    return result?.count ?? 0;
  }

  /**
   * Retrieves all matching lead IDs for a segment.
   */
  async getMatchingLeads(companyId: string, criteria: SegmentFilterCriteria) {
    const conditions = [
      eq(leads.companyId, companyId),
      sql`${leads.deletedAt} IS NULL`,
    ];

    if (criteria.intentLabels && criteria.intentLabels.length > 0) {
      conditions.push(inArray(leads.intentLabel, criteria.intentLabels));
    }

    if (criteria.minIntentScore !== undefined) {
      conditions.push(gte(leads.intentScore, criteria.minIntentScore));
    }

    if (criteria.statuses && criteria.statuses.length > 0) {
      conditions.push(inArray(leads.status, criteria.statuses));
    }

    return await db
      .select({
        id: leads.id,
        contactId: leads.contactId,
        intentScore: leads.intentScore,
        intentLabel: leads.intentLabel,
        status: leads.status,
      })
      .from(leads)
      .where(and(...conditions))
      .limit(500);
  }

  async listSegments(companyId: string) {
    return await db
      .select()
      .from(segments)
      .where(eq(segments.companyId, companyId))
      .orderBy(sql`${segments.createdAt} DESC`);
  }

  async createSegment(companyId: string, userId: string | undefined, data: CreateSegmentRequest) {
    const cachedCount = await this.evaluateCount(companyId, data.filterCriteria);

    const [created] = await db
      .insert(segments)
      .values({
        companyId,
        name: data.name,
        description: data.description,
        filterCriteria: data.filterCriteria,
        cachedCount,
        createdBy: userId,
      })
      .returning();

    return created;
  }

  async getSegment(companyId: string, segmentId: string) {
    const [seg] = await db
      .select()
      .from(segments)
      .where(and(eq(segments.id, segmentId), eq(segments.companyId, companyId)))
      .limit(1);

    if (!seg) return null;

    // Refresh live count
    const liveCount = await this.evaluateCount(companyId, seg.filterCriteria as SegmentFilterCriteria);
    return { ...seg, liveCount };
  }
}

export const segmentsService = new SegmentsService();
