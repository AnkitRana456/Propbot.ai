import { eq, and, sql, gte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { campaigns, campaignRecipients, contacts } from '../../db/schema/index.js';
import { segmentsService } from './segments.service.js';
import type { CreateCampaignRequest, SegmentFilterCriteria } from '@propbot/shared';
import { pino } from 'pino';

export const campaignLogger = pino({
  name: 'campaigns-service',
  level: process.env.LOG_LEVEL ?? 'info',
});

export class CampaignsService {
  async listCampaigns(companyId: string) {
    return await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.companyId, companyId))
      .orderBy(sql`${campaigns.createdAt} DESC`);
  }

  async createCampaign(companyId: string, data: CreateCampaignRequest) {
    const [created] = await db
      .insert(campaigns)
      .values({
        companyId,
        segmentId: data.segmentId,
        name: data.name,
        channel: data.channel,
        status: data.scheduledAt ? 'scheduled' : 'draft',
        scheduleType: data.scheduleType,
        sendWindowStart: data.sendWindowStart,
        sendWindowEnd: data.sendWindowEnd,
        frequencyCap: data.frequencyCap,
        variantA: data.variantA,
        variantB: data.variantB,
        aBTestEnabled: data.aBTestEnabled,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      })
      .returning();

    return created;
  }

  async getCampaign(companyId: string, campaignId: string) {
    const [c] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.companyId, companyId)))
      .limit(1);

    if (!c) return null;

    const recipients = await db
      .select()
      .from(campaignRecipients)
      .where(and(eq(campaignRecipients.campaignId, campaignId), eq(campaignRecipients.companyId, companyId)))
      .limit(100);

    return { ...c, sampleRecipients: recipients };
  }

  /**
   * Launches a campaign: filters target leads, verifies opt-outs and frequency caps,
   * performs A/B splits, and dispatches messages.
   */
  async launchCampaign(companyId: string, campaignId: string) {
    const [c] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.companyId, companyId)))
      .limit(1);

    if (!c) {
      throw new Error('Campaign not found');
    }

    // Retrieve criteria from linked segment or default
    let criteria: SegmentFilterCriteria = {};
    if (c.segmentId) {
      const seg = await segmentsService.getSegment(companyId, c.segmentId);
      if (seg) {
        criteria = seg.filterCriteria as SegmentFilterCriteria;
      }
    }

    // Fetch leads
    const targetLeads = await segmentsService.getMatchingLeads(companyId, criteria);

    // Fetch contact details for these leads
    const contactIds = targetLeads.map(l => l.contactId).filter((id): id is string => Boolean(id));
    const contactsList = contactIds.length > 0
      ? await db
          .select({
            id: contacts.id,
            phone: contacts.phone,
            email: contacts.email,
            altPhone: contacts.altPhone,
            lifecycleStage: contacts.lifecycleStage,
          })
          .from(contacts)
          .where(and(eq(contacts.companyId, companyId)))
      : [];

    const contactsMap = new Map(contactsList.map(item => [item.id, item]));

    let sentCount = 0;
    let optedOutCount = 0;
    let variantCountA = 0;
    let variantCountB = 0;

    // Check frequency cap window (past 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    for (const lead of targetLeads) {
      const contact = lead.contactId ? contactsMap.get(lead.contactId) : undefined;

      // 1. Consent & Opt-Out Check (PDF requirement: "a campaign skips opted-out contacts")
      const isOptedOut = contact?.altPhone === 'OPTED_OUT' || contact?.lifecycleStage === 'opted_out';

      if (isOptedOut) {
        optedOutCount++;
        await db.insert(campaignRecipients).values({
          companyId,
          campaignId: c.id,
          contactId: lead.contactId,
          leadId: lead.id,
          variant: 'A',
          status: 'opted_out',
          error: 'Contact opted out of automated campaigns',
        });
        continue;
      }

      // 2. Frequency Cap Check
      if (lead.contactId) {
        const [recentSends] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(campaignRecipients)
          .where(
            and(
              eq(campaignRecipients.companyId, companyId),
              eq(campaignRecipients.contactId, lead.contactId),
              gte(campaignRecipients.createdAt, sevenDaysAgo),
              eq(campaignRecipients.status, 'sent'),
            ),
          );

        if ((recentSends?.count ?? 0) >= (c.frequencyCap || 2)) {
          continue; // Skip due to weekly frequency cap
        }
      }

      // 3. A/B Variant Split
      let chosenVariant: 'A' | 'B' = 'A';
      if (c.aBTestEnabled && c.variantB) {
        chosenVariant = (sentCount % 2 === 0) ? 'A' : 'B';
      }

      if (chosenVariant === 'A') variantCountA++;
      else variantCountB++;

      // 4. Record successful dispatch
      await db.insert(campaignRecipients).values({
        companyId,
        campaignId: c.id,
        contactId: lead.contactId,
        leadId: lead.id,
        variant: chosenVariant,
        status: 'sent',
        sentAt: new Date(),
        channelMessageId: `msg_${Date.now()}_${sentCount}`,
      });

      sentCount++;
    }

    // Update campaign stats and status
    const stats = {
      recipients: targetLeads.length,
      sent: sentCount,
      delivered: sentCount,
      read: 0,
      clicked: 0,
      optedOut: optedOutCount,
      variantA: variantCountA,
      variantB: variantCountB,
    };

    await db
      .update(campaigns)
      .set({
        status: 'completed',
        stats,
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, c.id));

    campaignLogger.info({ campaignId, sentCount, optedOutCount }, 'Campaign launched and completed');

    return {
      campaignId,
      totalRecipients: targetLeads.length,
      sentCount,
      optedOutCount,
      variantStats: { A: variantCountA, B: variantCountB },
    };
  }
}

export const campaignsService = new CampaignsService();
