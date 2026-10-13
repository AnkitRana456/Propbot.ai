import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, chatbots, contacts, leads, domainEvents } from '../../src/db/schema/index.js';
import { leadsService } from '../../src/modules/leads/leads.service.js';
import { eq, and } from 'drizzle-orm';

describe('Phase 5 Lead Capture & Deduplication Integration', () => {
  const companyId = '55555555-5555-5555-5555-555555555555';
  let chatbotId: string;

  beforeAll(async () => {
    // Seed company & chatbot
    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Prestige Test Realty',
        slug: 'prestige-test-realty-5',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    const [bot] = await testDb
      .insert(chatbots)
      .values({
        companyId,
        name: 'Sales Concierge',
        type: 'web',
        status: 'active',
        publicKey: 'pb_live_phase5_test_public_key_12345678901234',
        config: {},
      })
      .returning();

    chatbotId = bot.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('normalizes Indian (+91) and international phone formats', () => {
    expect(leadsService.normalizePhone('9876543210')).toBe('+919876543210');
    expect(leadsService.normalizePhone('09876543210')).toBe('+919876543210');
    expect(leadsService.normalizePhone('+91 98765-43210')).toBe('+919876543210');
    expect(leadsService.normalizePhone('+1 (555) 019-2834')).toBe('+15550192834');
  });

  it('captures a new lead, links contact, and emits lead_created domain event', async () => {
    const input = {
      chatbotId,
      name: 'Rohan Sharma',
      phone: '9876543210',
      email: 'rohan.sharma@example.com',
      budget: '3.5 Cr',
      bhk: '3BHK',
      location: 'Whitefield',
      purpose: 'end_use',
      timeline: 'immediate',
    };

    const { lead, isDuplicate } = await leadsService.captureOrUpdateLead(companyId, input);

    expect(isDuplicate).toBe(false);
    expect(lead.name).toBe('Rohan Sharma');
    expect(lead.phone).toBe('+919876543210');
    expect(lead.email).toBe('rohan.sharma@example.com');
    expect(lead.buyerDna.bhk).toContain('3BHK');
    expect(lead.buyerDna.budgetMax).toBe(35000000);
    expect(lead.intentScore).toBeGreaterThan(0);
    expect(lead.scoreExplanation.length).toBeGreaterThan(0);

    // Verify contact created
    const contact = await testDb.query.contacts.findFirst({
      where: and(eq(contacts.companyId, companyId), eq(contacts.phone, '+919876543210')),
    });
    expect(contact).toBeDefined();
    expect(contact?.firstName).toBe('Rohan');

    // Verify domain_events outbox recorded 'lead_created'
    const outboxEvents = await testDb.query.domainEvents.findMany({
      where: and(eq(domainEvents.companyId, companyId), eq(domainEvents.type, 'lead_created')),
    });
    expect(outboxEvents.length).toBeGreaterThanOrEqual(1);
    const createdEvent = outboxEvents.find(
      e => (e.payload as Record<string, unknown>).lead_id === lead.id,
    );
    expect(createdEvent).toBeDefined();
  });

  it('detects duplicate phone: creates a merge suggestion instead of a 2nd lead', async () => {
    // Visitor returns and inputs the same phone number
    const duplicateInput = {
      chatbotId,
      name: 'Rohan Sharma (Updated)',
      phone: '+919876543210', // SAME PHONE
      email: 'rohan.new@example.com',
      budget: '4.5 Cr',
    };

    const { lead, isDuplicate } = await leadsService.captureOrUpdateLead(companyId, duplicateInput);

    expect(isDuplicate).toBe(true);

    // Verify there is still only ONE lead for this company with this contact
    const allLeads = await testDb.query.leads.findMany({
      where: eq(leads.companyId, companyId),
    });
    expect(allLeads).toHaveLength(1);

    // Verify merge suggestion was generated on the lead
    expect(lead.duplicateMergeSuggestion).toBeDefined();
    expect(lead.duplicateMergeSuggestion?.matchingField).toBe('phone');
    expect(lead.duplicateMergeSuggestion?.matchingValue).toBe('+919876543210');
  });

  it('updates lead status and records lead_status_changed in domain_events', async () => {
    const allLeads = await testDb.query.leads.findMany({
      where: eq(leads.companyId, companyId),
    });
    const leadId = allLeads[0].id;

    const updated = await leadsService.updateLeadStatus(
      companyId,
      leadId,
      'qualified',
      'High budget buyer verified',
    );

    expect(updated.status).toBe('qualified');

    const statusEvents = await testDb.query.domainEvents.findMany({
      where: and(eq(domainEvents.companyId, companyId), eq(domainEvents.type, 'lead_status_changed')),
    });
    expect(statusEvents.length).toBeGreaterThanOrEqual(1);
  });
});
