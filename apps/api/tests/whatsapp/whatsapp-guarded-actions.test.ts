import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  chatbots,
  whatsappConfigs,
  agentActions,
  conversations,
  messages,
  knowledgeQaOverrides,
} from '../../src/db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { signedMetaPost, META_TEST_APP_SECRET } from '../helpers/meta-webhook.js';
process.env.META_APP_SECRET = META_TEST_APP_SECRET;

describe('WhatsApp Guarded AI Actions (Tier 2 Price & Offer Approval Queue)', () => {
  const app = createApp();
  const companyId = '99999999-9999-9999-9999-999999999903';
  const userId = '00000000-0000-0000-0000-000000000093';
  const botId = '77777777-7777-7777-7777-777777777703';
  const phoneNumberId = '104928172635403';
  const cleanPhone = '919876500003';

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Guarded Actions Realty',
        slug: 'whatsapp-guarded-p9',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userId,
        companyId,
        name: 'Admin Guarded',
        email: 'admin@whatsapp-guarded.com',
        role: 'company_admin',
        status: 'active',
        passwordHash: 'dummy',
      })
      .onConflictDoNothing();

    await testDb
      .insert(chatbots)
      .values({
        id: botId,
        companyId,
        name: 'Prestige Guarded Bot',
        type: 'whatsapp',
        status: 'active',
        publicKey: 'pb_pub_wa_03',
      })
      .onConflictDoNothing();

    await testDb
      .insert(whatsappConfigs)
      .values({
        companyId,
        chatbotId: botId,
        phoneNumberId,
        businessPhoneNumber: '+919876543210',
        accessToken: 'EAAG_test_token',
        verifyToken: 'token_123',
        status: 'connected',
      })
      .onConflictDoNothing();

    await testDb
      .insert(knowledgeQaOverrides)
      .values({
        companyId,
        chatbotId: botId,
        question: 'What is the exact starting price and payment plan for 3 BHK?',
        answer: 'Residences start at ₹3.25 Cr onwards for 3BHK villas with a 20:80 milestone payment plan.',
        source: 'manual',
        isActive: true,
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('An AI reply containing a price promise lands in the agent_actions approval queue instead of sending', async () => {
    // Visitor explicitly asks for starting price and cost schedule
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_003',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '919876543210',
                  phone_number_id: phoneNumberId,
                },
                contacts: [{ profile: { name: 'Kavita Nair' }, wa_id: cleanPhone }],
                messages: [
                  {
                    from: cleanPhone,
                    id: 'wamid.HBgmsgPrice001',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: 'What is the exact starting price and payment plan for 3 BHK?' },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    const res = await signedMetaPost(app, payload);
    expect(res.status).toBe(200);

    // Verify proposed action was created in agent_actions table
    const proposedActions = await testDb
      .select()
      .from(agentActions)
      .where(
        and(
          eq(agentActions.companyId, companyId),
          eq(agentActions.actionType, 'send_whatsapp_message'),
          eq(agentActions.tier, 'T2'),
          eq(agentActions.status, 'proposed'),
        ),
      );

    expect(proposedActions.length).toBeGreaterThanOrEqual(1);
    const action = proposedActions[0];
    expect(action).toBeDefined();
    expect(action?.tier).toBe('T2');
    expect(action?.status).toBe('proposed');

    const args = action?.args as { toPhone?: string; content?: string };
    expect(args.toPhone).toBe(cleanPhone);
    expect(args.content).toMatch(/(?:₹|price|cr|lakh|payment)/i);

    // Verify message in thread has isGuardedHold = true
    const [conv] = await testDb
      .select()
      .from(conversations)
      .where(and(eq(conversations.companyId, companyId), eq(conversations.channel, 'whatsapp')));
    expect(conv).toBeDefined();

    const heldMessages = await testDb
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conv!.id), eq(messages.senderType, 'bot')));

    expect(heldMessages.some(m => (m.metadata as Record<string, unknown>)?.isGuardedHold === true)).toBe(true);
  }, 15000);
});
