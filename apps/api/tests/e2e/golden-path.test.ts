import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  leads,
  webhookEndpoints,
  domainEvents,
  projects,
  users,
} from '../../src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import { outboxProcessorService } from '../../src/modules/webhooks/outbox-processor.service.js';
import { rollupService } from '../../src/modules/analytics/rollup.service.js';

describe('Phase 14.4 End-to-End Golden-Path Integration Journey', () => {
  const app = createApp();
  const companySlug = 'golden-path-realty';
  let companyId: string;
  let authToken: string;
  let chatbotId: string;
  let chatbotPublicKey: string;
  let leadId: string;
  let agentUserId: string;
  let projectId: string;

  beforeAll(async () => {
    // 0. Clean prior state if any
    const existing = await testDb.query.companies.findFirst({
      where: (c, { eq }) => eq(c.slug, companySlug),
    });
    if (existing) {
      await cleanupTestDatabase([existing.id]);
    }
  });

  afterAll(async () => {
    if (companyId) {
      await cleanupTestDatabase([companyId]);
    }
  });

  it('Step 1: Company Signup & Admin Provisioning', async () => {
    const signupRes = await request(app)
      .post('/api/auth/register')
      .set('x-bypass-rate-limit', 'test-bypass')
      .send({
        companyName: 'Golden Path Realty Group',
        companySlug,
        adminName: 'Golden Admin',
        adminEmail: 'admin@goldenpath.realty',
        password: 'Password123!',
      })
      .expect(201);

    expect(signupRes.body.data).toBeDefined();
    expect(signupRes.body.data.tokens.accessToken).toBeDefined();

    authToken = signupRes.body.data.tokens.accessToken;
    companyId = signupRes.body.data.company.id;
    expect(companyId).toBeDefined();

    // Create a property project for recommendations
    const [proj] = await testDb
      .insert(projects)
      .values({
        companyId,
        name: 'Golden Heights',
        builderName: 'Golden Path Realty',
        status: 'under_construction',
        location: { city: 'Bangalore', locality: 'Whitefield' },
      })
      .returning();
    projectId = proj!.id;
    expect(projectId).toBeDefined();
  });

  it('Step 2: Create Chatbot via API', async () => {
    const botRes = await request(app)
      .post('/api/chatbots')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Golden Concierge',
        type: 'web',
        status: 'active',
        settings: {
          greetingMessage: 'Welcome to Golden Heights. How can I assist your home search?',
          primaryColor: '#2563eb',
          collectEmail: true,
          collectPhone: true,
        },
      })
      .expect(201);

    expect(botRes.body.data).toBeDefined();
    chatbotId = botRes.body.data.id;
    chatbotPublicKey = botRes.body.data.publicKey;
    expect(chatbotId).toBeDefined();
    expect(chatbotPublicKey).toBeTruthy();
  });

  it('Step 3: Train Knowledge Base (Source ingestion)', async () => {
    const trainRes = await request(app)
      .post(`/api/chatbots/${chatbotId}/knowledge/qa`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Project Pricing & Possession FAQ',
        pairs: [
          {
            question: 'What is the starting price at Golden Heights?',
            answer:
              'Golden Heights features luxury 3BHK residences starting at ₹2.45 Cr with possession scheduled for December 2026.',
          },
        ],
      })
      .expect(201);

    expect(trainRes.body.data).toBeDefined();
    expect(['queued', 'ready']).toContain(trainRes.body.data.status);
  });

  it('Step 4: Visitor Chat Interaction & Conversational Lead Capture', async () => {
    const msgRes = await request(app)
      .post('/api/leads/capture')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        chatbotId,
        name: 'Ananya Sharma',
        email: 'ananya.sharma@example.com',
        phone: '+919876599999',
        source: 'chat',
        buyerDna: {
          budgetMin: 20000000,
          budgetMax: 26000000,
          bhk: ['3BHK'],
          localities: ['Whitefield'],
        },
      })
      .expect(201);

    expect(msgRes.body.data).toBeDefined();
    leadId = msgRes.body.data.id;
    expect(leadId).toBeDefined();

    // Verify lead and contact record created in DB
    const [leadRecord] = await testDb
      .select()
      .from(leads)
      .where(eq(leads.id, leadId));
    expect(leadRecord).toBeDefined();
    expect(leadRecord?.contactId).toBeDefined();
  });

  it('Step 5: Lead Appears in CRM & Assign to Agent', async () => {
    // Create sales agent
    const [agent] = await testDb
      .insert(users)
      .values({
        companyId,
        name: 'Rohit Sales Specialist',
        email: 'rohit@goldenpath.realty',
        passwordHash: 'hashed',
        role: 'agent',
        status: 'active',
      })
      .returning();
    agentUserId = agent!.id;

    // Assign lead to agent
    const assignRes = await request(app)
      .post(`/api/crm/leads/${leadId}/assign`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        agentId: agentUserId,
      })
      .expect(200);

    expect(assignRes.body.data).toBeDefined();

    const [updatedLead] = await testDb.select().from(leads).where(eq(leads.id, leadId));
    expect(updatedLead?.assignedAgentId).toBe(agentUserId);
  });

  it('Step 6: Book Site Visit Appointment in Chat / CRM', async () => {
    const slotDate = new Date(Date.now() + 86400000 * 3).toISOString();

    const apptRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        leadId,
        projectId,
        assignedAgentId: agentUserId,
        scheduledAt: slotDate,
        durationMinutes: 45,
        status: 'scheduled',
      })
      .expect(201);

    expect(apptRes.body.data).toBeDefined();
    expect(apptRes.body.data.id).toBeDefined();
  });

  it('Step 7: Webhook Outbox Delivery Event Fired & Dispatched', async () => {
    // Register outbound webhook endpoint
    await testDb.insert(webhookEndpoints).values({
      companyId,
      name: 'Zapier Lead Hook',
      url: 'https://webhook.site/mock-golden-path',
      secret: 'secret-key-123',
      subscribedEvents: ['lead_created', 'visit_booked'],
      isActive: true,
    });

    // Record domain event in outbox
    const [event] = await testDb
      .insert(domainEvents)
      .values({
        companyId,
        type: 'visit_booked',
        payload: {
          leadId,
          companyId,
          projectId,
        },
      })
      .returning();

    expect(event).toBeDefined();

    // Trigger outbox processor sweep
    const { processedCount } = await outboxProcessorService.processPendingEvents();
    expect(processedCount).toBeGreaterThanOrEqual(1);
  });

  it('Step 8: Analytics Updated with Real Stats', async () => {
    const todayStr = new Date().toISOString().split('T')[0]!;
    await rollupService.rollupDayForCompany(companyId, todayStr);

    const analyticsRes = await request(app)
      .get(`/api/analytics/kpis?period=30d`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(analyticsRes.body.data).toBeDefined();
    expect(analyticsRes.body.data.leadsGenerated).toBeDefined();
    expect(analyticsRes.body.data.leadsGenerated.current).toBeGreaterThanOrEqual(1);
  });
});
