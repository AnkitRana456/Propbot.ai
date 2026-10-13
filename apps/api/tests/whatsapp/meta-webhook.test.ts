import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies, users, chatbots, whatsappConfigs } from '../../src/db/schema/index.js';

describe('Meta WhatsApp Cloud API Webhook Protocol', () => {
  const app = createApp();
  const companyId = '99999999-9999-9999-9999-999999999901';
  const userId = '00000000-0000-0000-0000-000000000091';
  const botId = '77777777-7777-7777-7777-777777777701';
  const verifyToken = 'propbot_verify_token_secret_123';
  const appSecret = 'meta_app_secret_test_998877';
  const phoneNumberId = '104928172635499';

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'WhatsApp Webhook Realty',
        slug: 'whatsapp-webhook-p9',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userId,
        companyId,
        name: 'Admin WhatsApp',
        email: 'admin@whatsapp-webhook.com',
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
        name: 'Prestige Bot',
        type: 'whatsapp',
        status: 'active',
        publicKey: 'pb_pub_wa_01',
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
        appSecret,
        verifyToken,
        templateName: 'property_inquiry_details',
        status: 'connected',
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('GET /api/webhooks/meta succeeds handshake with correct verify token and challenge', async () => {
    const challengeStr = 'test_hub_challenge_string_9988';
    const res = await request(app)
      .get('/api/webhooks/meta')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': verifyToken,
        'hub.challenge': challengeStr,
      });

    expect(res.status).toBe(200);
    expect(res.text).toBe(challengeStr);
  });

  it('GET /api/webhooks/meta rejects invalid verify token with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/webhooks/meta')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong_token',
        'hub.challenge': '12345',
      });

    expect(res.status).toBe(403);
  });

  it('POST /api/webhooks/meta rejects payload with invalid signature header with 401 Unauthorized', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '919876543210',
                  phone_number_id: phoneNumberId,
                },
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.HBgtestinvalid001',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: 'Hello' },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    const res = await request(app)
      .post('/api/webhooks/meta')
      .set('X-Hub-Signature-256', 'sha256=invalid_forged_signature_hash')
      .send(payload);

    expect(res.status).toBe(401);
  });

  it('POST /api/webhooks/meta accepts valid HMAC-SHA256 signature and processes message', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '919876543210',
                  phone_number_id: phoneNumberId,
                },
                contacts: [{ profile: { name: 'Aarav Patel' }, wa_id: '919876543210' }],
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.HBgtestvalid001',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: 'Hello, looking for luxury apartments' },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    const rawBody = JSON.stringify(payload);
    const validHmac = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

    const res = await request(app)
      .post('/api/webhooks/meta')
      .set('X-Hub-Signature-256', `sha256=${validHmac}`)
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.processedCount).toBe(1);
  });

  it('POST /api/webhooks/meta enforces idempotency: duplicate wamid is skipped without re-processing', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '919876543210',
                  phone_number_id: phoneNumberId,
                },
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.HBgtestvalid001', // Exact same message ID as previous test
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: 'Hello, looking for luxury apartments' },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    const rawBody = JSON.stringify(payload);
    const validHmac = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

    const res = await request(app)
      .post('/api/webhooks/meta')
      .set('X-Hub-Signature-256', `sha256=${validHmac}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.processedCount).toBe(0); // 0 because it was skipped as duplicate
  });

  it('POST /api/webhooks/meta returns 404 for unknown/unregistered phone number ID', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '919999999999',
                  phone_number_id: 'unknown_phone_number_9999',
                },
                messages: [
                  {
                    from: '919999999999',
                    id: 'wamid.HBgunknown001',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: 'Inquiry' },
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
    expect(res.status).toBe(404);
  });
});
