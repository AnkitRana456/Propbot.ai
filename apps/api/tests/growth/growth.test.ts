import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  contacts,
  leads,
  projects,
  companyAiSettings,
  segments,
  campaigns,
  bookingTransactions,
  domainEvents,
} from '../../src/db/schema/index.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { eq } from 'drizzle-orm';

describe('Phase 15B: Growth Layer (Segments, Campaigns, Ask Your Pipeline, Booking Payments & RERA Copy)', () => {
  const app = createApp();

  const companyAId = 'ba000000-0000-0000-0000-000000000003';
  const companyBId = 'ba000000-0000-0000-0000-000000000004';
  const userAId = 'ba000000-0000-0000-0000-000000000013';
  const userBId = 'ba000000-0000-0000-0000-000000000014';
  const projectId = 'ba000000-0000-0000-0000-000000000030';

  const tokenA = signAccessToken({
    sub: userAId,
    companyId: companyAId,
    role: 'company_admin',
    status: 'active',
    email: 'growth.admin.a@test.com',
    name: 'Growth Admin A',
  });

  const tokenB = signAccessToken({
    sub: userBId,
    companyId: companyBId,
    role: 'company_admin',
    status: 'active',
    email: 'growth.admin.b@test.com',
    name: 'Growth Admin B',
  });

  let testLeadAId: string;
  let testContactAId: string;

  beforeAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);

    await testDb
      .insert(companies)
      .values([
        {
          id: companyAId,
          name: 'Growth Prestige Realty A',
          slug: 'growth-prestige-a',
          plan: 'growth',
          status: 'active',
        },
        {
          id: companyBId,
          name: 'Growth Rival Realty B',
          slug: 'growth-rival-b',
          plan: 'growth',
          status: 'active',
        },
      ])
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values([
        {
          id: userAId,
          companyId: companyAId,
          name: 'Growth Admin A',
          email: 'growth.admin.a@test.com',
          passwordHash: 'hash',
          role: 'company_admin',
          status: 'active',
        },
        {
          id: userBId,
          companyId: companyBId,
          name: 'Growth Admin B',
          email: 'growth.admin.b@test.com',
          passwordHash: 'hash',
          role: 'company_admin',
          status: 'active',
        },
      ])
      .onConflictDoNothing();

    await testDb
      .insert(companyAiSettings)
      .values([
        {
          companyId: companyAId,
          killSwitch: false,
          allowedTiers: ['T0', 'T1', 'T2'],
          dailyActionCap: 100,
        },
        {
          companyId: companyBId,
          killSwitch: false,
          allowedTiers: ['T0', 'T1', 'T2'],
          dailyActionCap: 100,
        },
      ])
      .onConflictDoNothing();

    // Create a verified project for RERA marketing copy tests
    await testDb
      .insert(projects)
      .values({
        id: projectId,
        companyId: companyAId,
        name: 'Prestige Waterfront Residences',
        builderName: 'Prestige Group',
        location: 'Koramangala, Bangalore',
        reraNo: 'PRM/KA/RERA/1251/310/PR/210312/004018',
        status: 'active',
      })
      .onConflictDoNothing();

    // Create a contact and lead for company A
    const [contact] = await testDb
      .insert(contacts)
      .values({
        companyId: companyAId,
        firstName: 'Vikram',
        lastName: 'Malhotra',
        phone: '+919988776655',
        email: 'vikram.m@example.com',
      })
      .returning();
    testContactAId = contact!.id;

    const [lead] = await testDb
      .insert(leads)
      .values({
        companyId: companyAId,
        contactId: testContactAId,
        source: 'whatsapp',
        status: 'new',
        intentScore: 88,
        intentLabel: 'hot',
        buyerDna: { budgetMax: 15000000, bhk: [3] },
        updatedAt: new Date(Date.now() - 48 * 3600 * 1000),
      })
      .returning();
    testLeadAId = lead!.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);
  });

  describe('1. Dynamic Lead Segmentation', () => {
    it('POST /api/growth/segments/preview-count previews dynamic lead count matching criteria', async () => {
      const res = await request(app)
        .post('/api/growth/segments/preview-count')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          filterCriteria: {
            intentLabels: ['hot'],
            minIntentScore: 70,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.count).toBe('number');
      expect(res.body.count).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/growth/segments creates an audience segment and GET /api/growth/segments lists it', async () => {
      const createRes = await request(app)
        .post('/api/growth/segments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'High-Intent Hot Buyers (80+ Score)',
          description: 'Hot buyers interested in 3BHK with budget above 1 Cr',
          filterCriteria: {
            intentLabels: ['hot'],
            minIntentScore: 80,
          },
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.id).toBeDefined();
      expect(createRes.body.data.name).toBe('High-Intent Hot Buyers (80+ Score)');
      expect(createRes.body.data.cachedCount).toBeGreaterThanOrEqual(1);

      const segmentId = createRes.body.data.id;

      const listRes = await request(app)
        .get('/api/growth/segments')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((s: any) => s.id === segmentId)).toBe(true);
    });
  });

  describe('2. Targeted Campaigns & A/B Testing', () => {
    let createdSegmentId: string;

    beforeAll(async () => {
      const [seg] = await testDb
        .insert(segments)
        .values({
          companyId: companyAId,
          name: 'Campaign Target Segment',
          filterCriteria: { intentLabels: ['hot'] },
          cachedCount: 1,
        })
        .returning();
      createdSegmentId = seg!.id;
    });

    it('POST /api/growth/campaigns creates a campaign with A/B variant testing', async () => {
      const res = await request(app)
        .post('/api/growth/campaigns')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Exclusive Festive Offer Broadcast',
          segmentId: createdSegmentId,
          channel: 'whatsapp',
          scheduleType: 'immediate',
          sendWindowStart: '09:00',
          sendWindowEnd: '20:00',
          frequencyCap: 2,
          aBTestEnabled: true,
          variantA: {
            body: 'Namaste {{name}}! Avail festive 0% stamp duty on 3BHK luxury residences at Prestige Waterfront.',
          },
          variantB: {
            body: 'Hello {{name}}, priority booking window is now live for Prestige Waterfront Koramangala.',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.aBTestEnabled).toBe(true);

      const campaignId = res.body.data.id;

      // GET /api/growth/campaigns returns this campaign
      const listRes = await request(app)
        .get('/api/growth/campaigns')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((c: any) => c.id === campaignId)).toBe(true);

      // Launch the campaign
      const launchRes = await request(app)
        .post(`/api/growth/campaigns/${campaignId}/launch`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(launchRes.status).toBe(200);
      expect(launchRes.body.success).toBe(true);
      expect(launchRes.body.data.sentCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. Ask Your Pipeline (Conversational CRM Querying)', () => {
    it('POST /api/growth/ask-pipeline returns structured answers and citations', async () => {
      const res = await request(app)
        .post('/api/growth/ask-pipeline')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          question: 'Which hot leads have not been contacted today?',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answer).toBeDefined();
      expect(res.body.data.toolUsed).toBe('list_leads');
      expect(Array.isArray(res.body.data.citations)).toBe(true);
      expect(res.body.data.citations.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.citations[0].intentLabel).toBe('hot');
    });
  });

  describe('4. Instant Booking Token & Payments', () => {
    it('POST /api/growth/booking-payments/link generates payment link and GET lists transactions', async () => {
      const res = await request(app)
        .post('/api/growth/booking-payments/link')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          leadId: testLeadAId,
          projectId,
          unitId: 'Tower A - 1402',
          amount: 50000,
          currency: 'INR',
          provider: 'razorpay',
          notes: 'Token booking deposit for 3BHK flat',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentLinkUrl).toContain('rzp.io');
      expect(res.body.data.transaction).toBeDefined();
      expect(res.body.data.transaction.status).toBe('pending');

      const paymentLinkId = res.body.data.transaction.paymentLinkId;

      // GET /api/growth/booking-payments
      const listRes = await request(app)
        .get('/api/growth/booking-payments')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((t: any) => t.paymentLinkId === paymentLinkId)).toBe(true);

      // Webhook confirmation: POST /api/growth/payments/booking/webhook
      const webhookRes = await request(app)
        .post('/api/growth/payments/booking/webhook')
        .send({
          companyId: companyAId,
          paymentLinkId,
          orderId: 'order_festive_001',
          paymentId: 'pay_rzp_test_success_99',
          amount: 50000,
          receiptUrl: 'https://propbot.io/receipts/festive_001.pdf',
        });

      expect(webhookRes.status).toBe(200);
      expect(webhookRes.body.success).toBe(true);

      // Verify that lead status advanced to 'booked' (PDF Requirement: stage moves to Booked only after confirmed payment)
      const [updatedLead] = await testDb
        .select()
        .from(leads)
        .where(eq(leads.id, testLeadAId));

      expect(updatedLead?.status).toBe('booked');

      // Verify domain_events contains 'payment_received' event
      const events = await testDb
        .select()
        .from(domainEvents)
        .where(eq(domainEvents.companyId, companyAId));

      expect(events.some(e => e.type === 'payment_received')).toBe(true);
    });
  });

  describe('5. RERA Marketing Copy Generation', () => {
    it('POST /api/growth/rera-copy/generate generates compliant copy with official RERA number', async () => {
      const res = await request(app)
        .post('/api/growth/rera-copy/generate')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          projectId,
          platform: 'whatsapp',
          targetAudience: 'High-net-worth investors and IT professionals in Bangalore',
          focusAspects: ['location', 'amenities', 'milestone_payment'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.headline).toContain('Prestige Waterfront Residences');
      expect(res.body.data.reraNumber).toBe('PRM/KA/RERA/1251/310/PR/210312/004018');
      expect(res.body.data.body).toContain('PRM/KA/RERA/1251/310/PR/210312/004018');
      expect(res.body.data.isCompliant).toBe(true);
      expect(res.body.data.complianceFlags).toHaveLength(0);
    });
  });

  describe('6. Multi-Tenant RLS Isolation', () => {
    it('ensures Company B cannot view or access Company A growth resources', async () => {
      // Company B lists segments -> should not see Company A segments
      const segBRes = await request(app)
        .get('/api/growth/segments')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(segBRes.status).toBe(200);
      expect(segBRes.body.data.length).toBe(0);

      // Company B lists campaigns -> should not see Company A campaigns
      const campBRes = await request(app)
        .get('/api/growth/campaigns')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(campBRes.status).toBe(200);
      expect(campBRes.body.data.length).toBe(0);

      // Company B lists transactions -> should not see Company A transactions
      const txBRes = await request(app)
        .get('/api/growth/booking-payments')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(txBRes.status).toBe(200);
      expect(txBRes.body.data.length).toBe(0);
    });
  });
});
