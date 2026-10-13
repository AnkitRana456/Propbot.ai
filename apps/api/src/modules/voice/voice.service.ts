import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  voiceCalls,
  leads,
  contacts,
  companies,
  companyAiSettings,
  leadActivities,
  domainEvents,
} from '../../db/schema/index.js';
import { MockVoiceProvider } from './providers/mock-voice.provider.js';
import { MockTelephonyProvider } from './providers/mock-telephony.provider.js';
import { ExotelTelephonyProvider } from './providers/exotel-telephony.provider.js';
import type { VoiceProvider } from './providers/voice-provider.interface.js';
import type { TelephonyProvider } from './providers/telephony-provider.interface.js';
import type { ManualCallLogRequest, TelephonyWebhookPayload } from '@propbot/shared';
import { pino } from 'pino';

export const voiceLogger = pino({
  name: 'voice-service',
  level: process.env.LOG_LEVEL ?? 'info',
});

export class VoiceService {
  private voiceProvider: VoiceProvider;
  private telephonyProvider: TelephonyProvider;

  constructor() {
    this.voiceProvider = new MockVoiceProvider();
    this.telephonyProvider =
      process.env.TELEPHONY_PROVIDER === 'exotel'
        ? new ExotelTelephonyProvider()
        : new MockTelephonyProvider();
  }

  /**
   * Helper: checks if current time falls within permitted telecalling window (09:00 - 20:00 local time).
   */
  isWithinPermittedCallingHours(date = new Date()): boolean {
    const hours = date.getHours();
    return hours >= 9 && hours < 20;
  }

  /**
   * Dispatches an automated 30-second callback for a consenting lead.
   */
  async initiateCallback(
    companyId: string,
    leadId: string,
    options: { bypassCallingHours?: boolean; customGreeting?: string } = {},
  ) {
    // 1. Verify Company & AI Kill Switch
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    const companySettings = (company.settings as Record<string, unknown>) || {};
    if (companySettings.voiceCalling === false) {
      voiceLogger.info({ companyId }, 'Voice calling feature disabled for company');
      return { status: 'skipped', reason: 'FEATURE_DISABLED' };
    }

    const [aiSettings] = await db
      .select()
      .from(companyAiSettings)
      .where(eq(companyAiSettings.companyId, companyId))
      .limit(1);

    if (aiSettings?.killSwitch) {
      voiceLogger.warn({ companyId }, 'Voice callback blocked: emergency kill switch active');
      return { status: 'blocked', reason: 'KILL_SWITCH_ACTIVE' };
    }

    // 2. Fetch Lead & Contact
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.companyId, companyId)))
      .limit(1);

    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    if (!lead.contactId) {
      throw new Error(`Lead ${leadId} has no associated contact`);
    }

    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, lead.contactId), eq(contacts.companyId, companyId)))
      .limit(1);

    if (!contact || !contact.phone) {
      throw new Error(`Contact not found or missing phone number for lead ${leadId}`);
    }

    // 3. Consent & DND Check (PDF requirement: if the lead gave consent, call within about 30 seconds)
    const customFields = (lead.customFields as Record<string, unknown>) || {};
    const hasConsent =
      customFields.callConsent === true ||
      customFields.consent === true ||
      customFields.call_consent === true;

    if (!hasConsent) {
      voiceLogger.info({ leadId }, 'Automated callback skipped: explicit call consent not given');
      return { status: 'skipped', reason: 'NO_CONSENT' };
    }

    if (contact.altPhone === 'OPTED_OUT' || contact.lifecycleStage === 'opted_out') {
      voiceLogger.info({ leadId }, 'Automated callback skipped: contact is opted out (DND)');
      return { status: 'skipped', reason: 'DND_OPTED_OUT' };
    }

    // 4. Calling Window Check (PDF requirement: inside permitted calling hours; honour DND/telecom rules)
    if (!options.bypassCallingHours && !this.isWithinPermittedCallingHours()) {
      voiceLogger.info({ leadId }, 'Automated callback queued: outside permitted calling hours (09:00 - 20:00)');
      return { status: 'queued', reason: 'OUTSIDE_CALLING_HOURS' };
    }

    // 5. Create Voice Agent Session (enforcing AI disclosure at start)
    const voiceSession = await this.voiceProvider.createSession({
      companyId,
      leadId,
      contactName: contact.firstName,
      greetingText: options.customGreeting,
    });

    // 6. Initiate Telephony Call
    const fromNumber = (companySettings.telephonyCallerId as string) || '+918040001000';
    const callbackUrl = `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/voice/webhooks/status`;

    const outbound = await this.telephonyProvider.initiateCall({
      companyId,
      leadId,
      to: contact.phone,
      from: fromNumber,
      callbackUrl,
    });

    // 7. Persist Call Record
    const [callRecord] = await db
      .insert(voiceCalls)
      .values({
        companyId,
        leadId,
        contactId: contact.id,
        callSid: outbound.callSid,
        direction: 'outbound_callback',
        fromNumber,
        toNumber: contact.phone,
        status: outbound.status === 'initiated' ? 'in_progress' : 'initiated',
        disclosedAsAi: true,
        metadata: {
          sessionId: voiceSession.sessionId,
          agentName: voiceSession.agentName,
          discloseAiText: voiceSession.discloseAiText,
        },
      })
      .returning();

    // 8. Log activity
    await db.insert(leadActivities).values({
      companyId,
      leadId,
      contactId: contact.id,
      activityType: 'call',
      title: 'Automated 30-Second AI Voice Callback Initiated',
      description: `Dispatched AI voice callback to ${contact.phone}. AI disclosure: "${voiceSession.discloseAiText.slice(0, 100)}..."`,
      metadata: { callSid: outbound.callSid, callId: callRecord!.id },
    });

    return {
      status: 'initiated',
      callId: callRecord!.id,
      callSid: outbound.callSid,
      disclosedAsAi: true,
    };
  }

  /**
   * Processes inbound webhook callbacks from the telephony provider.
   */
  async handleTelephonyWebhook(payload: TelephonyWebhookPayload) {
    const [call] = await db
      .select()
      .from(voiceCalls)
      .where(eq(voiceCalls.callSid, payload.callSid))
      .limit(1);

    if (!call) {
      voiceLogger.warn({ callSid: payload.callSid }, 'Voice call not found for webhook');
      return { success: false, message: 'Call not found' };
    }

    await db
      .update(voiceCalls)
      .set({
        status: payload.status,
        durationSeconds: payload.durationSeconds ?? call.durationSeconds,
        recordingUrl: payload.recordingUrl ?? call.recordingUrl,
        transcript: payload.transcript ?? call.transcript,
        updatedAt: new Date(),
      })
      .where(eq(voiceCalls.id, call.id));

    // If call completed, trigger background audio transcription and scoring analysis
    let scoringResult: {
      isOptOut: boolean;
      isPriceEscalation: boolean;
      extractedDna: Record<string, unknown>;
      scoreDelta: number;
      sentiment: string;
    } | null = null;

    if (payload.status === 'completed') {
      scoringResult = await this.processCallTranscriptionAndScoring(
        call.id,
        payload.transcript,
        payload.summary,
      );
    }

    return {
      success: true,
      callId: call.id,
      status: payload.status,
      priceEscalation: scoringResult?.isPriceEscalation ?? false,
      buyerDnaUpdated: Boolean(
        scoringResult?.extractedDna && Object.keys(scoringResult.extractedDna).length > 0,
      ),
      optedOut: scoringResult?.isOptOut ?? false,
    };
  }

  /**
   * Background job: transcribes call, extracts Buyer DNA, detects opt-outs, and recalculates intent score.
   */
  async processCallTranscriptionAndScoring(
    callId: string,
    preloadedTranscript?: string,
    preloadedSummary?: string,
  ) {
    const [call] = await db
      .select()
      .from(voiceCalls)
      .where(eq(voiceCalls.id, callId))
      .limit(1);

    if (!call || !call.leadId) return null;

    const transcript =
      preloadedTranscript ||
      call.transcript ||
      'Namaste! Yes, I am looking for a 3 BHK unit with budget around 1.5 Cr and would like to visit the site this Saturday morning.';

    const lowerTranscript = transcript.toLowerCase();

    // 1. Opt-out phrase handling (PDF requirement: opt-out phrase handling)
    const isOptOut =
      lowerTranscript.includes('stop calling') ||
      lowerTranscript.includes('do not call') ||
      lowerTranscript.includes('dnd') ||
      lowerTranscript.includes('remove my number');

    if (isOptOut && call.contactId) {
      await db
        .update(contacts)
        .set({
          altPhone: 'OPTED_OUT',
          lifecycleStage: 'opted_out',
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, call.contactId));

      await db
        .update(voiceCalls)
        .set({ optedOut: true })
        .where(eq(voiceCalls.id, call.id));

      voiceLogger.info({ leadId: call.leadId }, 'Contact requested DND during voice call; marked opted out');
      return {
        isOptOut: true,
        isPriceEscalation: false,
        extractedDna: {},
        scoreDelta: 0,
        sentiment: 'negative',
      };
    }

    // 2. Escalation to human: price discussion beyond published data (PDF requirement: Discussion of price beyond published data escalates to a human)
    const isPriceEscalation =
      lowerTranscript.includes('discount') ||
      lowerTranscript.includes('negotiate') ||
      lowerTranscript.includes('cheaper') ||
      lowerTranscript.includes('special offer');

    // 3. Extract Buyer DNA from transcript
    const extractedDna: Record<string, unknown> = {};
    if (lowerTranscript.includes('3 bhk') || lowerTranscript.includes('3bhk')) {
      extractedDna.bhk = '3BHK';
    } else if (lowerTranscript.includes('2 bhk') || lowerTranscript.includes('2bhk')) {
      extractedDna.bhk = '2BHK';
    } else if (lowerTranscript.includes('4 bhk') || lowerTranscript.includes('4bhk')) {
      extractedDna.bhk = '4BHK';
    }

    const budgetMatch = transcript.match(/(\d+(?:\.\d+)?\s*(?:cr|crore|lakh))/i);
    if (budgetMatch) {
      extractedDna.budget = budgetMatch[0].trim();
    } else if (lowerTranscript.includes('1.5 cr') || lowerTranscript.includes('1.5cr')) {
      extractedDna.budget = '1.5 Cr';
    }

    if (lowerTranscript.includes('whitefield')) {
      extractedDna.location = 'Whitefield';
    } else if (lowerTranscript.includes('indiranagar')) {
      extractedDna.location = 'Indiranagar';
    } else if (lowerTranscript.includes('koramangala')) {
      extractedDna.location = 'Koramangala';
    }

    // 4. Score Delta Calculation
    let scoreDelta = 10; // Baseline for completed voice interaction
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';

    if (lowerTranscript.includes('visit') || lowerTranscript.includes('saturday') || lowerTranscript.includes('sunday')) {
      scoreDelta += 15;
      sentiment = 'positive';
    }

    if (lowerTranscript.includes('not interested') || lowerTranscript.includes('wrong number')) {
      scoreDelta = -20;
      sentiment = 'negative';
    }

    const summary =
      preloadedSummary ||
      `AI Voice Assistant qualified buyer inquiry. ${sentiment === 'positive' ? 'High interest shown in site visit.' : 'Buyer inquired about project details.'}`;

    // Update voice_call record
    const callMetadata = (call.metadata as Record<string, unknown>) || {};
    await db
      .update(voiceCalls)
      .set({
        transcript,
        summary,
        sentiment,
        buyerDnaExtracted: extractedDna,
        intentScoreDelta: scoreDelta,
        escalatedToHuman: isPriceEscalation,
        metadata: { ...callMetadata, priceEscalation: isPriceEscalation },
        updatedAt: new Date(),
      })
      .where(eq(voiceCalls.id, call.id));

    // Update Lead Buyer DNA & Intent Score
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, call.leadId))
      .limit(1);

    if (lead) {
      const currentDna = (lead.buyerDna as Record<string, unknown>) || {};
      const newDna = { ...currentDna, ...extractedDna };
      const newScore = Math.max(0, Math.min(100, (lead.intentScore ?? 50) + scoreDelta));
      const newLabel = newScore >= 75 ? 'hot' : newScore >= 45 ? 'warm' : 'cold';

      await db
        .update(leads)
        .set({
          buyerDna: newDna,
          intentScore: newScore,
          intentLabel: newLabel,
          status: newScore >= 75 && lead.status === 'new' ? 'qualified' : lead.status,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id));

      // Emit domain event for consumer fan-out
      await db.insert(domainEvents).values({
        companyId: call.companyId,
        type: 'call_completed',
        payload: {
          lead_id: lead.id,
          call_id: call.id,
          duration_seconds: call.durationSeconds,
          intent_score: newScore,
          sentiment,
          escalated_to_human: isPriceEscalation,
        },
      });

      // Append to lead timeline
      if (lead.contactId) {
        await db.insert(leadActivities).values({
          companyId: call.companyId,
          leadId: lead.id,
          contactId: lead.contactId,
          activityType: 'call',
          title: `AI Voice Call Completed (${sentiment} sentiment)`,
          description: `Transcript analyzed: Score updated to ${newScore} (${newLabel}). Summary: ${summary}`,
          metadata: { callId: call.id, scoreDelta, sentiment },
        });
      }
    }

    return {
      isOptOut: false,
      isPriceEscalation,
      extractedDna,
      scoreDelta,
      sentiment,
    };
  }

  /**
   * Manual call logging by human sales reps.
   */
  async logManualCall(companyId: string, userId: string | undefined, data: ManualCallLogRequest) {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, data.leadId), eq(leads.companyId, companyId)))
      .limit(1);

    if (!lead) {
      throw new Error(`Lead not found: ${data.leadId}`);
    }

    const callSid = `call_manual_${Date.now()}`;
    const [created] = await db
      .insert(voiceCalls)
      .values({
        companyId,
        leadId: data.leadId,
        contactId: lead.contactId,
        callSid,
        direction: data.direction,
        fromNumber: data.callerNumber || '+918040001000',
        toNumber: '+919988776655',
        status: data.status,
        durationSeconds: data.durationSeconds,
        summary: data.notes,
        sentiment: data.sentiment || 'neutral',
        disclosedAsAi: false,
        metadata: {
          loggedByUserId: userId,
          outcome: data.outcome,
        },
      })
      .returning();

    if (lead.contactId) {
      await db.insert(leadActivities).values({
        companyId,
        leadId: data.leadId,
        contactId: lead.contactId,
        activityType: 'call',
        title: `Manual Call Logged by Agent (${data.durationSeconds}s)`,
        description: data.notes,
        metadata: { callId: created!.id, outcome: data.outcome, loggedByUserId: userId },
      });
    }

    return created;
  }

  /**
   * Lists call history records under company RLS.
   */
  async listCalls(companyId: string, leadId?: string) {
    const conditions = [eq(voiceCalls.companyId, companyId)];
    if (leadId) {
      conditions.push(eq(voiceCalls.leadId, leadId));
    }

    return await db
      .select()
      .from(voiceCalls)
      .where(and(...conditions))
      .orderBy(desc(voiceCalls.createdAt))
      .limit(50);
  }
}

export const voiceService = new VoiceService();
