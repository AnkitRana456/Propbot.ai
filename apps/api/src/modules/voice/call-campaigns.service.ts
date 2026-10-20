import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import { callingWindowSchema, retryPolicySchema, type CallCampaignItem, type CreateCallCampaignInput } from '@propbot/shared';
import { db } from '../../db/index.js';
import { callCampaignTargets, callCampaigns, companyAiSettings, contacts, leads, segments, voiceAgents, voiceCalls } from '../../db/schema/index.js';
import { badRequest, conflict, notFound } from '../../utils/api-error.js';
import { segmentsService } from '../growth/segments.service.js';
import { MockTelephonyProvider } from './providers/mock-telephony.provider.js';
import { ExotelTelephonyProvider } from './providers/exotel-telephony.provider.js';
import type { TelephonyProvider } from './providers/telephony-provider.interface.js';
import { inCallingWindow } from './call-signals.js';
import { isDnd, normalizeDndPhone } from './dnd.js';

type CampaignRow = typeof callCampaigns.$inferSelect;
type TargetStatus = 'pending' | 'calling' | 'done' | 'failed' | 'skipped_dnd' | 'skipped_no_consent';

const telephony = (): TelephonyProvider => (process.env.TELEPHONY_PROVIDER === 'exotel' ? new ExotelTelephonyProvider() : new MockTelephonyProvider());
const hasConsent = (custom: unknown) => {
  const c = (custom as Record<string, unknown> | null) ?? {};
  return c.callConsent === true || c.consent === true || c.call_consent === true;
};

class CallCampaignsService {
  private async progress(id: string) {
    const rows = await db
      .select({ status: callCampaignTargets.status, n: sql<number>`count(*)::int` })
      .from(callCampaignTargets)
      .where(eq(callCampaignTargets.campaignId, id))
      .groupBy(callCampaignTargets.status);
    const by = (s: string) => rows.find(r => r.status === s)?.n ?? 0;
    const total = rows.reduce((a, r) => a + r.n, 0);
    return { total, pending: by('pending'), calling: by('calling'), done: by('done'), skipped: by('skipped_dnd') + by('skipped_no_consent'), failed: by('failed') };
  }

  private async toItem(r: CampaignRow): Promise<CallCampaignItem> {
    return {
      id: r.id,
      name: r.name,
      voiceAgentId: r.voiceAgentId,
      status: r.status as CallCampaignItem['status'],
      concurrency: r.concurrency,
      callingWindow: callingWindowSchema.parse(r.callingWindow),
      retryPolicy: retryPolicySchema.parse(r.retryPolicy),
      stats: r.stats,
      progress: await this.progress(r.id),
      startsAt: r.startsAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private async mustGet(companyId: string, id: string): Promise<CampaignRow> {
    const [r] = await db.select().from(callCampaigns).where(and(eq(callCampaigns.id, id), eq(callCampaigns.companyId, companyId)));
    if (!r) throw notFound('Campaign');
    return r;
  }

  async list(companyId: string): Promise<CallCampaignItem[]> {
    const rows = await db.select().from(callCampaigns).where(eq(callCampaigns.companyId, companyId)).orderBy(desc(callCampaigns.createdAt));
    return Promise.all(rows.map(r => this.toItem(r)));
  }

  async get(companyId: string, id: string) {
    return this.toItem(await this.mustGet(companyId, id));
  }

  /** Builds the call list. DND and missing-consent contacts are recorded as skipped, never dialled. */
  async create(companyId: string, userId: string | null, input: CreateCallCampaignInput): Promise<CallCampaignItem> {
    const [va] = await db.select({ id: voiceAgents.id }).from(voiceAgents).where(and(eq(voiceAgents.id, input.voiceAgentId), eq(voiceAgents.companyId, companyId)));
    if (!va) throw badRequest('VOICE_AGENT_INVALID', 'That voice agent does not exist.');

    let leadIds = input.leadIds ?? [];
    if (input.segmentId) {
      const [seg] = await db.select().from(segments).where(and(eq(segments.id, input.segmentId), eq(segments.companyId, companyId)));
      if (!seg) throw badRequest('SEGMENT_INVALID', 'That segment does not exist.');
      leadIds = (await segmentsService.getMatchingLeads(companyId, seg.filterCriteria as never)).map(l => l.id);
    }
    if (leadIds.length === 0) throw badRequest('CAMPAIGN_EMPTY', 'There is nobody to call: the audience is empty.');

    const rows = await db
      .select({ leadId: leads.id, contactId: leads.contactId, phone: contacts.phone, custom: leads.customFields, optedOut: contacts.lifecycleStage })
      .from(leads)
      .innerJoin(contacts, eq(contacts.id, leads.contactId))
      .where(and(eq(leads.companyId, companyId), inArray(leads.id, leadIds)));

    const [campaign] = await db
      .insert(callCampaigns)
      .values({
        companyId,
        name: input.name,
        voiceAgentId: input.voiceAgentId,
        segmentId: input.segmentId ?? null,
        callingWindow: input.callingWindow,
        retryPolicy: input.retryPolicy,
        concurrency: input.concurrency,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        createdBy: userId,
      })
      .returning();

    const seen = new Set<string>();
    for (const r of rows) {
      const phone = normalizeDndPhone(r.phone);
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      const status: TargetStatus = (await isDnd(companyId, phone)) || r.optedOut === 'opted_out' ? 'skipped_dnd' : hasConsent(r.custom) ? 'pending' : 'skipped_no_consent';
      await db.insert(callCampaignTargets).values({ companyId, campaignId: campaign!.id, leadId: r.leadId, contactId: r.contactId, phone, status });
    }
    return this.toItem(campaign!);
  }

  async setStatus(companyId: string, id: string, status: 'running' | 'paused' | 'cancelled'): Promise<CallCampaignItem> {
    const cur = await this.mustGet(companyId, id);
    if (cur.status === 'completed' || cur.status === 'cancelled') throw conflict('CAMPAIGN_FINISHED', `This campaign is already ${cur.status}.`);
    const next = status === 'running' && cur.startsAt && cur.startsAt.getTime() > Date.now() ? 'scheduled' : status;
    const [r] = await db.update(callCampaigns).set({ status: next, updatedAt: new Date() }).where(eq(callCampaigns.id, id)).returning();
    if (status === 'cancelled') await db.update(callCampaignTargets).set({ status: 'failed', outcome: 'cancelled' }).where(and(eq(callCampaignTargets.campaignId, id), eq(callCampaignTargets.status, 'pending')));
    return this.toItem(r!);
  }

  /**
   * Worker tick: places due calls for running campaigns, honouring the calling window, the concurrency cap,
   * DND (re-checked at dial time), consent and the company kill switch. Returns how many calls were placed.
   */
  async tick(now = new Date()): Promise<number> {
    await db.update(callCampaigns).set({ status: 'running', updatedAt: now }).where(and(eq(callCampaigns.status, 'scheduled'), lte(callCampaigns.startsAt, now)));
    const running = await db.select().from(callCampaigns).where(eq(callCampaigns.status, 'running'));
    let placed = 0;

    for (const c of running) {
      const [settings] = await db.select({ kill: companyAiSettings.killSwitch }).from(companyAiSettings).where(eq(companyAiSettings.companyId, c.companyId));
      if (settings?.kill) continue;
      const window = callingWindowSchema.parse(c.callingWindow);
      if (!inCallingWindow(window, now)) continue;

      const [{ n: active } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(callCampaignTargets).where(and(eq(callCampaignTargets.campaignId, c.id), eq(callCampaignTargets.status, 'calling')));
      const slots = c.concurrency - active;
      if (slots > 0) {
        const due = await db
          .select()
          .from(callCampaignTargets)
          .where(and(eq(callCampaignTargets.campaignId, c.id), eq(callCampaignTargets.status, 'pending'), lte(callCampaignTargets.nextAttemptAt, now)))
          .orderBy(callCampaignTargets.nextAttemptAt)
          .limit(slots);
        for (const t of due) {
          if (await isDnd(c.companyId, t.phone)) {
            await db.update(callCampaignTargets).set({ status: 'skipped_dnd' }).where(eq(callCampaignTargets.id, t.id));
            continue;
          }
          // claim the target before dialling so two workers never call the same person
          const claimed = await db.update(callCampaignTargets).set({ status: 'calling', attempts: t.attempts + 1 }).where(and(eq(callCampaignTargets.id, t.id), eq(callCampaignTargets.status, 'pending'))).returning({ id: callCampaignTargets.id });
          if (claimed.length === 0) continue;
          try {
            const out = await telephony().initiateCall({ companyId: c.companyId, leadId: t.leadId ?? '', to: t.phone, from: process.env.TELEPHONY_CALLER_ID ?? '+918040001000', callbackUrl: `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/voice/webhooks/status` });
            const [call] = await db
              .insert(voiceCalls)
              .values({ companyId: c.companyId, leadId: t.leadId, contactId: t.contactId, callSid: out.callSid, direction: 'outbound_campaign', fromNumber: process.env.TELEPHONY_CALLER_ID ?? '+918040001000', toNumber: t.phone, status: 'in_progress', voiceAgentId: c.voiceAgentId, campaignId: c.id, startedAt: now, disclosedAsAi: true })
              .returning({ id: voiceCalls.id });
            await db.update(callCampaignTargets).set({ callId: call!.id }).where(eq(callCampaignTargets.id, t.id));
            placed++;
          } catch {
            await this.settleTarget(t.id, c, 'failed');
          }
        }
      }
      await this.maybeComplete(c.id);
    }
    return placed;
  }

  /** Marks a target finished, or schedules a retry for no-answer/busy results. */
  private async settleTarget(targetId: string, c: CampaignRow, outcome: string) {
    const [t] = await db.select().from(callCampaignTargets).where(eq(callCampaignTargets.id, targetId));
    if (!t) return;
    const policy = retryPolicySchema.parse(c.retryPolicy);
    const retryable = outcome === 'no_answer' || outcome === 'busy' || outcome === 'failed';
    if (retryable && t.attempts < policy.maxAttempts) {
      await db.update(callCampaignTargets).set({ status: 'pending', outcome, nextAttemptAt: new Date(Date.now() + policy.gapMinutes * 60_000) }).where(eq(callCampaignTargets.id, targetId));
    } else {
      await db.update(callCampaignTargets).set({ status: retryable ? 'failed' : 'done', outcome }).where(eq(callCampaignTargets.id, targetId));
    }
  }

  /** Called when a call ends (engine or telephony webhook). */
  async onCallFinished(callId: string): Promise<void> {
    const [call] = await db.select().from(voiceCalls).where(eq(voiceCalls.id, callId));
    if (!call?.campaignId) return;
    const [c] = await db.select().from(callCampaigns).where(eq(callCampaigns.id, call.campaignId));
    const [t] = await db.select().from(callCampaignTargets).where(eq(callCampaignTargets.callId, callId));
    if (!c || !t) return;
    const outcome = call.outcome ?? (call.status === 'no_answer' ? 'no_answer' : call.status === 'busy' ? 'busy' : call.status === 'failed' ? 'failed' : 'connected');
    await this.settleTarget(t.id, c, outcome);
    const stats = { ...c.stats, [outcome]: (c.stats[outcome] ?? 0) + 1 };
    await db.update(callCampaigns).set({ stats, updatedAt: new Date() }).where(eq(callCampaigns.id, c.id));
    await this.maybeComplete(c.id);
  }

  private async maybeComplete(id: string) {
    const p = await this.progress(id);
    if (p.total > 0 && p.pending === 0 && p.calling === 0) {
      await db.update(callCampaigns).set({ status: 'completed', updatedAt: new Date() }).where(and(eq(callCampaigns.id, id), eq(callCampaigns.status, 'running')));
    }
  }

  async targets(companyId: string, id: string) {
    await this.mustGet(companyId, id);
    const rows = await db.select().from(callCampaignTargets).where(and(eq(callCampaignTargets.campaignId, id), eq(callCampaignTargets.companyId, companyId))).orderBy(callCampaignTargets.createdAt).limit(500);
    return rows.map(t => ({ id: t.id, phone: t.phone, status: t.status, attempts: t.attempts, outcome: t.outcome, callId: t.callId, nextAttemptAt: t.nextAttemptAt.toISOString() }));
  }
}

export const callCampaignsService = new CallCampaignsService();
