import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { createTestCompany } from '../helpers/test-fixtures.js';
import { chatbots, conversations, domainEvents, messages } from '../../src/db/schema/index.js';
import { heuristicSentiment, isFrustrated, DEFAULT_ESCALATION_MESSAGE } from '../../src/modules/ai/llm.js';
import { retrievalService } from '../../src/modules/ai/retrieval.service.js';
import { modelRouter, TaskTier } from '../../src/modules/ai/router.js';

describe('Phase 6: frustration detection', () => {
  it('flags the signals named in the spec', () => {
    expect(isFrustrated('this chatbot is useless')).toBe(true);
    expect(isFrustrated('the form is not working')).toBe(true);
    expect(isFrustrated('why is nobody replying!!')).toBe(true);
    expect(isFrustrated('WHY IS NOBODY CALLING ME')).toBe(true);
    expect(isFrustrated('this is a scam')).toBe(true);
  });

  it('does not flag normal property questions or lone acronyms', () => {
    expect(heuristicSentiment('What is the price of a 3BHK?')).toBe('neutral');
    expect(heuristicSentiment('Is the project RERA approved?')).toBe('neutral');
    expect(heuristicSentiment('RERA')).toBe('neutral');
    expect(heuristicSentiment('Great, thanks!')).toBe('neutral');
  });
});

describe('Phase 6: acknowledge & bridge', () => {
  it('system prompt (used by web and WhatsApp) forbids flat refusals and requires a bridge', () => {
    const prompt = retrievalService.buildSystemPrompt('Aria', 'luxury', []);
    expect(prompt).toContain('ACKNOWLEDGE & BRIDGE');
    expect(prompt).toMatch(/never give a flat refusal/i);
    expect(prompt).toMatch(/site visit|callback/i);
    expect(prompt).toContain('NO_VERIFIED_DATA_FOUND'); // answers come only from the chatbot's own data
  });

  it('offline off-topic answers acknowledge and bridge instead of refusing', async () => {
    const res = await modelRouter.executeCompletion({
      tier: TaskTier.STRONG,
      companyId: 'c',
      chatbotId: 'b',
      systemPrompt: 'Relevant Knowledge Context: NO_VERIFIED_DATA_FOUND',
      userMessage: 'what is the weather today',
    });
    expect(res.text).toMatch(/site visit|callback/i);
    expect(res.text).toMatch(/off-topic|outside/i);
  });
});

describe('Phase 6: web chat human escalation', () => {
  const app = createApp();
  let companyId: string;
  let publicKey: string;
  let botId: string;

  beforeAll(async () => {
    const company = await createTestCompany();
    companyId = company.id;
    publicKey = `pb_esc_${crypto.randomBytes(8).toString('hex')}`;
    const [bot] = await testDb
      .insert(chatbots)
      .values({
        companyId,
        name: 'Escalation Bot',
        type: 'web',
        status: 'active',
        publicKey,
        config: { behavior: { escalationMessage: 'Sorry about that! A senior advisor will call you shortly.' } },
      })
      .returning();
    botId = bot!.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  async function session() {
    const res = await request(app).post('/public/session').send({ publicKey, visitorId: `v_${Date.now()}` });
    return { token: res.body.data.sessionToken as string, conversationId: res.body.data.conversationId as string };
  }

  it('flags the conversation, stores the sentiment, raises a handoff event and sends the escalation message', async () => {
    const s = await session();
    const res = await request(app)
      .post('/public/message')
      .set('Authorization', `Bearer ${s.token}`)
      .send({ conversationId: s.conversationId, message: 'This is useless!! Nobody is replying' });

    expect(res.status).toBe(200);
    expect(res.body.data.escalated).toBe(true);
    expect(res.body.data.reply).toBe('Sorry about that! A senior advisor will call you shortly.');

    const [conv] = await testDb.select().from(conversations).where(eq(conversations.id, s.conversationId));
    expect(conv!.status).toBe('needs_human');
    expect(conv!.metadata).toMatchObject({ escalation: { reason: 'frustrated' } });

    const msgs = await testDb.select().from(messages).where(eq(messages.conversationId, s.conversationId));
    expect(msgs.find(m => m.senderType === 'visitor')?.sentiment).toBe('frustrated');
    expect(msgs.find(m => m.senderType === 'bot')?.metadata).toMatchObject({ isEscalationNotice: true });

    const events = await testDb.select().from(domainEvents).where(eq(domainEvents.companyId, companyId));
    const handoff = events.filter(e => e.type === 'handoff_requested');
    expect(handoff).toHaveLength(1);
    expect(handoff[0]!.payload).toMatchObject({ reason: 'frustrated', channel: 'web', chatbot_id: botId });
  });

  it('does not raise a second handoff event for a conversation that is already escalated', async () => {
    const s = await session();
    for (const text of ['NOT WORKING AT ALL', 'still useless!!']) {
      await request(app)
        .post('/public/message')
        .set('Authorization', `Bearer ${s.token}`)
        .send({ conversationId: s.conversationId, message: text });
    }
    const events = await testDb.select().from(domainEvents).where(eq(domainEvents.companyId, companyId));
    const forConv = events.filter(
      e => e.type === 'handoff_requested' && (e.payload as { conversation_id?: string }).conversation_id === s.conversationId,
    );
    expect(forConv).toHaveLength(1);
  });

  it('answers a normal question without escalating', async () => {
    const s = await session();
    const res = await request(app)
      .post('/public/message')
      .set('Authorization', `Bearer ${s.token}`)
      .send({ conversationId: s.conversationId, message: 'What 3BHK options do you have?' });
    expect(res.status).toBe(200);
    expect(res.body.data.escalated).toBeUndefined();
    const [conv] = await testDb.select().from(conversations).where(eq(conversations.id, s.conversationId));
    expect(conv!.status).not.toBe('needs_human');
  });

  it('falls back to the default escalation message when none is configured', () => {
    expect(DEFAULT_ESCALATION_MESSAGE).toMatch(/senior property advisor/);
  });
});
