import crypto from 'node:crypto';
import { and, asc, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import type {
  CallEventItem,
  CreatePhoneNumberInput,
  CreateVoiceAgentInput,
  DndInput,
  PhoneNumberItem,
  TestCallTurnResult,
  UpdateVoiceAgentInput,
  VoiceAgentItem,
  VoiceAnalytics,
  VoiceCallDetail,
  VoiceCallListItem,
} from '@propbot/shared';
import { db } from '../../db/index.js';
import {
  callEvents,
  chatbots,
  companies,
  contacts,
  dndNumbers,
  leadActivities,
  leads,
  phoneNumbers,
  usageLedger,
  voiceAgents,
  voiceCalls,
} from '../../db/schema/index.js';
import { badRequest, conflict, notFound } from '../../utils/api-error.js';
import { CALL_MINUTE_CREDITS, paymentsService } from '../payments/payments.service.js';
import { agentsService } from '../agents/agents.service.js';
import { buildAgentInstructions, type RuntimeContext } from '../agents/agent-runtime.js';
import { retrievalService } from '../ai/retrieval.service.js';
import { modelRouter, TaskTier } from '../ai/router.js';
import { liveInventoryFacts } from '../tools/live-inventory.js';
import { analyzeUtterance } from './call-signals.js';
import { addDnd, normalizeDndPhone } from './dnd.js';
import { voiceService } from './voice.service.js';

type VARow = typeof voiceAgents.$inferSelect;
const calls = voiceCalls;
const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toVoiceAgent(r: VARow): VoiceAgentItem {
  const { chatbotId, ...voice } = r.voice as Record<string, unknown> & { chatbotId?: string };
  return {
    id: r.id,
    name: r.name,
    agentId: r.agentId,
    chatbotId: chatbotId ?? null,
    voice: voice as VoiceAgentItem['voice'],
    greeting: r.greeting,
    closing: r.closing,
    escalationRules: r.escalationRules as VoiceAgentItem['escalationRules'],
    recordingConsentScript: r.recordingConsentScript,
    maxCallSeconds: r.maxCallSeconds,
    status: r.status as VoiceAgentItem['status'],
    createdAt: r.createdAt.toISOString(),
  };
}

const AI_DISCLOSURE = 'This is an AI assistant calling on behalf of';
const VOICE_RULES =
  'VOICE CALL RULES:\n- You are speaking aloud on a phone call. Use short, natural sentences. No lists, markdown or emojis.\n' +
  '- At most two sentences per turn and at most one question.\n- Never invent prices or availability; use only the facts you are given.\n- If asked whether you are a person, say you are an AI assistant.';

class VoiceStudioService {
  // ---------------------------------------------------------------- voice agents
  private async mustAgent(companyId: string, id: string): Promise<VARow> {
    const [r] = await db.select().from(voiceAgents).where(and(eq(voiceAgents.id, id), eq(voiceAgents.companyId, companyId), isNull(voiceAgents.deletedAt)));
    if (!r) throw notFound('Voice agent');
    return r;
  }

  private async assertRefs(companyId: string, agentId?: string | null, chatbotId?: string | null) {
    if (agentId) {
      await agentsService.get(companyId, agentId);
    }
    if (chatbotId) {
      const [b] = await db.select({ id: chatbots.id }).from(chatbots).where(and(eq(chatbots.id, chatbotId), eq(chatbots.companyId, companyId)));
      if (!b) throw badRequest('CHATBOT_INVALID', 'That chatbot does not exist.');
    }
  }

  async listAgents(companyId: string): Promise<VoiceAgentItem[]> {
    const rows = await db.select().from(voiceAgents).where(and(eq(voiceAgents.companyId, companyId), isNull(voiceAgents.deletedAt))).orderBy(desc(voiceAgents.createdAt));
    return rows.map(toVoiceAgent);
  }

  async createAgent(companyId: string, input: CreateVoiceAgentInput): Promise<VoiceAgentItem> {
    await this.assertRefs(companyId, input.agentId, input.chatbotId);
    const [r] = await db
      .insert(voiceAgents)
      .values({
        companyId,
        name: input.name,
        agentId: input.agentId ?? null,
        voice: { ...input.voice, ...(input.chatbotId ? { chatbotId: input.chatbotId } : {}) },
        greeting: input.greeting ?? null,
        closing: input.closing ?? null,
        escalationRules: input.escalationRules,
        recordingConsentScript: input.recordingConsentScript ?? null,
        maxCallSeconds: input.maxCallSeconds,
      })
      .returning();
    return toVoiceAgent(r!);
  }

  async updateAgent(companyId: string, id: string, input: UpdateVoiceAgentInput): Promise<VoiceAgentItem> {
    const cur = await this.mustAgent(companyId, id);
    await this.assertRefs(companyId, input.agentId, input.chatbotId);
    const patch: Partial<typeof voiceAgents.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.agentId !== undefined) patch.agentId = input.agentId;
    if (input.greeting !== undefined) patch.greeting = input.greeting;
    if (input.closing !== undefined) patch.closing = input.closing;
    if (input.escalationRules !== undefined) patch.escalationRules = input.escalationRules;
    if (input.recordingConsentScript !== undefined) patch.recordingConsentScript = input.recordingConsentScript;
    if (input.maxCallSeconds !== undefined) patch.maxCallSeconds = input.maxCallSeconds;
    if (input.status !== undefined) patch.status = input.status;
    if (input.voice !== undefined || input.chatbotId !== undefined) {
      const prev = cur.voice as Record<string, unknown>;
      const chatbotId = input.chatbotId === undefined ? prev.chatbotId : input.chatbotId;
      patch.voice = { ...(input.voice ?? { ...prev, chatbotId: undefined }), ...(chatbotId ? { chatbotId } : {}) };
    }
    const [r] = await db.update(voiceAgents).set(patch).where(eq(voiceAgents.id, id)).returning();
    return toVoiceAgent(r!);
  }

  async removeAgent(companyId: string, id: string): Promise<void> {
    await this.mustAgent(companyId, id);
    const { callCampaigns } = await import('../../db/schema/index.js');
    const [inUse] = await db.select({ name: callCampaigns.name }).from(callCampaigns).where(and(eq(callCampaigns.voiceAgentId, id), sql`${callCampaigns.status} IN ('scheduled','running','paused')`)).limit(1);
    if (inUse) throw conflict('VOICE_AGENT_IN_USE', `Used by the active campaign "${inUse.name}".`);
    await db.update(voiceAgents).set({ deletedAt: new Date(), status: 'paused' }).where(eq(voiceAgents.id, id));
    await db.update(phoneNumbers).set({ voiceAgentId: null }).where(eq(phoneNumbers.voiceAgentId, id));
  }

  // ---------------------------------------------------------------- numbers & DND
  async listNumbers(companyId: string): Promise<PhoneNumberItem[]> {
    const rows = await db.select().from(phoneNumbers).where(eq(phoneNumbers.companyId, companyId)).orderBy(desc(phoneNumbers.createdAt));
    return rows.map(r => ({ id: r.id, provider: r.provider, number: r.number, voiceAgentId: r.voiceAgentId, direction: r.direction, status: r.status, createdAt: r.createdAt.toISOString() }));
  }

  async addNumber(companyId: string, input: CreatePhoneNumberInput): Promise<PhoneNumberItem> {
    if (input.voiceAgentId) await this.mustAgent(companyId, input.voiceAgentId);
    try {
      const [r] = await db.insert(phoneNumbers).values({ companyId, provider: input.provider, number: input.number, voiceAgentId: input.voiceAgentId ?? null, direction: input.direction }).returning();
      return { id: r!.id, provider: r!.provider, number: r!.number, voiceAgentId: r!.voiceAgentId, direction: r!.direction, status: r!.status, createdAt: r!.createdAt.toISOString() };
    } catch (e) {
      if (/duplicate key|unique/i.test(String((e as Error).message) + String((e as { cause?: Error }).cause?.message ?? ''))) {
        throw conflict('NUMBER_TAKEN', 'That number is already registered.');
      }
      throw e;
    }
  }

  async assignNumber(companyId: string, id: string, voiceAgentId: string | null): Promise<void> {
    if (voiceAgentId) await this.mustAgent(companyId, voiceAgentId);
    const res = await db.update(phoneNumbers).set({ voiceAgentId }).where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.companyId, companyId))).returning({ id: phoneNumbers.id });
    if (res.length === 0) throw notFound('Phone number');
  }

  async removeNumber(companyId: string, id: string): Promise<void> {
    const res = await db.delete(phoneNumbers).where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.companyId, companyId))).returning({ id: phoneNumbers.id });
    if (res.length === 0) throw notFound('Phone number');
  }

  async listDnd(companyId: string) {
    const rows = await db.select().from(dndNumbers).where(eq(dndNumbers.companyId, companyId)).orderBy(desc(dndNumbers.createdAt)).limit(500);
    return rows.map(r => ({ id: r.id, phone: r.phone, reason: r.reason, createdAt: r.createdAt.toISOString() }));
  }
  async addDndNumbers(companyId: string, input: DndInput): Promise<{ added: number }> {
    const phones = [...new Set(input.phones.map(p => normalizeDndPhone(p)).filter(Boolean))];
    for (const p of phones) await addDnd(companyId, p, input.reason);
    return { added: phones.length };
  }
  async removeDnd(companyId: string, id: string): Promise<void> {
    const res = await db.delete(dndNumbers).where(and(eq(dndNumbers.id, id), eq(dndNumbers.companyId, companyId))).returning({ id: dndNumbers.id });
    if (res.length === 0) throw notFound('Number');
  }

  // ---------------------------------------------------------------- call engine (provider-agnostic, turn based)
  private async log(companyId: string, callId: string, startedAt: Date | null, type: string, speaker: string | null, payload: Record<string, unknown>) {
    await db.insert(callEvents).values({ companyId, callId, type, speaker, payload, offsetMs: startedAt ? Math.max(0, Date.now() - startedAt.getTime()) : 0 });
  }

  /** Starts a simulated call (browser test) — no telephony, no charges, never touches DND lists. */
  async startTestCall(companyId: string, voiceAgentId: string, leadId?: string): Promise<{ callId: string; greeting: string }> {
    const va = await this.mustAgent(companyId, voiceAgentId);
    if (va.status !== 'active') throw conflict('VOICE_AGENT_PAUSED', 'This voice agent is paused.');
    let contactId: string | null = null;
    let contactName = 'there';
    if (leadId) {
      const [l] = await db.select({ contactId: leads.contactId, first: contacts.firstName }).from(leads).innerJoin(contacts, eq(contacts.id, leads.contactId)).where(and(eq(leads.id, leadId), eq(leads.companyId, companyId)));
      if (!l) throw notFound('Lead');
      contactId = l.contactId;
      contactName = l.first;
    }
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId));
    const greeting = this.greetingFor(va, company?.name ?? 'our team', contactName);
    const startedAt = new Date();
    const [call] = await db
      .insert(voiceCalls)
      .values({
        companyId,
        leadId: leadId ?? null,
        contactId,
        callSid: `test_${crypto.randomBytes(8).toString('hex')}`,
        direction: 'test',
        fromNumber: 'browser',
        toNumber: 'browser',
        status: 'in_progress',
        voiceAgentId,
        language: (va.voice as { language?: string }).language ?? 'en-IN',
        recordingConsent: null,
        startedAt,
        disclosedAsAi: true,
        metadata: { simulated: true, negativeStreak: 0 },
      })
      .returning();
    await this.log(companyId, call!.id, startedAt, 'utterance', 'agent', { text: greeting });
    return { callId: call!.id, greeting };
  }

  greetingFor(va: VARow, companyName: string, contactName: string): string {
    const base = va.greeting?.trim() || `Hello ${contactName}, ${AI_DISCLOSURE} ${companyName}. Is this a good time to talk about your home search?`;
    const withName = base.replace(/\{\{\s*name\s*\}\}/gi, contactName).replace(/\{\{\s*company\s*\}\}/gi, companyName);
    const disclosed = /\bAI\b|artificial|virtual assistant/i.test(withName) ? withName : `${withName} (${AI_DISCLOSURE} ${companyName}.)`;
    return va.recordingConsentScript ? `${disclosed} ${va.recordingConsentScript}` : disclosed;
  }

  private async generateReply(companyId: string, va: VARow, callId: string, leadId: string | null, utterance: string, history: Array<{ role: 'visitor' | 'assistant'; content: string }>): Promise<string> {
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId));
    const liveFacts = await liveInventoryFacts(companyId, utterance);
    const chatbotId = ((va.voice as Record<string, unknown>).chatbotId as string | undefined) ?? null;
    try {
      const brain = va.agentId ? await agentsService.loadActive(companyId, va.agentId) : null;
      const ctx: RuntimeContext = { botName: va.name, companyName: company?.name ?? 'our team', visitorMessage: utterance, liveFacts };
      const instructions = `${brain ? buildAgentInstructions(brain.content, brain.formFields, ctx) : `You are ${va.name}, a friendly real-estate advisor for ${company?.name ?? 'our team'}.${liveFacts ? `\n\nLIVE INVENTORY (authoritative):\n${liveFacts}` : ''}`}\n\n${VOICE_RULES}`;
      if (chatbotId) {
        const res = await retrievalService.query(companyId, chatbotId, { query: utterance }, {
          sourceIds: brain?.sourceIds,
          agentInstructions: instructions,
          model: brain?.content.model,
          temperature: brain?.content.temperature ?? 0.5,
          maxTokens: 200,
          history,
          trace: { agentId: brain?.agentId, conversationId: undefined, channel: 'voice', purpose: 'chat' },
        });
        if (res.answer?.trim()) return res.answer.trim();
      } else if (modelRouter.isConfigured()) {
        const res = await modelRouter.executeCompletion({ tier: TaskTier.FAST, companyId, chatbotId: '', systemPrompt: instructions, userMessage: utterance, history, temperature: 0.5, maxTokens: 200, promptName: 'voice_turn' });
        if (res.text.trim()) return res.text.trim();
      }
    } catch {
      /* fall through to the safe scripted reply */
    }
    return liveFacts && !/NO matching/.test(liveFacts) ? 'We do have units matching that. Would you like me to arrange a site visit?' : 'Thanks for sharing that. Could you tell me your budget and the number of bedrooms you need?';
  }

  /** One caller utterance in, one agent utterance out. Safety decisions (DND, escalation) are rule-based. */
  async turn(companyId: string, callId: string, utterance: string): Promise<TestCallTurnResult> {
    const [call] = await db.select().from(voiceCalls).where(and(eq(voiceCalls.id, callId), eq(voiceCalls.companyId, companyId)));
    if (!call) throw notFound('Call');
    if (call.status !== 'in_progress') throw conflict('CALL_NOT_ACTIVE', 'This call has ended.');
    if (!call.voiceAgentId) throw badRequest('CALL_NO_AGENT', 'This call has no voice agent.');
    const va = await this.mustAgent(companyId, call.voiceAgentId);
    const rules = va.escalationRules as { keywords?: string[]; onPriceNegotiation?: boolean; negativeTurns?: number; transferNumber?: string | null };
    const meta = (call.metadata as Record<string, unknown>) ?? {};
    const startedAt = call.startedAt;

    if (startedAt && Date.now() - startedAt.getTime() > va.maxCallSeconds * 1000) {
      const closing = await this.endCall(companyId, callId, 'max_duration');
      return { reply: va.closing?.trim() || 'We have reached the time limit for this call. Thank you, goodbye.', ended: true, escalated: false, outcome: closing.outcome, signals: [] };
    }

    const sig = analyzeUtterance(utterance, rules.keywords ?? []);
    await this.log(companyId, callId, startedAt, 'utterance', 'caller', { text: utterance });
    await this.log(companyId, callId, startedAt, 'sentiment', 'caller', { value: sig.sentiment });
    const signals: Array<{ type: string; value: string }> = [];
    const mark = (type: string, value: string) => {
      signals.push({ type, value });
      return this.log(companyId, callId, startedAt, 'keyword', 'caller', { type, value });
    };
    if (sig.budget) await mark('budget', sig.budget);
    if (sig.bhk) await mark('bhk', sig.bhk);
    if (sig.visitIntent) await mark('site_visit', 'requested');

    const agentSays = async (reply: string) => this.log(companyId, callId, startedAt, 'utterance', 'agent', { text: reply });
    const finish = async (reply: string, reason: string, extra: { escalated?: boolean } = {}) => {
      await agentSays(reply);
      const done = await this.endCall(companyId, callId, reason, { escalated: extra.escalated });
      return { reply, ended: true, escalated: Boolean(extra.escalated), outcome: done.outcome, signals };
    };

    // 1. DND / opt-out: always honoured first
    if (sig.optOut) {
      await mark('opt_out', utterance.slice(0, 80));
      const phone = call.direction === 'test' ? null : call.toNumber;
      if (phone) await addDnd(companyId, phone, 'requested');
      if (call.contactId && call.direction !== 'test') await db.update(contacts).set({ altPhone: 'OPTED_OUT', lifecycleStage: 'opted_out', updatedAt: new Date() }).where(eq(contacts.id, call.contactId));
      return finish('Understood. I will not call you again. Sorry for the disturbance, goodbye.', 'opt_out');
    }
    if (sig.wrongNumber) return finish('Sorry about that, I will correct our records. Goodbye.', 'wrong_number');

    // 2. Escalation to a person
    const negativeStreak = sig.sentiment === 'negative' ? Number(meta.negativeStreak ?? 0) + 1 : 0;
    const escalateWhy = sig.wantsHuman ? 'caller_request' : rules.onPriceNegotiation !== false && sig.priceNegotiation ? 'price_negotiation' : negativeStreak >= (rules.negativeTurns ?? 2) ? 'negative_sentiment' : null;
    if (escalateWhy) {
      await this.log(companyId, callId, startedAt, 'transfer', 'agent', { reason: escalateWhy, to: rules.transferNumber ?? 'sales_team' });
      return finish('Let me connect you with one of our senior advisors who can help with that. Please stay on the line.', `escalated:${escalateWhy}`, { escalated: true });
    }
    await db.update(voiceCalls).set({ metadata: { ...meta, negativeStreak }, updatedAt: new Date() }).where(eq(voiceCalls.id, callId));

    if (sig.notInterested) return finish('No problem at all. Thank you for your time, and have a lovely day.', 'not_interested');
    if (sig.goodbye) return finish(va.closing?.trim() || 'Thank you for your time. Goodbye!', 'goodbye');

    // 3. A normal conversational turn
    const history = await this.history(callId, utterance);
    const reply = await this.generateReply(companyId, va, callId, call.leadId, utterance, history);
    await agentSays(reply);
    return { reply, ended: false, escalated: false, outcome: null, signals };
  }

  private async history(callId: string, current: string) {
    const rows = await db.select().from(callEvents).where(and(eq(callEvents.callId, callId), eq(callEvents.type, 'utterance'))).orderBy(asc(callEvents.offsetMs), asc(callEvents.createdAt));
    const turns = rows.map(r => ({ role: r.speaker === 'caller' ? ('visitor' as const) : ('assistant' as const), content: String((r.payload as { text?: string }).text ?? '') })).filter(t => t.content);
    if (turns.at(-1)?.role === 'visitor' && turns.at(-1)?.content === current) turns.pop();
    return turns.slice(-12);
  }

  /** Ends a call, derives the outcome from what was said, and writes the result back to the lead. */
  async endCall(companyId: string, callId: string, reason: string, opts: { escalated?: boolean } = {}): Promise<{ outcome: string }> {
    const [call] = await db.select().from(voiceCalls).where(and(eq(voiceCalls.id, callId), eq(voiceCalls.companyId, companyId)));
    if (!call) throw notFound('Call');
    if (call.status === 'completed') return { outcome: call.outcome ?? 'connected' };

    const events = await db.select().from(callEvents).where(eq(callEvents.callId, callId)).orderBy(asc(callEvents.offsetMs), asc(callEvents.createdAt));
    const caller = events.filter(e => e.type === 'utterance' && e.speaker === 'caller').length;
    const keywords = events.filter(e => e.type === 'keyword').map(e => e.payload as { type: string; value: string });
    const has = (t: string) => keywords.some(k => k.type === t);
    const transcript = events
      .filter(e => e.type === 'utterance')
      .map(e => `${e.speaker === 'caller' ? 'Caller' : 'Agent'}: ${String((e.payload as { text?: string }).text ?? '')}`)
      .join('\n');

    let outcome: string;
    if (reason === 'opt_out') outcome = 'dnd';
    else if (reason === 'not_interested') outcome = 'not_interested';
    else if (caller === 0) outcome = 'no_answer';
    else if (has('site_visit') || (has('budget') && has('bhk'))) outcome = 'qualified';
    else outcome = 'connected';

    const sentiments = events.filter(e => e.type === 'sentiment').map(e => (e.payload as { value?: string }).value);
    const neg = sentiments.filter(s => s === 'negative').length;
    const pos = sentiments.filter(s => s === 'positive').length;
    const sentiment = neg > pos ? 'negative' : pos > 0 ? 'positive' : 'neutral';
    const sentimentScore = sentiments.length ? (pos - neg) / sentiments.length : 0;
    const startedAt = call.startedAt ?? call.createdAt;
    const endedAt = new Date();
    const facts = [has('budget') ? `budget ${keywords.find(k => k.type === 'budget')?.value}` : null, has('bhk') ? keywords.find(k => k.type === 'bhk')?.value : null, has('site_visit') ? 'asked for a site visit' : null].filter(Boolean);
    const summary = `${outcome.replace(/_/g, ' ')}${opts.escalated ? ' (handed to a person)' : ''}. ${facts.length ? `Caller mentioned: ${facts.join(', ')}.` : 'No buying details captured.'}`;

    await db
      .update(voiceCalls)
      .set({
        status: 'completed',
        outcome,
        endedAt,
        durationSeconds: Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)),
        transcript,
        summary,
        sentiment,
        sentimentScore: sentimentScore.toFixed(3),
        escalatedToHuman: Boolean(opts.escalated) || call.escalatedToHuman,
        optedOut: reason === 'opt_out' || call.optedOut,
        metadata: { ...((call.metadata as Record<string, unknown>) ?? {}), endReason: reason, visitRequested: has('site_visit') },
        updatedAt: new Date(),
      })
      .where(eq(voiceCalls.id, callId));

    if (call.direction !== 'test') {
      const minutes = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)) / 60;
      const [row] = await db.insert(usageLedger).values({ companyId, kind: 'call_minutes', channel: 'voice', quantity: minutes.toFixed(4), unit: 'minutes', refType: 'voice_call', refId: callId }).returning({ id: usageLedger.id }).catch(() => []);
      await paymentsService.consume(companyId, minutes * CALL_MINUTE_CREDITS, row?.id).catch(() => undefined);
    }
    if (call.leadId && call.direction !== 'test') {
      if (outcome !== 'no_answer' && outcome !== 'dnd') {
        await voiceService.processCallTranscriptionAndScoring(callId, transcript, summary).catch(() => null);
      }
      if (call.contactId) {
        await db.insert(leadActivities).values({
          companyId,
          leadId: call.leadId,
          contactId: call.contactId,
          activityType: 'call',
          title: `AI voice call: ${outcome.replace(/_/g, ' ')}`,
          description: summary,
          metadata: { callId, outcome },
        });
      }
    }
    const { callCampaignsService } = await import('./call-campaigns.service.js');
    await callCampaignsService.onCallFinished(callId).catch(() => null);
    return { outcome };
  }

  // ---------------------------------------------------------------- reads
  private listItem(r: { c: typeof voiceCalls.$inferSelect; first: string | null; last: string | null }): VoiceCallListItem {
    const c = r.c;
    return {
      id: c.id,
      direction: c.direction,
      status: c.status,
      outcome: c.outcome,
      fromNumber: c.fromNumber,
      toNumber: c.toNumber,
      leadId: c.leadId,
      contactName: r.first ? `${r.first} ${r.last ?? ''}`.trim() : null,
      voiceAgentId: c.voiceAgentId,
      campaignId: c.campaignId,
      durationSeconds: c.durationSeconds,
      sentiment: c.sentiment,
      summary: c.summary,
      escalatedToHuman: c.escalatedToHuman,
      startedAt: iso(c.startedAt),
      createdAt: c.createdAt.toISOString(),
    };
  }

  async listCalls(companyId: string, f: { outcome?: string; campaignId?: string; leadId?: string; limit?: number }): Promise<VoiceCallListItem[]> {
    const conds = [eq(calls.companyId, companyId), f.outcome ? eq(calls.outcome, f.outcome) : undefined, f.campaignId ? eq(calls.campaignId, f.campaignId) : undefined, f.leadId ? eq(calls.leadId, f.leadId) : undefined].filter(
      (c): c is NonNullable<typeof c> => c !== undefined,
    );
    const rows = await db
      .select({ c: calls, first: contacts.firstName, last: contacts.lastName })
      .from(calls)
      .leftJoin(contacts, eq(contacts.id, calls.contactId))
      .where(and(...conds))
      .orderBy(desc(calls.createdAt))
      .limit(Math.min(f.limit ?? 50, 200));
    return rows.map(r => this.listItem(r));
  }

  async getCall(companyId: string, id: string): Promise<VoiceCallDetail> {
    const [row] = await db
      .select({ c: calls, first: contacts.firstName, last: contacts.lastName })
      .from(calls)
      .leftJoin(contacts, eq(contacts.id, calls.contactId))
      .where(and(eq(calls.id, id), eq(calls.companyId, companyId)));
    if (!row) throw notFound('Call');
    const events = await db.select().from(callEvents).where(and(eq(callEvents.callId, id), eq(callEvents.companyId, companyId))).orderBy(asc(callEvents.offsetMs), asc(callEvents.createdAt));
    return {
      ...this.listItem(row),
      transcript: row.c.transcript,
      recordingUrl: row.c.recordingUrl,
      events: events.map<CallEventItem>(e => ({ id: e.id, type: e.type, speaker: e.speaker, payload: e.payload, offsetMs: e.offsetMs, createdAt: e.createdAt.toISOString() })),
    };
  }

  async analytics(companyId: string, days = 30): Promise<VoiceAnalytics> {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await db
      .select({ outcome: calls.outcome, status: calls.status, duration: calls.durationSeconds, escalated: calls.escalatedToHuman, createdAt: calls.createdAt })
      .from(calls)
      .where(and(eq(calls.companyId, companyId), sql`${calls.direction} <> 'test'`, gte(calls.createdAt, since)));
    const byOutcome: Record<string, number> = {};
    const byDayMap = new Map<string, number>();
    let connected = 0;
    let totalDuration = 0;
    for (const r of rows) {
      const key = r.outcome ?? (r.status === 'completed' ? 'connected' : r.status);
      byOutcome[key] = (byOutcome[key] ?? 0) + 1;
      if (['connected', 'qualified', 'visit_booked', 'not_interested', 'dnd'].includes(key)) {
        connected++;
        totalDuration += r.duration;
      }
      const day = r.createdAt.toISOString().slice(0, 10);
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
    }
    return {
      totalCalls: rows.length,
      connectedRate: rows.length ? Math.round((connected / rows.length) * 100) : 0,
      avgDurationSeconds: connected ? Math.round(totalDuration / connected) : 0,
      byOutcome,
      byDay: [...byDayMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, n]) => ({ day, calls: n })),
      qualifiedCount: (byOutcome.qualified ?? 0) + (byOutcome.visit_booked ?? 0),
      escalatedCount: rows.filter(r => r.escalated).length,
      dndCount: byOutcome.dnd ?? 0,
    };
  }
}

export const voiceStudioService = new VoiceStudioService();
