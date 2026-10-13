import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  contacts,
  leads,
  voiceCalls,
  companyAiSettings,
  leadActivities,
} from '../../src/db/schema/index.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { voiceCallbackConsumer } from '../../src/modules/voice/voice-callback.consumer.js';
import { eq, and } from 'drizzle-orm';

describe('Phase 15C: Voice Calling & Telephony Integration', () => {
  const app = createApp();

  const companyAId = 'ca000000-0000-0000-0000-000000000001';
  const companyBId = 'ca000000-0000-0000-0000-000000000002';
  const userAId = 'ca000000-0000-0000-0000-000000000011';
  const userBId = 'ca000000-0000-0000-0000-000000000012';

  const tokenA = signAccessToken({
    sub: userAId,
    companyId: companyAId,
    role: 'company_admin',
    status: 'active',
    email: 'admin.a@voice-test.com',
    name: 'Voice Admin A',
  });

  const tokenB = signAccessToken({
    sub: userBId,
    companyId: companyBId,
    role: 'company_admin',
    status: 'active',
    email: 'admin.b@voice-test.com',
    name: 'Voice Admin B',
  });

  let contactAId: string;
  let leadAId: string;
  let leadNoConsentId: string;

  beforeAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);

    // Create companies
    await testDb.insert(companies).values([
      {
        id: companyAId,
        name: 'Voice Realty A',
        slug: 'voice-realty-a',
        plan: 'enterprise',
        status: 'active',
        settings: { voiceCalling: true, telephonyCallerId: '+918040001000' },
      },
      {
        id: companyBId,
        name: 'Voice Realty B',
        slug: 'voice-realty-b',
        plan: 'enterprise',
        status: 'active',
        settings: { voiceCalling: true },
      },
    ]);

    // Create users
    await testDb.insert(users).values([
      {
        id: userAId,
        companyId: companyAId,
        email: 'admin.a@voice-test.com',
        passwordHash: 'hashed_pw',
        role: 'company_admin',
        name: 'Voice Admin A',
        status: 'active',
      },
      {
        id: userBId,
        companyId: companyBId,
        email: 'admin.b@voice-test.com',
        passwordHash: 'hashed_pw',
        role: 'company_admin',
        name: 'Voice Admin B',
        status: 'active',
      },
    ]);

    // Create contact A
    const [c] = await testDb
      .insert(contacts)
      .values({
        companyId: companyAId,
        firstName: 'Ananya',
        lastName: 'Sharma',
        phone: '+919876543210',
        email: 'ananya.sharma@example.com',
      })
      .returning();
    contactAId = c!.id;

    // Create lead A with consent
    const [l] = await testDb
      .insert(leads)
      .values({
        companyId: companyAId,
        contactId: contactAId,
        status: 'new',
        intentScore: 40,
        customFields: { callConsent: true },
      })
      .returning();
    leadAId = l!.id;

    // Create lead without consent
    const [l2] = await testDb
      .insert(leads)
      .values({
        companyId: companyAId,
        contactId: contactAId,
        status: 'new',
        intentScore: 20,
        customFields: { callConsent: false },
      })
      .returning();
    leadNoConsentId = l2!.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);
  });

  describe('15.12 Voice Calling & Automated Callback', () => {
    let generatedCallSid: string;

    it('skips automated callback if lead did not give explicit call consent', async () => {
      const res = await request(app)
        .post('/api/voice/callback')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          leadId: leadNoConsentId,
          bypassCallingHours: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('skipped');
      expect(res.body.data.reason).toBe('NO_CONSENT');
    });

    it('blocks callback when emergency AI kill switch is active', async () => {
      await testDb
        .insert(companyAiSettings)
        .values({
          companyId: companyAId,
          killSwitch: true,
        })
        .onConflictDoUpdate({
          target: companyAiSettings.companyId,
          set: { killSwitch: true },
        });

      const res = await request(app)
        .post('/api/voice/callback')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          leadId: leadAId,
          bypassCallingHours: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('blocked');
      expect(res.body.data.reason).toBe('KILL_SWITCH_ACTIVE');

      // Reset kill switch
      await testDb
        .update(companyAiSettings)
        .set({ killSwitch: false })
        .where(eq(companyAiSettings.companyId, companyAId));
    });

    it('initiates callback within ~30s with mandatory AI disclosure', async () => {
      const res = await request(app)
        .post('/api/voice/callback')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          leadId: leadAId,
          bypassCallingHours: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('initiated');
      expect(res.body.data.disclosedAsAi).toBe(true);
      expect(res.body.data.callSid).toBeDefined();

      generatedCallSid = res.body.data.callSid;

      // Check DB record in voice_calls
      const [call] = await testDb
        .select()
        .from(voiceCalls)
        .where(eq(voiceCalls.callSid, generatedCallSid));

      expect(call).toBeDefined();
      expect(call!.companyId).toBe(companyAId);
      expect(call!.leadId).toBe(leadAId);
      expect(call!.disclosedAsAi).toBe(true);
      expect(call!.metadata).toHaveProperty('discloseAiText');
      expect((call!.metadata as Record<string, unknown>).discloseAiText).toContain('AI assistant calling on behalf of');
    });

    it('processes lead_created outbox events via VoiceCallbackConsumer', async () => {
      await voiceCallbackConsumer.handleEvent({
        id: 'evt-001',
        companyId: companyAId,
        type: 'lead_created',
        payload: {
          leadId: leadAId,
          bypassCallingHours: true,
        },
        createdAt: new Date(),
      });

      // Verification: additional call record created
      const calls = await testDb
        .select()
        .from(voiceCalls)
        .where(and(eq(voiceCalls.companyId, companyAId), eq(voiceCalls.leadId, leadAId)));

      expect(calls.length).toBeGreaterThanOrEqual(2);
    });

    it('processes telephony webhook, updates Buyer DNA, and handles price negotiation escalation', async () => {
      const webhookPayload = {
        callSid: generatedCallSid,
        status: 'completed',
        durationSeconds: 125,
        recordingUrl: 'https://mock-telephony.storage.com/rec-12345.mp3',
        transcript:
          'Hello, this is Ananya. Can you give me a 20% discount on the listed price? Also I am looking for a 3BHK luxury flat with budget 3.5 Cr in Whitefield.',
        summary: 'Lead Ananya interested in 3BHK in Whitefield (3.5 Cr). Inquired about 20% discount.',
      };

      const res = await request(app)
        .post('/api/voice/webhooks/status')
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.priceEscalation).toBe(true);
      expect(res.body.data.buyerDnaUpdated).toBe(true);

      // Verify updated call row in DB
      const [call] = await testDb
        .select()
        .from(voiceCalls)
        .where(eq(voiceCalls.callSid, generatedCallSid));

      expect(call!.status).toBe('completed');
      expect(call!.durationSeconds).toBe(125);
      expect(call!.recordingUrl).toBe('https://mock-telephony.storage.com/rec-12345.mp3');
      expect(call!.transcript).toContain('20% discount');
      expect((call!.metadata as Record<string, unknown>).priceEscalation).toBe(true);

      // Verify lead Buyer DNA updated
      const [lead] = await testDb
        .select()
        .from(leads)
        .where(eq(leads.id, leadAId));

      const dna = lead!.buyerDna as Record<string, unknown>;
      expect(dna).toBeDefined();
      expect(dna.budget).toBe('3.5 Cr');
      expect(dna.bhk).toBe('3BHK');
      expect(dna.location).toBe('Whitefield');
      expect(lead!.intentScore).toBeGreaterThanOrEqual(50);
    });

    it('detects opt-out keywords during call and flags contact for DND', async () => {
      // Create a fresh call SID to receive opt-out webhook
      const optOutCallSid = 'call_optout_test_001';
      await testDb.insert(voiceCalls).values({
        companyId: companyAId,
        leadId: leadAId,
        contactId: contactAId,
        callSid: optOutCallSid,
        direction: 'outbound_callback',
        fromNumber: '+918040001000',
        toNumber: '+919876543210',
        status: 'in_progress',
        disclosedAsAi: true,
      });

      const res = await request(app)
        .post('/api/voice/webhooks/status')
        .send({
          callSid: optOutCallSid,
          status: 'completed',
          durationSeconds: 45,
          transcript: 'I am not interested at all. Stop calling me and remove my number!',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.optedOut).toBe(true);

      // Verify contact altPhone flagged as OPTED_OUT
      const [contact] = await testDb
        .select()
        .from(contacts)
        .where(eq(contacts.id, contactAId));

      expect(contact!.altPhone).toBe('OPTED_OUT');
    });

    it('allows agents to manually log offline calls in CRM', async () => {
      const res = await request(app)
        .post('/api/voice/manual-log')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          leadId: leadAId,
          durationSeconds: 240,
          outcome: 'interested',
          notes: 'Agent spoke with lead regarding site visit this Saturday.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.direction).toBe('outbound_manual');
      expect(res.body.data.durationSeconds).toBe(240);

      // Check lead activity entry
      const activities = await testDb
        .select()
        .from(leadActivities)
        .where(and(eq(leadActivities.companyId, companyAId), eq(leadActivities.leadId, leadAId)));

      const manualActivity = activities.find((a) =>
        a.title.includes('Manual Call Logged by Agent'),
      );
      expect(manualActivity).toBeDefined();
    });

    it('enforces tenant RLS when listing call history', async () => {
      // Company A lists calls
      const resA = await request(app)
        .get('/api/voice/calls')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resA.status).toBe(200);
      expect(resA.body.data.length).toBeGreaterThan(0);
      expect(resA.body.data.every((c: { companyId: string }) => c.companyId === companyAId)).toBe(true);

      // Company B lists calls (should be empty for company B)
      const resB = await request(app)
        .get('/api/voice/calls')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(resB.status).toBe(200);
      expect(resB.body.data.length).toBe(0);
    });
  });
});
