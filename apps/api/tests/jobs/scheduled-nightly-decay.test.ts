import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, contacts, leads, agentActions, domainEvents } from '../../src/db/schema/index.js';
import { scheduledJobsService } from '../../src/jobs/scheduled-jobs.service.js';
import { eq } from 'drizzle-orm';

describe('Phase 15A: Scheduled Jobs — Nightly Intent Decay & Stale Approvals Expiry', () => {
  const companyId = '66666666-6666-6666-6666-666666666615';
  const contactId = '11111111-3333-5555-7777-999999999915';
  const idleLeadId = '22222222-4444-6666-8888-000000000015';
  const activeLeadId = '33333333-5555-7777-9999-111111111115';
  const convertedLeadId = '44444444-6666-8888-0000-222222222215';

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb.insert(companies).values({
      id: companyId,
      name: 'Scheduled Jobs Realty',
      slug: 'scheduled-jobs-realty',
      plan: 'pro',
      status: 'active',
    });

    await testDb.insert(contacts).values({
      id: contactId,
      companyId,
      firstName: 'Ananya',
      lastName: 'Deshmukh',
      phone: '+919988776655',
      email: 'ananya.d@test.com',
    });

    // 1. Idle lead: updated 9 days ago, score 72 (hot)
    const nineDaysAgo = new Date(Date.now() - 9 * 86400000);
    await testDb.insert(leads).values({
      id: idleLeadId,
      companyId,
      contactId,
      status: 'qualified',
      intentScore: 72,
      intentLabel: 'hot',
      source: 'web_chat',
      updatedAt: nineDaysAgo,
    });

    // 2. Active lead: updated 1 hour ago, score 80
    const oneHourAgo = new Date(Date.now() - 3600000);
    await testDb.insert(leads).values({
      id: activeLeadId,
      companyId,
      contactId,
      status: 'contacted',
      intentScore: 80,
      intentLabel: 'hot',
      source: 'web_chat',
      updatedAt: oneHourAgo,
    });

    // 3. Converted lead: updated 10 days ago (should not decay)
    await testDb.insert(leads).values({
      id: convertedLeadId,
      companyId,
      contactId,
      status: 'converted',
      intentScore: 90,
      intentLabel: 'hot',
      source: 'web_chat',
      updatedAt: nineDaysAgo,
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('1. Nightly intent decay decays score of idle lead, updates label & logs history', async () => {
    const { decayedCount } = await scheduledJobsService.decayIdleLeadScores();
    expect(decayedCount).toBeGreaterThanOrEqual(1);

    // Verify idle lead score decreased
    const [idleLead] = await testDb
      .select()
      .from(leads)
      .where(eq(leads.id, idleLeadId));

    expect(idleLead?.intentScore).toBeLessThan(72);
    expect(idleLead?.intentScore).toBe(66); // 72 - 6 = 66 (idle 9 days -> floor(9/3)*2 = 6 points)
    expect(idleLead?.intentLabel).toBe('warm'); // < 70 becomes warm

    // Verify scoreHistory array entry was appended
    const history = idleLead?.scoreHistory as Array<{ score: number; delta: number; reason: string }>;
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
    expect(history[history.length - 1]?.delta).toBe(-6);
    expect(history[history.length - 1]?.reason).toContain('Nightly decay');

    // Verify active lead was untouched
    const [activeLead] = await testDb
      .select()
      .from(leads)
      .where(eq(leads.id, activeLeadId));

    expect(activeLead?.intentScore).toBe(80);

    // Verify converted lead was untouched
    const [convertedLead] = await testDb
      .select()
      .from(leads)
      .where(eq(leads.id, convertedLeadId));

    expect(convertedLead?.intentScore).toBe(90);

    // Verify intent_changed domain event was published to outbox
    const events = await testDb
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.companyId, companyId));

    const decayEvent = events.find(e => e.type === 'intent_changed' && (e.payload as Record<string, unknown>).lead_id === idleLeadId);
    expect(decayEvent).toBeDefined();
    expect((decayEvent?.payload as Record<string, unknown>).previous_score).toBe(72);
    expect((decayEvent?.payload as Record<string, unknown>).new_score).toBe(66);
  });

  it('2. Stale approval expiry marks expired T2 proposed actions', async () => {
    const staleActionId = 'aaaaaaaa-1111-2222-3333-444444444415';
    const activeActionId = 'bbbbbbbb-1111-2222-3333-444444444415';

    // Insert 1 stale action (expired 2 hours ago)
    await testDb.insert(agentActions).values({
      id: staleActionId,
      companyId,
      leadId: idleLeadId,
      agentName: 'copilot',
      actionType: 'send_price_quote',
      tier: 'T2',
      status: 'proposed',
      args: { offered_price: 15000000 },
      expiresAt: new Date(Date.now() - 7200000), // 2 hours in the past
    });

    // Insert 1 active proposed action (expires in 24 hours)
    await testDb.insert(agentActions).values({
      id: activeActionId,
      companyId,
      leadId: idleLeadId,
      agentName: 'copilot',
      actionType: 'send_price_quote',
      tier: 'T2',
      status: 'proposed',
      args: { offered_price: 16000000 },
      expiresAt: new Date(Date.now() + 86400000), // 24 hours in the future
    });

    const { expiredCount } = await scheduledJobsService.expireStaleApprovals();
    expect(expiredCount).toBeGreaterThanOrEqual(1);

    // Stale action should be 'expired'
    const [staleAction] = await testDb
      .select()
      .from(agentActions)
      .where(eq(agentActions.id, staleActionId));

    expect(staleAction?.status).toBe('expired');

    // Active action should remain 'proposed'
    const [activeAction] = await testDb
      .select()
      .from(agentActions)
      .where(eq(agentActions.id, activeActionId));

    expect(activeAction?.status).toBe('proposed');
  });

  it('3. Retention cleanup removes old processed domain events beyond 30 days', async () => {
    // Insert an old processed event (40 days ago)
    const fortyDaysAgo = new Date(Date.now() - 40 * 86400000);
    const [oldEvent] = await testDb
      .insert(domainEvents)
      .values({
        companyId,
        type: 'ancient_event',
        payload: { old: true },
        processedAt: fortyDaysAgo,
        createdAt: fortyDaysAgo,
      })
      .returning();

    const { purgedCount } = await scheduledJobsService.cleanupOldEvents();
    expect(purgedCount).toBeGreaterThanOrEqual(1);

    const [deleted] = await testDb
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.id, oldEvent!.id));

    expect(deleted).toBeUndefined();
  });
});
