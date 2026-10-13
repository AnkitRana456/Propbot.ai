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
import { copilotService } from '../../src/modules/crm/copilot.service.js';
import { playbooksService } from '../../src/modules/ai/playbooks.service.js';

describe('AI Agent Copilot & Sales Intelligence Tools', () => {
  const companyId = '99999999-9999-9999-9999-999999999917';
  const userId = '00000000-0000-0000-0000-000000000097';
  const contactId = '11111111-1111-1111-1111-111111111117';
  const leadId = '22222222-2222-2222-2222-222222222217';
  const botId = '44444444-4444-4444-4444-444444444417';
  const convId = '33333333-3333-3333-3333-333333333317';

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Copilot Realty',
        slug: 'copilot-p13',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userId,
        companyId,
        name: 'Copilot Agent',
        email: 'copilot@realty.com',
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
        name: 'Copilot Bot',
        type: 'whatsapp',
        status: 'active',
        publicKey: 'pk_copilot_17',
      })
      .onConflictDoNothing();

    await testDb.insert(contacts).values({
      id: contactId,
      companyId,
      firstName: 'Vikram',
      lastName: 'Malhotra',
      phone: '+919876500018',
      email: 'vikram.m@example.com',
    });

    await testDb.insert(leads).values({
      id: leadId,
      companyId,
      contactId,
      status: 'qualified',
      source: 'whatsapp',
      intentScore: 88,
      buyerDna: {
        bhk: ['3BHK', '4BHK'],
        localities: ['Indiranagar', 'Koramangala'],
        budgetMin: 30000000,
        budgetMax: 50000000,
        timelineMonths: 2,
        purpose: 'end_use',
      },
    });

    await testDb.insert(conversations).values({
      id: convId,
      companyId,
      chatbotId: botId,
      contactId,
      leadId,
      channel: 'whatsapp',
      visitorPhone: '+919876500018',
      visitorName: 'Vikram Malhotra',
      status: 'agent',
    });

    await testDb.insert(messages).values([
      {
        companyId,
        conversationId: convId,
        senderType: 'visitor',
        senderId: '+919876500018',
        content: 'Hi, I am looking for a 3BHK or 4BHK apartment in Indiranagar around 4 Cr.',
      },
      {
        companyId,
        conversationId: convId,
        senderType: 'visitor',
        senderId: '+919876500018',
        content: 'Is your pricing firm or is there any festival discount available?',
      },
    ]);

    // Create a verified objection playbook for rebuttal testing
    await playbooksService.createPlaybook(companyId, {
      category: 'price_too_high',
      title: 'Discount request / high pricing',
      triggerKeywords: ['discount', 'offer', 'reduce', 'negotiate'],
      rebuttalText:
        'Our developer pricing is strictly transparent and direct-from-builder with no hidden markups. We can however bundle zero-stamp-duty or a complimentary club membership.',
      suggestedAction: 'Propose private developer meeting for high-intent closure',
      isActive: true,
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('generates 3 tactical AI reply suggestions with tone customization', async () => {
    const res = await copilotService.suggestReply(companyId, leadId, {
      lastVisitorMessage: 'Is there any discount available on the 4 Cr units?',
      tone: 'warm',
    });

    expect(res.suggestions).toBeDefined();
    expect(res.suggestions.length).toBe(3);
    res.suggestions.forEach(sug => {
      expect(sug.id).toBeTruthy();
      expect(sug.title).toBeTruthy();
      expect(sug.text).toBeTruthy();
      expect(sug.strategy).toBeTruthy();
    });
  });

  it('generates executive lead summary and deal health insights', async () => {
    const summary = await copilotService.summariseLead(companyId, leadId);

    expect(summary.leadId).toBe(leadId);
    expect(summary.leadName).toBe('Vikram Malhotra');
    expect(summary.summary).toBeTruthy();
    expect(summary.intentLevel).toBeTruthy();
    expect(summary.recommendedAction).toBeTruthy();
  });

  it('generates a personalized 60-second phone call script from Buyer DNA', async () => {
    const script = await copilotService.generateCallScript(companyId, leadId);

    expect(script.leadId).toBe(leadId);
    expect(script.leadName).toBe('Vikram Malhotra');
    expect(script.suggestedOpener).toBeTruthy();
    expect(script.qualifyingQuestions.length).toBeGreaterThanOrEqual(1);
    expect(script.closingHook).toBeTruthy();
  });

  it('generates verified objection rebuttals using agency playbooks', async () => {
    const rebuttal = await copilotService.getObjectionRebuttal(companyId, {
      objection: 'Can you offer a 10% discount on this unit?',
    });

    expect(rebuttal.rebuttals).toBeDefined();
    expect(rebuttal.rebuttals.length).toBeGreaterThanOrEqual(1);
    const approvedRebuttal = rebuttal.rebuttals.find(r => r.framework === 'Company Approved Playbook');
    expect(approvedRebuttal).toBeDefined();
    expect(approvedRebuttal?.text).toContain('transparent');
  });
});
