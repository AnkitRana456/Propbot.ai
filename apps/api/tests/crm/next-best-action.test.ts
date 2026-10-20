import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users, leads, contacts, domainEvents, companyAiSettings, agentActions } from '../../src/db/schema/index.js';
import { nextBestActionService } from '../../src/modules/crm/next-best-action.service.js';
import { outboxDispatcherService } from '../../src/modules/events/outbox-dispatcher.service.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { eq } from 'drizzle-orm';

describe('Phase 15A: Next Best Action (NBA) Engine & Guarded Execution', () => {
  const app = createApp();
  const companyId = '77777777-7777-7777-7777-777777777715';
  const userId = '00000000-0000-0000-0000-000000000076';
  const contactId = '11111111-2222-3333-4444-555555555515';
  const leadId = '22222222-3333-4444-5555-666666666615';

  let token: string;

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb.insert(companies).values({
      id: companyId,
      name: 'NBA Realty Group',
      slug: 'nba-realty-group',
      plan: 'pro',
      status: 'active',
    });

    await testDb.insert(users).values({
      id: userId,
      companyId,
      name: 'Agent Priya',
      email: 'priya.nba@test.com',
      passwordHash: 'hashed',
      role: 'agent',
      status: 'active',
    });

    await testDb.insert(companyAiSettings).values({
      companyId,
      killSwitch: false,
      allowedTiers: ['T0', 'T1', 'T2'],
      dailyActionCap: 100,
    });

    await testDb.insert(contacts).values({
      id: contactId,
      companyId,
      firstName: 'Rohit',
      lastName: 'Sharma',
      phone: '+919876543210',
      email: 'rohit.sharma@test.com',
    });

    await testDb.insert(leads).values({
      id: leadId,
      companyId,
      contactId,
      status: 'new',
      intentScore: 45,
      intentLabel: 'warm',
      source: 'web_chat',
    });

    token = signAccessToken({
      sub: userId,
      companyId,
      email: 'priya.nba@test.com',
      name: 'Agent Priya',
      role: 'agent',
      status: 'active',
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('1. Generates T1 Call task when lead intent score is hot (>= 70)', () => {
    const recommendation = nextBestActionService.evaluateRecommendation(
      {
        id: leadId,
        intentScore: 85,
        status: 'qualified',
        buyerDna: {},
        contactName: 'Rohit Sharma',
      },
      'lead_hot',
    );

    expect(recommendation.actionType).toBe('create_task');
    expect(recommendation.tier).toBe('T1');
    expect(recommendation.title).toContain('Call within 5 minutes');
    expect(recommendation.explanation).toContain('hot (85/100)');
  });

  it('2. Generates T1 WhatsApp directions message when site visit is booked', () => {
    const recommendation = nextBestActionService.evaluateRecommendation(
      {
        id: leadId,
        intentScore: 60,
        status: 'site_visit_scheduled',
        buyerDna: {},
        contactName: 'Rohit Sharma',
      },
      'visit_booked',
    );

    expect(recommendation.actionType).toBe('draft_message');
    expect(recommendation.tier).toBe('T1');
    expect(recommendation.title).toContain('Visit Confirmation');
    expect(recommendation.args?.channel).toBe('whatsapp');
  });

  it('3. Generates T1 unit consultation task when Shortlist Room is viewed', () => {
    const recommendation = nextBestActionService.evaluateRecommendation(
      {
        id: leadId,
        intentScore: 50,
        status: 'contacted',
        buyerDna: {},
        contactName: 'Rohit Sharma',
      },
      'room_viewed',
      { time_spent_seconds: 120 },
    );

    expect(recommendation.actionType).toBe('create_task');
    expect(recommendation.tier).toBe('T1');
    expect(recommendation.title).toContain('Priority Unit Consultation');
    expect(recommendation.explanation).toContain('120s');
  });

  it('4. Generates T2 Price Quote proposal when payment plan inquiry is detected', () => {
    const recommendation = nextBestActionService.evaluateRecommendation(
      {
        id: leadId,
        intentScore: 65,
        status: 'contacted',
        buyerDna: { budgetMax: 25000000 },
        contactName: 'Rohit Sharma',
      },
      'intent_changed',
      { reasons: ['price discount inquiry'] },
    );

    expect(recommendation.actionType).toBe('send_price_quote');
    expect(recommendation.tier).toBe('T2');
    expect(recommendation.title).toContain('Payment Plan Approval');
    expect(recommendation.args?.offered_price).toBe(25000000);
  });

  it('5. Event handler directly updates lead nextBestAction column in DB', async () => {
    await nextBestActionService.handleEvent({
      companyId,
      type: 'visit_booked',
      payload: { leadId },
    });

    const [lead] = await testDb
      .select({ nextBestAction: leads.nextBestAction })
      .from(leads)
      .where(eq(leads.id, leadId));

    expect(lead?.nextBestAction).toBeDefined();
    expect((lead?.nextBestAction as Record<string, unknown>).actionType).toBe('draft_message');
    expect((lead?.nextBestAction as Record<string, unknown>).title).toContain('Visit Confirmation');
  });

  it('6. Outbox dispatcher consumer automatically triggers NBA update on domain event', async () => {
    // Insert domain event into outbox
    await testDb
      .insert(domainEvents)
      .values({
        companyId,
        type: 'room_viewed',
        payload: { leadId, time_spent_seconds: 90 },
      });

    // Run outbox dispatcher batch
    // other suites leave events behind in the shared dev DB, so claim a large batch to reach this one
    await outboxDispatcherService.processBatch(1000);

    // Verify lead nextBestAction was updated to room viewed recommendation
    const [updatedLead] = await testDb
      .select({ nextBestAction: leads.nextBestAction })
      .from(leads)
      .where(eq(leads.id, leadId));

    expect(updatedLead?.nextBestAction).toBeDefined();
    const nba = updatedLead?.nextBestAction as Record<string, unknown>;
    expect(nba.title).toContain('Priority Unit Consultation');
  });

  it('7. POST /api/crm/leads/:leadId/next-best-action/execute executes NBA through guarded actions', async () => {
    const res = await request(app)
      .post(`/api/crm/leads/${leadId}/next-best-action/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('executed');

    // Verify action logged in agentActions table
    const [action] = await testDb
      .select()
      .from(agentActions)
      .where(eq(agentActions.id, res.body.data.actionId));

    expect(action).toBeDefined();
    expect(action.leadId).toBe(leadId);
    expect(action.tier).toBe('T1');
    expect(action.status).toBe('executed');

    // Verify lead nextBestAction status updated to 'executed'
    const [lead] = await testDb
      .select({ nextBestAction: leads.nextBestAction })
      .from(leads)
      .where(eq(leads.id, leadId));

    const updatedNba = lead?.nextBestAction as Record<string, unknown>;
    expect(updatedNba.status).toBe('executed');
  });
});
