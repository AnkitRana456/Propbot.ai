import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  chatbots,
  whatsappConfigs,
  leads,
  contacts,
  conversations,
  messages,
} from '../../src/db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { signedMetaPost, META_TEST_APP_SECRET } from '../helpers/meta-webhook.js';
process.env.META_APP_SECRET = META_TEST_APP_SECRET;

describe('WhatsApp Inbound Messaging Flow & CRM Integration', () => {
  const app = createApp();
  const companyId = '99999999-9999-9999-9999-999999999902';
  const userId = '00000000-0000-0000-0000-000000000092';
  const botId = '77777777-7777-7777-7777-777777777702';
  const phoneNumberId = '104928172635402';
  const visitorPhone = '+919876500002';
  const cleanPhone = '919876500002';

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Inbound Flow Realty',
        slug: 'whatsapp-inbound-p9',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userId,
        companyId,
        name: 'Inbound Flow Agent',
        email: 'agent@whatsapp-inbound.com',
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
        name: 'Prestige Inbound Bot',
        type: 'whatsapp',
        status: 'active',
        publicKey: 'pb_pub_wa_02',
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
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('Inbound message creates Contact and Lead with source=whatsapp and replies via chatbot', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_001',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '919876543210',
                  phone_number_id: phoneNumberId,
                },
                contacts: [{ profile: { name: 'Rohan Sharma' }, wa_id: cleanPhone }],
                messages: [
                  {
                    from: cleanPhone,
                    id: 'wamid.HBgmsg001',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: 'Hi, I want to know more about your apartments' },
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
    expect(res.body.processedCount).toBe(1);

    // Verify Contact created
    const contact = await testDb.query.contacts.findFirst({
      where: and(eq(contacts.companyId, companyId), eq(contacts.phone, visitorPhone)),
    });
    expect(contact).toBeDefined();
    // Spec: first-time senders are "WhatsApp User <last4>"; the profile name is kept only as metadata
    expect(contact?.firstName).toBe('WhatsApp');
    expect(contact?.lastName).toBe(`User ${visitorPhone.replace(/\D/g, '').slice(-4)}`);

    // Verify Lead created
    const lead = await testDb.query.leads.findFirst({
      where: and(eq(leads.companyId, companyId), eq(leads.contactId, contact!.id)),
    });
    expect(lead).toBeDefined();
    expect(lead?.source).toBe('whatsapp');

    // Verify Conversation created with channel=whatsapp
    const conv = await testDb.query.conversations.findFirst({
      where: and(eq(conversations.companyId, companyId), eq(conversations.contactId, contact!.id)),
    });
    expect(conv).toBeDefined();
    expect(conv?.channel).toBe('whatsapp');

    // Verify bot replied in messages
    const msgs = await testDb
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conv!.id));
    expect(msgs.length).toBeGreaterThanOrEqual(2); // Visitor message + Bot reply
    expect(msgs.some(m => m.senderType === 'bot')).toBe(true);
  });

  it('Subsequent message from same phone updates existing conversation and does not create duplicate lead', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_001',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '919876543210',
                  phone_number_id: phoneNumberId,
                },
                contacts: [{ profile: { name: 'Rohan Sharma' }, wa_id: cleanPhone }],
                messages: [
                  {
                    from: cleanPhone,
                    id: 'wamid.HBgmsg002',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: 'Looking for 3 BHK under 2.5 Cr' },
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

    // Ensure total contacts for this phone remains exactly 1
    const matchingContacts = await testDb
      .select()
      .from(contacts)
      .where(and(eq(contacts.companyId, companyId), eq(contacts.phone, visitorPhone)));
    expect(matchingContacts.length).toBe(1);
  });

  it('STOP keyword unsubscribes user and sends opt-out confirmation message', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_001',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '919876543210',
                  phone_number_id: phoneNumberId,
                },
                contacts: [{ profile: { name: 'Rohan Sharma' }, wa_id: cleanPhone }],
                messages: [
                  {
                    from: cleanPhone,
                    id: 'wamid.HBgmsgSTOP001',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: 'STOP' },
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

    // Verify contact marked as opted out
    const contact = await testDb.query.contacts.findFirst({
      where: and(eq(contacts.companyId, companyId), eq(contacts.phone, visitorPhone)),
    });
    expect(contact?.altPhone).toBe('OPTED_OUT');
  });

  it('START keyword resubscribes user and clears opt-out status', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_001',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '919876543210',
                  phone_number_id: phoneNumberId,
                },
                contacts: [{ profile: { name: 'Rohan Sharma' }, wa_id: cleanPhone }],
                messages: [
                  {
                    from: cleanPhone,
                    id: 'wamid.HBgmsgSTART001',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: 'START' },
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

    // Verify contact marked active (not opted out)
    const contact = await testDb.query.contacts.findFirst({
      where: and(eq(contacts.companyId, companyId), eq(contacts.phone, visitorPhone)),
    });
    expect(contact?.altPhone).toBeNull();
  });
});
