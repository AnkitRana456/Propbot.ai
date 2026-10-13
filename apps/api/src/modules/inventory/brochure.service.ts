import { db } from '../../db/index.js';
import { brochures, projects, leads, leadActivities, domainEvents } from '../../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import type {
  PropertyBrochureItem,
  CreateBrochureInput,
  RequestBrochureInput,
  RequestBrochureResponse,
} from '@propbot/shared';
import crypto from 'crypto';
import { IntentScorerService } from '../leads/intent-scorer.service.js';

export class BrochureService {
  private intentScorer = new IntentScorerService();

  /**
   * Lists brochures for a project.
   */
  async listBrochures(companyId: string, projectId: string): Promise<PropertyBrochureItem[]> {
    const rows = await db
      .select({
        brochure: brochures,
        projectName: projects.name,
      })
      .from(brochures)
      .leftJoin(projects, eq(brochures.projectId, projects.id))
      .where(and(eq(brochures.companyId, companyId), eq(brochures.projectId, projectId)));

    return rows.map(r => ({
      id: r.brochure.id,
      companyId: r.brochure.companyId,
      projectId: r.brochure.projectId,
      projectName: r.projectName ?? undefined,
      title: r.brochure.title,
      fileUrl: r.brochure.fileUrl,
      isGated: r.brochure.isGated,
      downloadCount: r.brochure.downloadCount,
      createdAt: r.brochure.createdAt.toISOString(),
      updatedAt: r.brochure.updatedAt.toISOString(),
    }));
  }

  /**
   * Registers a brochure for a project.
   */
  async createBrochure(companyId: string, projectId: string, input: CreateBrochureInput): Promise<PropertyBrochureItem> {
    const targetProjectId = projectId || input.projectId!;
    const [created] = await db
      .insert(brochures)
      .values({
        companyId,
        projectId: targetProjectId,
        title: input.title,
        fileUrl: input.fileUrl,
        isGated: input.isGated ?? true,
      })
      .returning();

    if (!created) {
      throw new Error('Failed to create brochure');
    }

    return {
      id: created.id,
      companyId: created.companyId,
      projectId: created.projectId,
      title: created.title,
      fileUrl: created.fileUrl,
      isGated: created.isGated,
      downloadCount: created.downloadCount,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  /**
   * Generates a tracked request for brochure download.
   * If gated, enforces phone/email capture.
   */
  async requestBrochure(
    companyId: string,
    brochureId: string,
    input: RequestBrochureInput,
  ): Promise<RequestBrochureResponse> {
    const [brochure] = await db
      .select()
      .from(brochures)
      .where(and(eq(brochures.id, brochureId), eq(brochures.companyId, companyId)));

    if (!brochure) {
      const err = new Error('Brochure not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    // Check gating
    if (brochure.isGated) {
      const hasContact = Boolean(input.phone?.trim() || input.email?.trim() || input.leadId);
      if (!hasContact) {
        return {
          gated: true,
          requiredFields: ['phone', 'email'],
        };
      }
    }

    // Build signed token payload: brochureId:companyId:leadId:timestamp:signature
    const leadId = input.leadId || '';
    const timestamp = Date.now();
    const secret = process.env.JWT_ACCESS_SECRET || 'propbot-secret-key';
    const rawPayload = `${brochure.id}:${companyId}:${leadId}:${timestamp}`;
    const sig = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex').slice(0, 16);
    const token = Buffer.from(`${rawPayload}:${sig}`).toString('base64url');

    const downloadUrl = `/api/properties/brochures/track/${token}`;

    return {
      gated: false,
      downloadUrl,
      trackingToken: token,
      brochure: {
        id: brochure.id,
        companyId: brochure.companyId,
        projectId: brochure.projectId,
        title: brochure.title,
        fileUrl: brochure.fileUrl,
        isGated: brochure.isGated,
        downloadCount: brochure.downloadCount,
        createdAt: brochure.createdAt.toISOString(),
        updatedAt: brochure.updatedAt.toISOString(),
      },
    };
  }

  /**
   * Validates tracking token, increments download count, logs activity,
   * emits brochure_opened event, recalculates lead intent score, and returns target file URL.
   */
  async trackAndDownload(token: string): Promise<string> {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 5 || !parts[0] || !parts[1] || !parts[3] || !parts[4]) {
      const err = new Error('Invalid download token');
      Object.assign(err, { statusCode: 400 });
      throw err;
    }

    const brochureId = parts[0];
    const companyId = parts[1];
    const leadId = parts[2] || '';
    const timestampStr = parts[3];
    const providedSig = parts[4];
    const secret = process.env.JWT_ACCESS_SECRET || 'propbot-secret-key';
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${brochureId}:${companyId}:${leadId}:${timestampStr}`)
      .digest('hex')
      .slice(0, 16);

    if (providedSig !== expectedSig) {
      const err = new Error('Invalid or tampered download token');
      Object.assign(err, { statusCode: 400 });
      throw err;
    }

    // Check expiration (link valid for 7 days)
    const timestamp = parseInt(timestampStr, 10);
    if (Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) {
      const err = new Error('Download link has expired');
      Object.assign(err, { statusCode: 410 });
      throw err;
    }

    const [brochure] = await db
      .select()
      .from(brochures)
      .where(and(eq(brochures.id, brochureId), eq(brochures.companyId, companyId)));

    if (!brochure) {
      const err = new Error('Brochure not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    // 1. Increment download count
    await db
      .update(brochures)
      .set({
        downloadCount: sql`${brochures.downloadCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(brochures.id, brochureId));

    // 2. Track lead activity & domain event if leadId exists
    if (leadId) {
      const [lead] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.companyId, companyId)));

      if (lead && lead.contactId) {
        // Activity log
        await db.insert(leadActivities).values({
          companyId,
          leadId,
          contactId: lead.contactId,
          activityType: 'brochure_opened',
          title: `Brochure Opened: ${brochure.title}`,
          description: `Lead accessed brochure download for ${brochure.title}`,
          metadata: {
            brochureId: brochure.id,
            projectId: brochure.projectId,
            brochureTitle: brochure.title,
          },
        });

        // Domain event
        await db.insert(domainEvents).values({
          companyId,
          type: 'brochure_opened',
          payload: {
            lead_id: leadId,
            project_id: brochure.projectId,
            brochure_id: brochure.id,
          },
        });

        // Recalculate intent score (+15 for asking/opening brochure/pricing)
        const updatedScore = Math.min(100, (lead.intentScore || 0) + 15);
        const newPriority = updatedScore >= 70 ? 'high' : updatedScore >= 35 ? 'medium' : 'low';
        const newLabel = updatedScore >= 70 ? 'hot' : updatedScore >= 35 ? 'warm' : 'cold';

        await db
          .update(leads)
          .set({
            intentScore: updatedScore,
            intentLabel: newLabel,
            priority: newPriority,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, leadId));
      }
    }

    return brochure.fileUrl;
  }
}

export const brochureService = new BrochureService();
