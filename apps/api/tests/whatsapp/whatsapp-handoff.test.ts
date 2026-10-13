import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { signAccessToken } from '../../src/modules/auth/auth.utils.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  chatbots,
  whatsappConfigs,
  conversations,
  leads,
} from '../../src/db/schema/index.js';
import { eq, and } from 'drizzle-orm';

describe('WhatsApp Human Handoff & Round-Robin Agent Assignment', () => {
  const app = createApp();
  const companyId = '99999999-9999-9999-9999-999999999904';
  const adminId = '00000000-0000-0000-0000-000000000094';
  const agent1Id = '00000000-0000-0000-0000-000000000095';
  const botId = '77777777-7777-7777-7777-777777777704';
  const phoneNumberId = '104928172635404';
  const cleanPhone = '919876500004';

  const adminToken = signAccessToken({
    sub: adminId,
    companyId,
    role: 'company_admin',
    status: 'active',
    email: 'admin@whatsapp-handoff.com',
    name: 'Admin Handoff',
  });

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Handoff Flow Realty',
        slug: 'whatsapp-handoff-p9',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values([
        {
          id: adminId,
          companyId,
          name: 'Admin User',
          email: 'admin@whatsapp-handoff.com',
          role: 'company_admin',
          status: 'active',
          passwordHash: 'dummy',
        },
        {
          id: agent1Id,
          companyId,
          name: 'Sales Agent Priya',
          email: 'priya@whatsapp-handoff.com',
          role: 'agent',
          status: 'active',
          passwordHash: 'dummy',
        },
      ])
      .onConflictDoNothing();

    await testDb
      .insert(chatbots)
      .values({
        id: botId,
        companyId,
        name: 'Prestige Handoff Bot',
        type: 'whatsapp',
        status: 'active',
        publicKey: 'pb_pub_wa_04',
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
        enableAutomation: true,
        aiAutoReplies: true,
        pauseAfterAgentReply: true,
        frustrationHandoff: true,
        autoAssignOwner: true,
        handoffKeywords: ['agent', 'human', 'representative', 'complaint'],
        handoffMessage: 'A property advisor will continue this conversation shortly.',
        status: 'connected',
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it("'human' keyword pauses AI, sets conversation status to needs_human, and triggers round-robin assignment", async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_004',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '919876543210',
                  phone_number_id: phoneNumberId,
                },
                contacts: [{ profile: { name: 'Vikram Mehta' }, wa_id: cleanPhone }],
                messages: [
                  {
                    from: cleanPhone,
                    id: 'wamid.HBgmsgHuman001',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: 'I want to talk to a human agent right now' },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    const res = await request(app).post('/api/webhooks/meta').send(payload);
    expect(res.status).toBe(200);

    // Verify conversation status is needs_human and aiPaused is true
    const [conv] = await testDb
      .select()
      .from(conversations)
      .where(and(eq(conversations.companyId, companyId), eq(conversations.channel, 'whatsapp')));

    expect(conv).toBeDefined();
    expect(conv!.status).toBe('needs_human');
    const meta = conv!.metadata as Record<string, unknown>;
    expect(meta.aiPaused).toBe(true);

    // Verify round-robin assigned agent to the lead
    const lead = await testDb.query.leads.findFirst({
      where: and(eq(leads.companyId, companyId), eq(leads.id, conv!.leadId!)),
    });
    expect(lead?.assignedAgentId).toBeDefined();
    expect([adminId, agent1Id]).toContain(lead?.assignedAgentId);
  });

  it('Agent manual reply from shared inbox pauses AI and updates conversation thread', async () => {
    const [conv] = await testDb
      .select()
      .from(conversations)
      .where(and(eq(conversations.companyId, companyId), eq(conversations.channel, 'whatsapp')));

    // First resume AI to test agent reply auto-pause
    await request(app)
      .post(`/api/whatsapp/conversations/${conv!.id}/resume-ai`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    // Agent sends reply
    const replyRes = await request(app)
      .post(`/api/whatsapp/conversations/${conv!.id}/messages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        content: 'Hi Vikram, I am Priya from Prestige. How can I assist you with your 3 BHK search?',
      });

    expect(replyRes.status).toBe(200);
    expect(replyRes.body.success).toBe(true);
    expect(replyRes.body.data.aiPaused).toBe(true);
  });

  it('Agent clicking resume-ai restores automated bot handling', async () => {
    const [conv] = await testDb
      .select()
      .from(conversations)
      .where(and(eq(conversations.companyId, companyId), eq(conversations.channel, 'whatsapp')));

    const resumeRes = await request(app)
      .post(`/api/whatsapp/conversations/${conv!.id}/resume-ai`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.data.status).toBe('bot');
    expect(resumeRes.body.data.aiPaused).toBe(false);
  });
});
