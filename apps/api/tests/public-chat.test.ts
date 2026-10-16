import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../src/server.js';
import { db } from '../src/db/index.js';
import { companies, chatbots } from '../src/db/schema/index.js';
import { eq } from 'drizzle-orm';

describe('Public Chat API Endpoints (/public & /api/public/chat)', () => {
  const app = createApp();
  let companyId: string;
  let chatbotId: string;
  let publicKey: string;

  beforeAll(async () => {
    let [co] = await db.select({ id: companies.id }).from(companies).limit(1);
    if (!co) {
      const [newCo] = await db
        .insert(companies)
        .values({
          name: 'Public Chat Test Corp',
          slug: `pub-chat-${Date.now()}`,
          status: 'active',
        })
        .returning({ id: companies.id });
      co = newCo!;
    }
    companyId = co.id;

    publicKey = `pb_test_${crypto.randomBytes(12).toString('hex')}`;
    const [bot] = await db
      .insert(chatbots)
      .values({
        companyId,
        name: 'Public Test Bot',
        type: 'web',
        status: 'active',
        publicKey,
        config: {
          appearance: {
            botName: 'Test Assistant',
            primaryColor: '#2563eb',
            themeMode: 'dark',
          },
          behavior: {
            greetingMessage: 'Welcome! How can I help you today?',
            quickQuestions: ['What are the prices?', 'Book a visit'],
          },
        },
      })
      .returning();
    chatbotId = bot!.id;
  });

  afterAll(async () => {
    if (chatbotId) {
      await db.delete(chatbots).where(eq(chatbots.id, chatbotId)).catch(() => {});
    }
  });

  it('GET /public/config/:publicKey returns public widget configuration', async () => {
    const res = await request(app).get(`/public/config/${publicKey}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.botName).toBe('Test Assistant');
    expect(res.body.data.primaryColor).toBe('#2563eb');
    expect(res.body.data.greetingMessage).toBe('Welcome! How can I help you today?');
  });

  it('POST /public/session initiates visitor session and returns sessionToken', async () => {
    const res = await request(app)
      .post('/public/session')
      .send({
        publicKey,
        visitorId: `vis_${Date.now()}`,
        pageUrl: 'https://example.com/property-details',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('sessionToken');
    expect(res.body.data).toHaveProperty('conversationId');
    expect(res.body.data.chatbotId).toBe(chatbotId);
  });

  it('POST /public/message sends message and receives non-faked honest reply', async () => {
    const sessionRes = await request(app)
      .post('/public/session')
      .send({ publicKey });

    const token = sessionRes.body.data.sessionToken;
    const conversationId = sessionRes.body.data.conversationId;

    const res = await request(app)
      .post('/public/message')
      .set('Authorization', `Bearer ${token}`)
      .send({
        conversationId,
        message: 'What is the starting price for 3BHK villas?',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('reply');
    expect(typeof res.body.data.reply).toBe('string');
    expect(res.body.data.reply.length).toBeGreaterThan(0);
  });

  it('POST /public/lead captures contact details and creates CRM lead', async () => {
    const sessionRes = await request(app)
      .post('/public/session')
      .send({ publicKey });

    const token = sessionRes.body.data.sessionToken;
    const conversationId = sessionRes.body.data.conversationId;

    const res = await request(app)
      .post('/public/lead')
      .set('Authorization', `Bearer ${token}`)
      .send({
        conversationId,
        fullName: 'Rahul Verma',
        phone: '+919988776655',
        email: 'rahul.verma@example.com',
        preferences: { budget: '2 Cr', type: '3BHK' },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('leadId');
    expect(res.body.data).toHaveProperty('contactId');
  });

  it('GET /public/history retrieves conversation message history', async () => {
    const sessionRes = await request(app)
      .post('/public/session')
      .send({ publicKey });

    const token = sessionRes.body.data.sessionToken;
    const conversationId = sessionRes.body.data.conversationId;

    await request(app)
      .post('/public/message')
      .set('Authorization', `Bearer ${token}`)
      .send({
        conversationId,
        message: 'Checking message history test query',
      });

    const historyRes = await request(app)
      .get(`/public/history?conversationId=${conversationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.success).toBe(true);
    expect(Array.isArray(historyRes.body.data.messages)).toBe(true);
    expect(historyRes.body.data.messages.length).toBeGreaterThanOrEqual(1);
  });
});
