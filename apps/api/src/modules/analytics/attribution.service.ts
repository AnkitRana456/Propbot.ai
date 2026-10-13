import { and, eq, gte, isNull, lte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { leads, leadActivities, campaignSpends, conversations } from '../../db/schema/index.js';
import type { AttributionItem, AttributionResponse } from '@propbot/shared';

export class AttributionService {
  /**
   * Calculates campaign and channel attribution weights using first-touch, last-touch, or linear models.
   */
  async calculateAttribution(
    companyId: string,
    model: 'first_touch' | 'last_touch' | 'linear',
    startDate?: Date,
    endDate?: Date,
  ): Promise<AttributionResponse> {
    const leadConditions = [eq(leads.companyId, companyId), isNull(leads.deletedAt)];
    if (startDate) leadConditions.push(gte(leads.createdAt, startDate));
    if (endDate) leadConditions.push(lte(leads.createdAt, endDate));

    // Fetch leads within date range
    const leadRows = await db
      .select({
        id: leads.id,
        contactId: leads.contactId,
        source: leads.source,
        status: leads.status,
        customFields: leads.customFields,
        pageUrl: leads.pageUrl,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(and(...leadConditions));

    // Fetch recorded campaign spends for company
    const spendRows = await db
      .select()
      .from(campaignSpends)
      .where(eq(campaignSpends.companyId, companyId));

    // Map spends by campaign name
    const spendMap = new Map<string, number>();
    for (const spend of spendRows) {
      const key = spend.campaignName.toLowerCase();
      spendMap.set(key, (spendMap.get(key) ?? 0) + spend.spendAmount);
    }

    // Also get conversation counts per source to estimate visitors/channel traffic
    const convConditions = [eq(conversations.companyId, companyId)];
    if (startDate) convConditions.push(gte(conversations.createdAt, startDate));
    if (endDate) convConditions.push(lte(conversations.createdAt, endDate));

    const convRows = await db
      .select({
        channel: conversations.channel,
        metadata: conversations.metadata,
      })
      .from(conversations)
      .where(and(...convConditions));

    // Aggregate visitor counts by campaign / source
    const visitorCountMap = new Map<string, number>();
    for (const c of convRows) {
      const meta = (c.metadata as Record<string, unknown>) || {};
      const campaign = (meta.utm_campaign as string) || (meta.campaign as string) || 'Direct / Organic';
      visitorCountMap.set(campaign, (visitorCountMap.get(campaign) ?? 0) + 1);
    }

    // Lead attribution tracking: campaign -> stats
    interface CampaignStats {
      campaign: string;
      source: string;
      medium: string;
      creditedLeads: number;
      visitsBooked: number;
      dealsClosed: number;
    }

    const campaignStatsMap = new Map<string, CampaignStats>();

    const getOrCreateStats = (campaign: string, source: string, medium = 'cpc'): CampaignStats => {
      let stats = campaignStatsMap.get(campaign);
      if (!stats) {
        stats = {
          campaign,
          source,
          medium,
          creditedLeads: 0,
          visitsBooked: 0,
          dealsClosed: 0,
        };
        campaignStatsMap.set(campaign, stats);
      }
      return stats;
    };

    // Process each lead's touchpoints
    for (const lead of leadRows) {
      const custom = (lead.customFields as Record<string, unknown>) || {};
      const initialCampaign =
        (custom.utm_campaign as string) ||
        (custom.campaign as string) ||
        (lead.source === '99acres' || lead.source === 'magicbricks' || lead.source === 'housing'
          ? `${lead.source}_portal`
          : 'Direct / Organic');

      const isVisitBooked =
        lead.status === 'site_visit_scheduled' ||
        lead.status === 'site_visit_done' ||
        lead.status === 'negotiation' ||
        lead.status === 'booked';
      const isDealClosed = lead.status === 'booked';

      // Query activities for this lead to discover additional touchpoints
      const activities = await db
        .select({
          activityType: leadActivities.activityType,
          metadata: leadActivities.metadata,
          createdAt: leadActivities.createdAt,
        })
        .from(leadActivities)
        .where(
          and(eq(leadActivities.companyId, companyId), eq(leadActivities.leadId, lead.id)),
        )
        .orderBy(leadActivities.createdAt);

      const touchpoints: Array<{ campaign: string; source: string }> = [
        { campaign: initialCampaign, source: lead.source },
      ];

      for (const act of activities) {
        const meta = (act.metadata as Record<string, unknown>) || {};
        if (meta.utm_campaign || meta.campaign) {
          const actCampaign = String(meta.utm_campaign || meta.campaign);
          const actSource = String(meta.utm_source || meta.source || lead.source);
          touchpoints.push({ campaign: actCampaign, source: actSource });
        }
      }

      if (model === 'first_touch') {
        const first = touchpoints[0]!;
        const stats = getOrCreateStats(first.campaign, first.source);
        stats.creditedLeads += 1;
        if (isVisitBooked) stats.visitsBooked += 1;
        if (isDealClosed) stats.dealsClosed += 1;
      } else if (model === 'last_touch') {
        const last = touchpoints[touchpoints.length - 1]!;
        const stats = getOrCreateStats(last.campaign, last.source);
        stats.creditedLeads += 1;
        if (isVisitBooked) stats.visitsBooked += 1;
        if (isDealClosed) stats.dealsClosed += 1;
      } else {
        // Linear: equal credit across distinct touchpoints
        const weight = 1 / touchpoints.length;
        for (const tp of touchpoints) {
          const stats = getOrCreateStats(tp.campaign, tp.source);
          stats.creditedLeads += weight;
          if (isVisitBooked) stats.visitsBooked += weight;
          if (isDealClosed) stats.dealsClosed += weight;
        }
      }
    }

    // Build finalized attribution items
    const results: AttributionItem[] = [];

    for (const [campaign, stats] of campaignStatsMap.entries()) {
      const visitors = Math.max(
        Math.round(stats.creditedLeads),
        visitorCountMap.get(campaign) ?? Math.round(stats.creditedLeads * 3),
      );
      const roundedLeads = Number(stats.creditedLeads.toFixed(1));
      const conversionRate = visitors > 0 ? Number(((roundedLeads / visitors) * 100).toFixed(1)) : 0;
      const spend = spendMap.get(campaign.toLowerCase());
      const costPerLead =
        spend !== undefined && roundedLeads > 0 ? Math.round(spend / roundedLeads) : undefined;

      results.push({
        campaign,
        source: stats.source,
        medium: stats.medium,
        visitors,
        leads: Math.round(roundedLeads),
        visitsBooked: Math.round(stats.visitsBooked),
        dealsClosed: Math.round(stats.dealsClosed),
        conversionRate,
        spend,
        costPerLead,
      });
    }

    // If no leads or campaigns found, provide empty array
    return {
      model,
      campaigns: results.sort((a, b) => b.leads - a.leads),
    };
  }
}

export const attributionService = new AttributionService();
