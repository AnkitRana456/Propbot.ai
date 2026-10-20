import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/server.js';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import {
  companies,
  users,
  chatbots,
  whatsappConfigs,
  conversations,
  messages,
} from '../../src/db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { MockSpeechToTextProvider } from '../../src/modules/ai/speech-to-text.provider.js';
import { signedMetaPost, META_TEST_APP_SECRET } from '../helpers/meta-webhook.js';
process.env.META_APP_SECRET = META_TEST_APP_SECRET;

describe('Voice Transcription & WhatsApp Audio Voice Notes', () => {
  const app = createApp();
  const companyId = '99999999-9999-9999-9999-999999999913';
  const userId = '00000000-0000-0000-0000-000000000093';
  const botId = '77777777-7777-7777-7777-777777777713';
  const phoneNumberId = '104928172635413';
  const cleanPhone = '919876500013';

  beforeAll(async () => {
    await cleanupTestDatabase([companyId]);

    await testDb
      .insert(companies)
      .values({
        id: companyId,
        name: 'Voice Notes Realty',
        slug: 'voice-notes-p13',
        plan: 'growth',
        status: 'active',
      })
      .onConflictDoNothing();

    await testDb
      .insert(users)
      .values({
        id: userId,
        companyId,
        name: 'Voice Agent',
        email: 'voice@realty.com',
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
        name: 'Voice Concierge Bot',
        type: 'whatsapp',
        status: 'active',
        publicKey: 'pk_voice_9913',
        config: {
          appearance: { primaryColor: '#059669', botName: 'Voice Concierge' },
          behavior: {
            systemPrompt: 'You are an elite property advisor answering inquiries.',
            tone: 'luxury',
            defaultLanguage: 'en',
            supportedLanguages: ['en', 'hi', 'hi-Latn'],
            greetingMessage: 'Welcome to Voice Concierge.',
          },
        },
      })
      .onConflictDoNothing();

    await testDb
      .insert(whatsappConfigs)
      .values({
        companyId,
        chatbotId: botId,
        phoneNumberId,
        businessPhoneNumber: '+15550999913',
        accessToken: 'EAAVoiceTokenValid123',
        verifyToken: 'propbot_voice_verify_token',
        status: 'active',
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyId]);
  });

  it('SpeechToTextProvider transcribes audio buffer into grounded query text', async () => {
    const provider = new MockSpeechToTextProvider();
    const dummyAudio = Buffer.from('RIFF....WAVEfmt ....data....');

    const result = await provider.transcribe(dummyAudio, {
      mimeType: 'audio/ogg; codecs=opus',
      languageHint: 'en',
    });

    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(10);
    expect(result.confidence).toBeGreaterThan(0.85);
  });

  it('handles inbound WhatsApp audio payload by transcribing and generating grounded AI answer', async () => {
    const audioPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba_voice_9913',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '+15550999913',
                  phone_number_id: phoneNumberId,
                },
                contacts: [
                  {
                    profile: { name: 'Aarav Voice Patel' },
                    wa_id: cleanPhone,
                  },
                ],
                messages: [
                  {
                    from: cleanPhone,
                    id: 'wamid.HBgLMjA5NTg3NjUwMDAxMxUCABIYFDNBRDgzQTIwNDgwRTY5NTgzNThGAA==',
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: 'audio',
                    audio: {
                      id: 'media_audio_id_123',
                      mime_type: 'audio/ogg; codecs=opus',
                      voice: true,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const res = await signedMetaPost(app, audioPayload).expect(200);

    expect(res.body.processedCount).toBe(1);

    // Verify conversation was created
    const [conv] = await testDb
      .select()
      .from(conversations)
      .where(and(eq(conversations.companyId, companyId), eq(conversations.chatbotId, botId)));

    expect(conv).toBeDefined();

    // Verify messages: visitor audio message is tagged with isVoiceNote
    const convMessages = await testDb
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conv!.id))
      .orderBy(messages.createdAt);

    expect(convMessages.length).toBeGreaterThanOrEqual(2);

    const visitorMsg = convMessages.find(m => m.senderType === 'visitor');
    expect(visitorMsg).toBeDefined();
    const msgMeta = (visitorMsg?.metadata as Record<string, unknown>) || {};
    expect(msgMeta.isVoiceNote).toBe(true);

    // Bot reply should have answered
    const botMsg = convMessages.find(m => m.senderType === 'bot');
    expect(botMsg).toBeDefined();
    expect(botMsg?.content).toBeTruthy();
  });
});
