import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server.js';
import { createAuthenticatedUser } from './helpers/test-fixtures.js';
import { cleanupTestDatabase, testDb } from './helpers/test-db.js';
import {
  leads,
  contacts,
  chatbots,
  shortlistRooms,
  shortlistItems,
  projects,
  domainEvents,
  tasks,
} from '../src/db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

import type { Express } from 'express';

describe('Phase R4 — Integrated Business Workflows Audit & Repairs', () => {
  let app: Express;
  let companyId: string;
  let adminToken: string;
  let chatbot: { id: string; publicKey: string };

  beforeEach(async () => {
    app = createApp();

    const auth = await createAuthenticatedUser('company_admin');
    companyId = auth.company.id;
    adminToken = auth.token;

    const [bot] = await testDb
      .insert(chatbots)
      .values({
        companyId,
        name: 'Aurora Property Bot',
        type: 'web',
        status: 'active',
        publicKey: `pb_live_${crypto.randomBytes(16).toString('hex')}`,
      })
      .returning();
    chatbot = bot;
  });

  afterEach(async () => {
    if (companyId) {
      await cleanupTestDatabase([companyId]);
    }
  });

  describe('1. Chatbot Lead Capture & Contract Harmonization', () => {
    it('captures a lead using { name, phone } and verifies Buyer DNA and Intent Score', async () => {
      // 1. Visitor initializes chat session
      const sessionRes = await request(app)
        .post('/public/session')
        .send({
          publicKey: chatbot.publicKey,
          visitorId: 'vis_test_r4_001',
        })
        .expect(200);

      const sessionToken = sessionRes.body.data.sessionToken;
      const conversationId = sessionRes.body.data.conversationId;
      expect(sessionToken).toBeDefined();

      // 2. Visitor sends message indicating real estate preferences
      await request(app)
        .post('/public/message')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          conversationId,
          message: 'Looking for a 3BHK luxury apartment in Whitefield under 2.5 Cr ready to move',
        })
        .expect(200);

      // 3. Visitor submits lead form with { name, phone } (without repeating conversationId in body)
      const captureRes = await request(app)
        .post('/public/lead')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          name: 'Arjun Verma',
          phone: '9876543210',
          email: 'arjun.verma@example.com',
        })
        .expect(200);

      expect(captureRes.body.success).toBe(true);
      expect(captureRes.body.data.leadId).toBeDefined();

      // 4. Verify in DB: phone was normalized to +91, Buyer DNA was captured from conversation
      const [savedLead] = await testDb
        .select()
        .from(leads)
        .where(eq(leads.id, captureRes.body.data.leadId));

      expect(savedLead).toBeDefined();
      expect(savedLead.companyId).toBe(companyId);

      const [savedContact] = await testDb
        .select()
        .from(contacts)
        .where(eq(contacts.id, savedLead.contactId));

      expect(savedContact.phone).toBe('+919876543210');
      expect(savedContact.firstName).toBe('Arjun');

      // Intent Score must be computed dynamically (e.g. phone provided + budget asked)
      expect(savedLead.intentScore).toBeGreaterThanOrEqual(20);
      expect(savedLead.intentLabel).toBeDefined();

      // Buyer DNA must contain the extracted preferences from the conversation
      const dna = savedLead.buyerDna as {
        bhk?: string[];
        localities?: string[];
        timeline?: string;
        budgetMax?: number;
      };
      expect(dna).toBeDefined();
      expect(dna.bhk).toContain('3BHK');
      expect(dna.localities).toContain('Whitefield');
      expect(dna.timeline).toBe('immediate');
      expect(dna.budgetMax).toBe(25000000); // 2.5 Cr in INR
    });

    it('creates duplicate merge suggestion when existing prospect inquiries again', async () => {
      // Create first lead
      const session1 = await request(app)
        .post('/public/session')
        .send({ publicKey: chatbot.publicKey })
        .expect(200);

      const capture1 = await request(app)
        .post('/public/lead')
        .set('Authorization', `Bearer ${session1.body.data.sessionToken}`)
        .send({
          fullName: 'Priya Sharma',
          phone: '+919988776655',
          email: 'priya@example.com',
        })
        .expect(200);

      const firstLeadId = capture1.body.data.leadId;

      // Second session with same phone number
      const session2 = await request(app)
        .post('/public/session')
        .send({ publicKey: chatbot.publicKey })
        .expect(200);

      const capture2 = await request(app)
        .post('/public/lead')
        .set('Authorization', `Bearer ${session2.body.data.sessionToken}`)
        .send({
          name: 'Priya Sharma',
          phone: '9988776655', // Indian 10-digit format
        })
        .expect(200);

      expect(capture2.body.data.isDuplicate).toBe(true);

      // Verify that the existing lead received a duplicateMergeSuggestion
      const [existingLead] = await testDb
        .select()
        .from(leads)
        .where(eq(leads.id, firstLeadId));

      expect(existingLead.duplicateMergeSuggestion).toBeDefined();
      expect((existingLead.duplicateMergeSuggestion as { matchingField: string }).matchingField).toBe('phone');
    });
  });

  describe('2. Agent Lead Conversation Transcript API', () => {
    it('returns chronological messages for CRM lead under GET /api/leads/:id/conversation', async () => {
      // 1. Visitor chats and captures lead
      const session = await request(app)
        .post('/public/session')
        .send({ publicKey: chatbot.publicKey })
        .expect(200);

      const token = session.body.data.sessionToken;
      const conversationId = session.body.data.conversationId;

      await request(app)
        .post('/public/message')
        .set('Authorization', `Bearer ${token}`)
        .send({ conversationId, message: 'What is the price per sqft for project Serenade?' })
        .expect(200);

      const leadRes = await request(app)
        .post('/public/lead')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Rohit Roy', phone: '+919123456789' })
        .expect(200);

      const leadId = leadRes.body.data.leadId;

      // 2. Authenticated sales agent retrieves conversation transcript
      const transcriptRes = await request(app)
        .get(`/api/leads/${leadId}/conversation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(transcriptRes.body.data).toBeDefined();
      expect(transcriptRes.body.data.conversationId).toBe(conversationId);
      expect(transcriptRes.body.data.messages.length).toBeGreaterThanOrEqual(2);

      const visitorMsg = transcriptRes.body.data.messages.find(
        (m: { senderType: string; content: string }) => m.senderType === 'visitor',
      );
      expect(visitorMsg).toBeDefined();
      expect(visitorMsg.content).toContain('What is the price per sqft');
    });
  });

  describe('3. Shortlist Room Real Request Submission', () => {
    it('creates urgent CRM task and logs activity when buyer submits visit or callback', async () => {
      // Setup project & lead
      const [proj] = await testDb
        .insert(projects)
        .values({
          companyId,
          name: 'Aurora Palm Residences',
          builderName: 'Aurora Developers',
          location: 'Whitefield, Bangalore',
          status: 'ready_to_move',
        })
        .returning();

      const [contact] = await testDb
        .insert(contacts)
        .values({
          companyId,
          firstName: 'Siddharth',
          lastName: 'Mehta',
          phone: '+919811223344',
          email: 'siddharth@example.com',
        })
        .returning();

      const [lead] = await testDb
        .insert(leads)
        .values({
          companyId,
          contactId: contact!.id,
          status: 'new',
          priority: 'medium',
          intentScore: 45,
          intentLabel: 'warm',
          source: 'chat',
        })
        .returning();

      const token = crypto.randomBytes(24).toString('base64url');
      const [room] = await testDb
        .insert(shortlistRooms)
        .values({
          companyId,
          leadId: lead!.id,
          token,
          title: 'Curated Homes for Siddharth',
          expiresAt: new Date(Date.now() + 14 * 86400000),
          status: 'active',
        })
        .returning();

      await testDb.insert(shortlistItems).values({
        shortlistId: room!.id,
        projectId: proj!.id,
        matchScore: 95,
        matchHighlights: ['Budget aligned'],
      });

      // Submit public site visit request from shortlist room
      const submitRes = await request(app)
        .post(`/api/shortlist-room/${token}/request`)
        .send({
          type: 'visit',
          name: 'Siddharth Mehta',
          preferredTime: 'Saturday 11:00 AM',
          notes: 'Please arrange golf cart tour of clubhouse and 3BHK sample flat.',
          projectId: proj!.id,
        })
        .expect(200);

      expect(submitRes.body.success).toBe(true);
      expect(submitRes.body.data.leadId).toBe(lead!.id);

      // Verify that a follow-up task was created for the sales agent
      const [createdTask] = await testDb
        .select()
        .from(tasks)
        .where(and(eq(tasks.companyId, companyId), eq(tasks.leadId, lead!.id)));

      expect(createdTask).toBeDefined();
      expect(createdTask.type).toBe('site_visit');
      expect(createdTask.priority).toBe('urgent');
      expect(createdTask.description).toContain('Saturday 11:00 AM');

      // Verify lead status advanced to site_visit_scheduled
      const [updatedLead] = await testDb
        .select()
        .from(leads)
        .where(eq(leads.id, lead!.id));

      expect(updatedLead.status).toBe('site_visit_scheduled');
      // Intent score should be elevated by +15 points
      expect(updatedLead.intentScore).toBe(60);

      // Verify domainEvent was written to outbox
      const [outboxEvent] = await testDb
        .select()
        .from(domainEvents)
        .where(and(eq(domainEvents.companyId, companyId), eq(domainEvents.type, 'visit_booked')));

      expect(outboxEvent).toBeDefined();
    });

    it('escalates to hot lead with AI Handoff Brief when dwell telemetry crosses 70 score', async () => {
      const [contact] = await testDb
        .insert(contacts)
        .values({
          companyId,
          firstName: 'Ananya',
          lastName: 'Sen',
          phone: '+919777665544',
        })
        .returning();

      const [lead] = await testDb
        .insert(leads)
        .values({
          companyId,
          contactId: contact!.id,
          status: 'new',
          priority: 'medium',
          intentScore: 60, // 60 + 15 = 75 (crosses 70 threshold)
          intentLabel: 'warm',
          source: 'chat',
        })
        .returning();

      const token = crypto.randomBytes(24).toString('base64url');
      await testDb.insert(shortlistRooms).values({
        companyId,
        leadId: lead!.id,
        token,
        title: 'Shortlist for Ananya',
        expiresAt: new Date(Date.now() + 14 * 86400000),
        status: 'active',
      });

      // Track dwell telemetry
      await request(app)
        .post(`/api/shortlist-room/${token}/track`)
        .send({
          event: 'dwell',
          timeSpentSeconds: 45,
        })
        .expect(200);

      const [updatedLead] = await testDb
        .select()
        .from(leads)
        .where(eq(leads.id, lead!.id));

      expect(updatedLead.intentScore).toBe(75);
      expect(updatedLead.intentLabel).toBe('hot');
      expect(updatedLead.priority).toBe('high');
      expect(updatedLead.slaStartedAt).toBeDefined();

      // Verify lead_hot domain event was emitted
      const [hotEvent] = await testDb
        .select()
        .from(domainEvents)
        .where(and(eq(domainEvents.companyId, companyId), eq(domainEvents.type, 'lead_hot')));

      expect(hotEvent).toBeDefined();
    });
  });
});
