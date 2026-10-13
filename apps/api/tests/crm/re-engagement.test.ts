import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  chatbots,
  contacts,
  leads,
  conversations,
  messages,
} from '../../src/db/schema/index.js';
import { reEngagementService } from '../../src/modules/crm/re-engagement.service.js';

describe('Scheduled Dormant Lead Re-engagement & Buyer DNA Sequences', () => {
  const companyId = '99999999-9999-9999-9999-999999999916';
  const userId = '00000000-0000-0000-0000-000000000096';
  const botId = '77777777-7777-7777-7777-777777777716';
  const contact1Id = '11111111-1111-1111-1111-111111111116';
  const contact2Id = '22222222-2222-2222-2222-222222222216';
  const lead1Id = '33333333-3333-3333-3333-333333333316';
  const lead2Id = '44444444-4444-4444-4444-444444444416';
  const conv1Id = '55555555-5555-5555-5555-555555555516';

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Re-engagement Realty',
        slug: 'reengage-p13',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userId,
        companyId,
        name: 'CRM Agent',
        email: 'crm@reengage.com',
        role: 'agent',
        status: 'active',
        passwordHash: 'dummy',
      })
      .onConflictDoNothing();

    await testDb
      .insert(chatbots)
      .values({
        id: botId,
        companyId,
        name: 'Re-engagement Bot',
        type: 'whatsapp',
        status: 'active',
        publicKey: 'pk_reengage_16',
      })
      .onConflictDoNothing();

    // Contact 1: Active, receptive lead (3 days dormant)
    const threeDaysAgo = new Date(Date.now() - 3.2 * 24 * 60 * 60 * 1000);
    await testDb.insert(contacts).values({
      id: contact1Id,
      companyId,
      firstName: 'Rohan',
      lastName: 'Sharma',
      phone: '+919876500016',
      email: 'rohan@example.com',
    });

    await testDb.insert(leads).values({
      id: lead1Id,
      companyId,
      contactId: contact1Id,
      status: 'qualified',
      source: 'whatsapp',
      intentScore: 82,
      buyerDna: {
        bhk: ['3BHK', '4BHK'],
        localities: ['Whitefield', 'Sarjapur'],
        budgetMax: 35000000,
        timelineMonths: 3,
      },
      updatedAt: threeDaysAgo,
    });

    await testDb.insert(conversations).values({
      id: conv1Id,
      companyId,
      chatbotId: botId,
      contactId: contact1Id,
      leadId: lead1Id,
      channel: 'whatsapp',
      visitorPhone: '+919876500016',
      visitorName: 'Rohan Sharma',
      status: 'bot',
      metadata: {},
      lastMessageAt: threeDaysAgo,
    });

    // Contact 2: Opted out lead
    await testDb.insert(contacts).values({
      id: contact2Id,
      companyId,
      firstName: 'Pooja',
      lastName: 'OptOut',
      phone: '+919876500017',
    });

    await testDb.insert(leads).values({
      id: lead2Id,
      companyId,
      contactId: contact2Id,
      status: 'qualified',
      source: 'whatsapp',
      intentScore: 40,
      customFields: { optedOut: true },
      buyerDna: {
        bhk: ['2BHK'],
      },
      updatedAt: threeDaysAgo,
    });

    // Add STOP message to mark opt-out in messages
    await testDb.insert(conversations).values({
      id: '66666666-6666-6666-6666-666666666616',
      companyId,
      chatbotId: botId,
      contactId: contact2Id,
      leadId: lead2Id,
      channel: 'whatsapp',
      visitorPhone: '+919876500017',
      visitorName: 'Pooja OptOut',
      status: 'closed',
      metadata: { optedOut: true },
      lastMessageAt: threeDaysAgo,
    });

    await testDb.insert(messages).values({
      companyId,
      conversationId: '66666666-6666-6666-6666-666666666616',
      senderType: 'visitor',
      senderId: '+919876500017',
      content: 'STOP messaging me unsubscribe',
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('runs dormant sweep, sends personalized Buyer DNA message, and suppresses opted-out leads', async () => {
    const sweepResult = await reEngagementService.runDormantLeadSweep(companyId, { forceAll: true });

    expect(sweepResult.processedCount).toBeGreaterThanOrEqual(1);
    expect(sweepResult.dispatchedCount).toBeGreaterThanOrEqual(1);
    expect(sweepResult.dispatchedLeads).toContain(lead1Id);
    expect(sweepResult.skippedOptOutCount).toBeGreaterThanOrEqual(1);

    // Verify history logs are recorded in database
    const history = await reEngagementService.getLeadReEngagementHistory(companyId, lead1Id);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0]?.hookTemplate).toBeTruthy();
    expect(history[0]?.messageContent).toContain('Rohan');
  });

  it('avoids re-sending duplicate re-engagement message on subsequent immediate sweeps', async () => {
    const secondSweep = await reEngagementService.runDormantLeadSweep(companyId);
    expect(secondSweep.dispatchedLeads).not.toContain(lead1Id);
  });
});
