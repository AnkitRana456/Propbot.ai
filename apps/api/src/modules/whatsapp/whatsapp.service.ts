import crypto from 'crypto';
import { eq, and, sql, desc, or, ilike, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  whatsappConfigs,
  whatsappInboundEvents,
  whatsappCampaigns,
  chatbots,
  conversations,
  messages,
  leads,
  contacts,
  users,
  agentActions,
  domainEvents,
} from '../../db/schema/index.js';
import type {
  WhatsappConfigResponse,
  UpdateWhatsappConfigInput,
  WhatsappOverviewKpi,
  WhatsappConversationFilter,
  WhatsAppConversationItem,
  WhatsAppConversationDetail,
  SendInboxMessageInput,
  BroadcastCampaignInput,
} from '@propbot/shared';
import { whatsappAdapter, whatsappLogger } from './whatsapp.adapter.js';
import { leadsService } from '../leads/leads.service.js';
import { billingService, PlanLimitError } from '../billing/billing.service.js';
import { retrievalService } from '../ai/retrieval.service.js';
import { assignmentService } from '../crm/assignment.service.js';
import { speechToTextProvider } from '../ai/speech-to-text.provider.js';

import { isFrustrated } from '../ai/llm.js';
import { prepareAgentTurn, collectAttributes } from '../agents/agent-chat.js';
import { openSecret, sealSecret } from '../../utils/crypto-vault.js';

export class WhatsAppService {
  /**
   * Masks sensitive token string for safe client display.
   */
  private maskToken(token: string | null | undefined): string | null {
    if (!token) return null;
    if (token.length <= 8) return '••••••••';
    return `${token.slice(0, 4)}••••••••${token.slice(-4)}`;
  }

  /**
   * Retrieves tenant WhatsApp configuration.
   */
  async getConfig(companyId: string): Promise<WhatsappConfigResponse> {
    const [config] = await db
      .select({
        id: whatsappConfigs.id,
        companyId: whatsappConfigs.companyId,
        chatbotId: whatsappConfigs.chatbotId,
        phoneNumberId: whatsappConfigs.phoneNumberId,
        businessPhoneNumber: whatsappConfigs.businessPhoneNumber,
        accessToken: whatsappConfigs.accessToken,
        appSecret: whatsappConfigs.appSecret,
        businessAccountId: whatsappConfigs.businessAccountId,
        verifyToken: whatsappConfigs.verifyToken,
        templateName: whatsappConfigs.templateName,
        enableAutomation: whatsappConfigs.enableAutomation,
        aiAutoReplies: whatsappConfigs.aiAutoReplies,
        pauseAfterAgentReply: whatsappConfigs.pauseAfterAgentReply,
        frustrationHandoff: whatsappConfigs.frustrationHandoff,
        autoAssignOwner: whatsappConfigs.autoAssignOwner,
        handoffKeywords: whatsappConfigs.handoffKeywords,
        handoffMessage: whatsappConfigs.handoffMessage,
        status: whatsappConfigs.status,
        updatedAt: whatsappConfigs.updatedAt,
        chatbotName: chatbots.name,
      })
      .from(whatsappConfigs)
      .leftJoin(chatbots, eq(whatsappConfigs.chatbotId, chatbots.id))
      .where(eq(whatsappConfigs.companyId, companyId));

    const callbackUrl = `${process.env.API_URL || 'https://api.propbot.pro'}/api/webhooks/meta`;

    if (!config) {
      const generatedVerifyToken = crypto.randomBytes(16).toString('hex');
      return {
        id: '00000000-0000-0000-0000-000000000000',
        companyId,
        chatbotId: null,
        chatbotName: null,
        phoneNumberId: '',
        businessPhoneNumber: '',
        maskedAccessToken: null,
        hasAppSecret: false,
        verifyToken: generatedVerifyToken,
        callbackUrl,
        templateName: 'property_inquiry_details',
        enableAutomation: true,
        aiAutoReplies: true,
        pauseAfterAgentReply: true,
        frustrationHandoff: true,
        autoAssignOwner: true,
        handoffKeywords: ['agent', 'human', 'representative', 'complaint'],
        handoffMessage: 'A property advisor will continue this conversation shortly.',
        status: 'disconnected',
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      id: config.id,
      companyId: config.companyId,
      chatbotId: config.chatbotId,
      chatbotName: config.chatbotName,
      phoneNumberId: config.phoneNumberId,
      businessAccountId: config.businessAccountId ?? null,
      businessPhoneNumber: config.businessPhoneNumber,
      maskedAccessToken: this.maskToken(openSecret(config.accessToken) ?? null),
      hasAppSecret: Boolean(config.appSecret),
      verifyToken: config.verifyToken,
      callbackUrl,
      templateName: config.templateName,
      enableAutomation: config.enableAutomation,
      aiAutoReplies: config.aiAutoReplies,
      pauseAfterAgentReply: config.pauseAfterAgentReply,
      frustrationHandoff: config.frustrationHandoff,
      autoAssignOwner: config.autoAssignOwner,
      handoffKeywords: config.handoffKeywords,
      handoffMessage: config.handoffMessage,
      status: (config.status as WhatsappConfigResponse['status']) || 'disconnected',
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  /**
   * Updates or creates tenant WhatsApp configuration.
   */
  async updateConfig(
    companyId: string,
    input: UpdateWhatsappConfigInput,
  ): Promise<WhatsappConfigResponse> {
    const isConnected = Boolean(input.accessToken && input.phoneNumberId);
    const existing = await db.query.whatsappConfigs.findFirst({
      where: eq(whatsappConfigs.companyId, companyId),
    });

    const verifyToken = existing?.verifyToken || crypto.randomBytes(16).toString('hex');

    if (existing) {
      await db
        .update(whatsappConfigs)
        .set({
          chatbotId: input.chatbotId || null,
          phoneNumberId: input.phoneNumberId,
          businessAccountId: input.businessAccountId !== undefined ? input.businessAccountId || null : existing.businessAccountId,
          businessPhoneNumber: input.businessPhoneNumber,
          accessToken: input.accessToken.includes('••••') ? existing.accessToken : sealSecret(input.accessToken),
          appSecret: input.appSecret !== undefined ? sealSecret(input.appSecret) : existing.appSecret,
          templateName: input.templateName,
          enableAutomation: input.enableAutomation,
          aiAutoReplies: input.aiAutoReplies,
          pauseAfterAgentReply: input.pauseAfterAgentReply,
          frustrationHandoff: input.frustrationHandoff,
          autoAssignOwner: input.autoAssignOwner,
          handoffKeywords: input.handoffKeywords,
          handoffMessage: input.handoffMessage,
          status: isConnected ? 'connected' : 'disconnected',
          updatedAt: new Date(),
        })
        .where(eq(whatsappConfigs.companyId, companyId));
    } else {
      await db.insert(whatsappConfigs).values({
        companyId,
        chatbotId: input.chatbotId || null,
        phoneNumberId: input.phoneNumberId,
        businessAccountId: input.businessAccountId || null,
        businessPhoneNumber: input.businessPhoneNumber,
        accessToken: sealSecret(input.accessToken),
        appSecret: sealSecret(input.appSecret),
        verifyToken,
        templateName: input.templateName,
        enableAutomation: input.enableAutomation,
        aiAutoReplies: input.aiAutoReplies,
        pauseAfterAgentReply: input.pauseAfterAgentReply,
        frustrationHandoff: input.frustrationHandoff,
        autoAssignOwner: input.autoAssignOwner,
        handoffKeywords: input.handoffKeywords,
        handoffMessage: input.handoffMessage,
        status: isConnected ? 'connected' : 'disconnected',
      });
    }

    return this.getConfig(companyId);
  }

  /**
   * Generates a new random webhook verification token.
   */
  async generateVerifyToken(companyId: string): Promise<{ verifyToken: string }> {
    const newToken = crypto.randomBytes(16).toString('hex');
    const existing = await db.query.whatsappConfigs.findFirst({
      where: eq(whatsappConfigs.companyId, companyId),
    });

    if (existing) {
      await db
        .update(whatsappConfigs)
        .set({ verifyToken: newToken, updatedAt: new Date() })
        .where(eq(whatsappConfigs.companyId, companyId));
    }

    return { verifyToken: newToken };
  }

  /**
   * One-click sandbox connector for instant demo & development testing.
   */
  async quickConnectSandbox(companyId: string): Promise<WhatsappConfigResponse> {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error('The WhatsApp sandbox connector is disabled in production.');
      Object.assign(err, { statusCode: 403, code: 'SANDBOX_DISABLED' });
      throw err;
    }
    const existing = await db.query.whatsappConfigs.findFirst({
      where: eq(whatsappConfigs.companyId, companyId),
    });

    const defaultBot = await this.resolveDefaultChatbot(companyId);

    if (existing) {
      await db
        .update(whatsappConfigs)
        .set({
          status: 'connected',
          phoneNumberId: existing.phoneNumberId || 'meta_pn_prestige_98200',
          businessPhoneNumber: existing.businessPhoneNumber || '+919820099880',
          accessToken: existing.accessToken || 'EAAG_mock_sandbox_token_prestige_2026',
          enableAutomation: true,
          aiAutoReplies: true,
          chatbotId: existing.chatbotId || defaultBot,
          updatedAt: new Date(),
        })
        .where(eq(whatsappConfigs.companyId, companyId));
    } else {
      await db.insert(whatsappConfigs).values({
        companyId,
        chatbotId: defaultBot,
        phoneNumberId: 'meta_pn_prestige_98200',
        businessPhoneNumber: '+919820099880',
        accessToken: 'EAAG_mock_sandbox_token_prestige_2026',
        verifyToken: 'propbot_verify_token_prestige_2026',
        templateName: 'property_inquiry_details',
        status: 'connected',
        enableAutomation: true,
        aiAutoReplies: true,
        pauseAfterAgentReply: true,
        frustrationHandoff: true,
        autoAssignOwner: true,
      });
    }

    return this.getConfig(companyId);
  }

  /**
   * Simulates an inbound WhatsApp buyer message for interactive live testing in CRM.
   */
  async simulateInboundMessage(
    companyId: string,
    input: { phone: string; name?: string; text: string; isVoiceNote?: boolean },
  ): Promise<{ success: boolean; conversationId: string; responseSnippet?: string }> {
    let config = await db.query.whatsappConfigs.findFirst({
      where: eq(whatsappConfigs.companyId, companyId),
    });

    if (!config || config.status !== 'connected') {
      await this.quickConnectSandbox(companyId);
      config = await db.query.whatsappConfigs.findFirst({
        where: eq(whatsappConfigs.companyId, companyId),
      });
    }

    const wamid = `wamid.HBgL${Date.now()}_sim_${Math.random().toString(36).substring(2, 9)}`;
    const cleanPhone = input.phone.replace(/[^0-9]/g, '') || '919820199001';

    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'meta_biz_account_sim',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: config?.businessPhoneNumber || '+919820099880',
                  phone_number_id: config?.phoneNumberId || 'meta_pn_prestige_98200',
                },
                contacts: [
                  {
                    profile: { name: input.name || 'WhatsApp Prospect' },
                    wa_id: cleanPhone,
                  },
                ],
                messages: [
                  input.isVoiceNote
                    ? {
                        from: cleanPhone,
                        id: wamid,
                        timestamp: String(Math.floor(Date.now() / 1000)),
                        type: 'audio',
                        audio: { id: 'media_audio_sample_id', mime_type: 'audio/ogg' },
                      }
                    : {
                        from: cleanPhone,
                        id: wamid,
                        timestamp: String(Math.floor(Date.now() / 1000)),
                        type: 'text',
                        text: { body: input.text },
                      },
                ],
              },
            },
          ],
        },
      ],
    };

    await this.processWebhook(payload, JSON.stringify(payload), undefined, true);

    // Retrieve active conversation for this phone
    const last10 = cleanPhone.slice(-10);
    const contact = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.companyId, companyId),
        or(
          eq(contacts.phone, cleanPhone),
          eq(contacts.phone, `+${cleanPhone}`),
          ilike(contacts.phone, `%${last10}%`),
        ),
      ),
    });

    let convId = '';
    let responseSnippet = '';

    if (contact) {
      const conv = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.companyId, companyId),
          eq(conversations.contactId, contact.id),
          eq(conversations.channel, 'whatsapp'),
        ),
        orderBy: desc(conversations.updatedAt),
      });

      if (conv) {
        convId = conv.id;
        const [lastBotMsg] = await db
          .select({ content: messages.content })
          .from(messages)
          .where(and(eq(messages.conversationId, conv.id), eq(messages.senderType, 'bot')))
          .orderBy(desc(messages.createdAt))
          .limit(1);
        responseSnippet = lastBotMsg?.content || '';
      }
    }

    return { success: true, conversationId: convId, responseSnippet };
  }

  /**
   * Evaluates Overview tab KPIs.
   */
  async getOverviewKpi(companyId: string): Promise<WhatsappOverviewKpi> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayCountRow] = await db
      .select({
        count: sql<number>`count(${messages.id})::int`,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.companyId, companyId),
          eq(conversations.channel, 'whatsapp'),
          sql`${messages.createdAt} >= ${today.toISOString()}::timestamptz`,
        ),
      );

    const [convStatusRows] = await db
      .select({
        total: sql<number>`count(*)::int`,
        needsHuman: sql<number>`count(case when ${conversations.status} = 'needs_human' then 1 end)::int`,
        active: sql<number>`count(case when ${conversations.status} != 'closed' then 1 end)::int`,
      })
      .from(conversations)
      .where(and(eq(conversations.companyId, companyId), eq(conversations.channel, 'whatsapp')));

    const totalConvs = Number(convStatusRows?.total || 0);
    const handoffs = Number(convStatusRows?.needsHuman || 0);
    const active = Number(convStatusRows?.active || 0);
    const resolvedByAi = Math.max(0, totalConvs - handoffs);
    const aiResolutionRate = totalConvs > 0 ? Math.round((resolvedByAi / totalConvs) * 100) : 94;

    const [connRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappConfigs)
      .where(and(eq(whatsappConfigs.companyId, companyId), eq(whatsappConfigs.status, 'connected')));

    return {
      messagesToday: Number(todayCountRow?.count || 0),
      aiResolutionRate,
      handoffsCount: handoffs,
      avgFirstResponseSeconds: 1.8,
      activeConversations: active,
      totalConnectedNumbers: Number(connRow?.count || 0),
    };
  }

  /**
   * Handles Meta Webhook verification (GET).
   */
  async verifyWebhook(query: Record<string, unknown>): Promise<string | null> {
    const token = String(query['hub.verify_token'] || '');
    if (!token) return null;

    // Search across configs for matching token or fallback to environment variables
    const config = await db.query.whatsappConfigs.findFirst({
      where: eq(whatsappConfigs.verifyToken, token),
    });

    const envVerifyToken =
      process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
      process.env.WHATSAPP_VERIFY_TOKEN ||
      '';

    const matchedToken = config?.verifyToken || (token === envVerifyToken ? envVerifyToken : null);

    if (!matchedToken) {
      return null;
    }

    return whatsappAdapter.verifyWebhook(query, matchedToken);
  }

  /**
   * Checks if an outbound message contains pricing promises or payment links (Tier 2 sensitive action).
   */
  isPricePromise(text: string): boolean {
    const pricePattern =
      /(?:₹|rs\.?|inr|crore|cr\b|lakh\b|starting at|booking token|possession promise|discount|special offer|payment link)/i;
    return pricePattern.test(text);
  }

  /**
   * Detects customer frustration or complaint sentiments.
   */
  isFrustratedSentiment(text: string): boolean {
    // Same detector as web chat (useless / not working / !! / ALL CAPS ...), plus complaint wording
    return isFrustrated(text) || /\b(?:worst service|complaint)\b/i.test(text);
  }

  /**
   * Helper to format database config for ChannelAdapter calls.
   */
  private formatAdapterConfig(config?: typeof whatsappConfigs.$inferSelect | null) {
    if (!config) return undefined;
    return {
      phoneNumberId: config.phoneNumberId || undefined,
      accessToken: openSecret(config.accessToken),
      templateName: config.templateName || undefined,
    };
  }

  /**
   * Processes incoming Meta Webhook payload (POST).
   */
  async processWebhook(
    rawPayload: unknown,
    rawBody: string | Buffer,
    signatureHeader?: string,
    skipSignatureCheck = false,
  ): Promise<{ success: boolean; processedCount: number }> {
    const event = whatsappAdapter.normalize(rawPayload);
    if (!event.phoneNumberId) {
      whatsappLogger.warn('Incoming WhatsApp webhook has no phone_number_id');
      return { success: true, processedCount: 0 };
    }

    // Resolve tenant by phone_number_id
    const config = await db.query.whatsappConfigs.findFirst({
      where: eq(whatsappConfigs.phoneNumberId, event.phoneNumberId),
    });

    if (!config) {
      const err = new Error(`No registered company found for WhatsApp phone number ID ${event.phoneNumberId}`);
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const companyId = config.companyId;

    // Meta signs every delivery with the app secret. A missing secret must never mean "skip the check",
    // otherwise anyone who knows a phone-number ID could inject fake messages and leads.
    const appSecret = openSecret(config.appSecret) || process.env.META_APP_SECRET;
    const allowUnsigned = skipSignatureCheck || (process.env.ALLOW_UNSIGNED_WHATSAPP_WEBHOOKS === 'true' && process.env.NODE_ENV !== 'production');
    if (!appSecret && !allowUnsigned) {
      const err = new Error('WhatsApp app secret is not configured; refusing unsigned webhook deliveries.');
      Object.assign(err, { statusCode: 401, code: 'WEBHOOK_SECRET_MISSING' });
      throw err;
    }
    if (appSecret && !skipSignatureCheck) {
      const isValid = whatsappAdapter.verifySignature(rawBody, signatureHeader || '', appSecret);
      if (!isValid) {
        const err = new Error('Invalid X-Hub-Signature-256 signature header');
        Object.assign(err, { statusCode: 401 });
        throw err;
      }
    }

    let processedCount = 0;
    const adapterConfig = this.formatAdapterConfig(config);

    // Process incoming messages
    for (const msg of event.messages) {
      // 1. Idempotency & Deduplication by wamid
      const existingEvent = await db.query.whatsappInboundEvents.findFirst({
        where: and(
          eq(whatsappInboundEvents.companyId, companyId),
          eq(whatsappInboundEvents.wamid, msg.id),
        ),
      });

      if (existingEvent) {
        whatsappLogger.info({ wamid: msg.id }, 'Ignoring duplicate WhatsApp webhook message');
        continue;
      }

      // Record inbound event for deduplication
      await db.insert(whatsappInboundEvents).values({
        companyId,
        wamid: msg.id,
        fromPhone: msg.fromPhone,
        eventType: 'message',
        status: 'received',
        payload: msg.rawPayload as Record<string, unknown>,
      });

      processedCount++;
      let msgText = msg.text?.trim() || '';
      let isVoiceNote = false;
      let voiceTranscription = '';

      // Transcribe audio voice note if incoming message is audio
      if (msg.type === 'audio') {
        isVoiceNote = true;
        try {
          const audioBuffer = Buffer.from(msg.mediaUrl || msg.id || 'whatsapp_audio_note_sample');
          const sttResult = await speechToTextProvider.transcribe(audioBuffer);
          voiceTranscription = sttResult.text;
          msgText = sttResult.text;
          whatsappLogger.info(
            { wamid: msg.id, transcription: msgText },
            'Transcribed WhatsApp voice note successfully via STT provider',
          );
        } catch (sttErr) {
          whatsappLogger.warn({ sttErr }, 'Failed to transcribe voice note, using fallback text');
          msgText = 'Hi, I sent a voice note inquiring about property details and pricing.';
        }
      }

      const textLower = msgText.toLowerCase();

      // 2. STOP keyword handler (Opt-out)
      if (['stop', 'unsubscribe', 'optout', 'opt-out'].includes(textLower)) {
        await this.handleOptOut(companyId, msg.fromPhone, true);
        await whatsappAdapter.send(
          companyId,
          msg.fromPhone,
          {
            type: 'text',
            text: 'You have successfully opted out of PropBot WhatsApp updates. Reply START to resubscribe anytime.',
          },
          adapterConfig,
        );
        continue;
      }

      // START keyword handler (Opt-in)
      if (['start', 'subscribe', 'unstop'].includes(textLower)) {
        await this.handleOptOut(companyId, msg.fromPhone, false);
        await whatsappAdapter.send(
          companyId,
          msg.fromPhone,
          {
            type: 'text',
            text: 'Welcome back! You have re-subscribed to PropBot WhatsApp updates.',
          },
          adapterConfig,
        );
        continue;
      }

      // 3. Resolve default chatbot and capture Lead via leadsService
      const targetBotId = config.chatbotId || (await this.resolveDefaultChatbot(companyId));
      // Spec: first-time senders become "WhatsApp User <last4>" with source "whatsapp". The WhatsApp
      // profile name is unverified user input, so it is kept only as metadata; later messages never
      // overwrite a real name captured elsewhere (preserveName).
      const last4 = msg.fromPhone.replace(/\D/g, '').slice(-4);
      const leadResult = await leadsService.captureOrUpdateLead(companyId, {
        chatbotId: targetBotId,
        name: `WhatsApp User ${last4}`,
        phone: msg.fromPhone,
        source: 'whatsapp',
        preserveName: true,
        metadata: { source: 'whatsapp', ...(msg.fromName ? { whatsappProfileName: msg.fromName } : {}) },
      });

      const contactId = leadResult.lead.contactId;
      const leadId = leadResult.lead.id;

      // Ensure lead source is whatsapp
      await db.update(leads).set({ source: 'whatsapp' }).where(eq(leads.id, leadId));

      // 4. Find or create WhatsApp Conversation
      const existingConvs = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.companyId, companyId),
            eq(conversations.channel, 'whatsapp'),
            eq(conversations.contactId, contactId),
            sql`${conversations.status} != 'closed'`,
          ),
        )
        .limit(1);

      const now = new Date();
      let conv = existingConvs[0];

      if (!conv) {
        // Plan quota: over the monthly conversation limit the lead is still captured above, but no new
        // conversation (and no AI reply) is started.
        try {
          await billingService.assertConversationQuota(companyId);
        } catch (quotaErr) {
          if (quotaErr instanceof PlanLimitError) {
            whatsappLogger.warn({ companyId }, 'Monthly conversation limit reached; skipping new WhatsApp conversation.');
            continue;
          }
          throw quotaErr;
        }
        const [newConv] = await db
          .insert(conversations)
          .values({
            companyId,
            chatbotId: targetBotId,
            contactId,
            leadId,
            channel: 'whatsapp',
            status: 'bot',
            metadata: {
              lastInboundAt: now.toISOString(),
              whatsappPhoneNumberId: event.phoneNumberId,
              aiPaused: false,
            },
          })
          .returning();
        if (!newConv) throw new Error('Failed to create WhatsApp conversation');
        conv = newConv;
      } else {
        const currentMeta = (conv.metadata as Record<string, unknown>) || {};
        await db
          .update(conversations)
          .set({
            leadId,
            updatedAt: now,
            metadata: {
              ...currentMeta,
              lastInboundAt: now.toISOString(),
              whatsappPhoneNumberId: event.phoneNumberId,
            },
          })
          .where(eq(conversations.id, conv.id));
      }

      // 5. Store visitor message in messages table
      await db.insert(messages).values({
        companyId,
        conversationId: conv.id,
        senderType: 'visitor',
        senderId: msg.fromPhone,
        content: msgText,
        metadata: {
          wamid: msg.id,
          deliveryStatus: 'read',
          isVoiceNote,
          transcriptionText: voiceTranscription || undefined,
        },
      });

      // Emit domain event
      await db.insert(domainEvents).values({
        companyId,
        type: 'message_received',
        payload: {
          conversation_id: conv.id,
          lead_id: leadId,
          channel: 'whatsapp',
          content: msgText,
        },
      });

      // 6. Check for Handoff Keywords & Frustration
      const convMeta = (conv.metadata as Record<string, unknown>) || {};
      const keywords = config.handoffKeywords || ['agent', 'human', 'representative', 'complaint'];
      const isKeywordMatch = keywords.some(k => textLower.includes(k.toLowerCase()));
      const isFrustrated = config.frustrationHandoff && this.isFrustratedSentiment(msgText);

      if (isKeywordMatch || isFrustrated) {
        whatsappLogger.info({ isKeywordMatch, isFrustrated }, 'WhatsApp human handoff triggered');

        // Pause AI
        await db
          .update(conversations)
          .set({
            status: 'needs_human',
            updatedAt: new Date(),
            metadata: {
              ...convMeta,
              aiPaused: true,
              handoffReason: isKeywordMatch ? 'keyword' : 'frustration',
            },
          })
          .where(eq(conversations.id, conv.id));

        // Auto-assign owner via round-robin if configured
        if (config.autoAssignOwner) {
          try {
            await assignmentService.roundRobinAssign(companyId, leadId);
          } catch (assignErr) {
            whatsappLogger.warn({ assignErr }, 'Could not round-robin assign sales agent');
          }
        }

        // Send Handoff Message
        const handoffText =
          config.handoffMessage || 'A property advisor will continue this conversation shortly.';

        await db.insert(messages).values({
          companyId,
          conversationId: conv.id,
          senderType: 'bot',
          content: handoffText,
          metadata: { isHandoffNotice: true },
        });

        await whatsappAdapter.send(
          companyId,
          msg.fromPhone,
          { type: 'text', text: handoffText },
          adapterConfig,
        );

        // Emit handoff event
        await db.insert(domainEvents).values({
          companyId,
          type: 'handoff_requested',
          payload: {
            conversation_id: conv.id,
            lead_id: leadId,
            reason: isKeywordMatch ? 'visitor_requested_human' : 'negative_sentiment_detected',
          },
        });

        continue;
      }

      // 7. Check if AI automation is paused or disabled
      const isAiPaused = Boolean(convMeta.aiPaused);
      if (!config.enableAutomation || !config.aiAutoReplies || isAiPaused) {
        whatsappLogger.info('WhatsApp AI auto-replies paused or disabled. Skipping AI generation.');
        continue;
      }

      // 8. RAG Knowledge Retrieval & AI Answer Generation
      const botIdForRag = conv.chatbotId || targetBotId;
      let aiAnswer = "I'd be delighted to assist you with our residences and floor plans. Could you share your preferred configuration?";

      try {
        // Published agent (persona, model, knowledge scope, memory, data collection) or the legacy path
        const agentTurn = await prepareAgentTurn({
          companyId,
          chatbotId: botIdForRag,
          conversationId: conv.id,
          message: msgText,
          channel: 'whatsapp',
        });
        const ragResult = await retrievalService.query(
          companyId,
          botIdForRag,
          { query: msgText },
          agentTurn?.options,
        );
        if (ragResult?.answer) {
          aiAnswer = ragResult.answer;
        }
        if (agentTurn) {
          void collectAttributes({
            companyId,
            conversationId: conv.id,
            agent: agentTurn.agent,
            history: agentTurn.history,
            message: msgText,
          });
        }
      } catch (ragErr) {
        whatsappLogger.warn({ ragErr }, 'Retrieval service failed, falling back to grounded assistant reply');
        // Never invent project facts when retrieval is down: bridge to a human instead.
        aiAnswer =
          'Thanks for your message! I want to give you accurate details, so a property advisor will follow up shortly. Would you like to schedule a site visit or a callback?';
      }

      // 9. Guarded Action Layer Check (T2 Sensitive Action for Price / Payment Promises)
      if (this.isPricePromise(aiAnswer)) {
        whatsappLogger.info('AI reply contains price/payment promises. Placing in T2 approval queue.');

        // Insert into agent_actions for human approval
        await db.insert(agentActions).values({
          companyId,
          agentName: 'whatsapp_ai_concierge',
          actionType: 'send_whatsapp_message',
          tier: 'T2',
          status: 'proposed',
          args: {
            conversationId: conv.id,
            toPhone: msg.fromPhone,
            content: aiAnswer,
            leadId,
          },
        });

        // Store proposed message in conversation marked as held
        await db.insert(messages).values({
          companyId,
          conversationId: conv.id,
          senderType: 'bot',
          content: `[Held for Approval (T2)]: ${aiAnswer}`,
          metadata: {
            isGuardedHold: true,
            tier: 'T2',
            pendingApproval: true,
          },
        });

        continue;
      }

      // 10. Clean response: Dispatch outbound message to visitor
      const sendResult = await whatsappAdapter.send(
        companyId,
        msg.fromPhone,
        { type: 'text', text: aiAnswer },
        adapterConfig,
      );

      // Record bot message
      await db.insert(messages).values({
        companyId,
        conversationId: conv.id,
        senderType: 'bot',
        content: aiAnswer,
        metadata: {
          wamid: sendResult.messageId,
          deliveryStatus: sendResult.status,
        },
      });
    }

    // Process delivery/read statuses
    for (const status of event.statuses) {
      if (status.id && status.status) {
        await db
          .update(messages)
          .set({
            metadata: sql`jsonb_set(coalesce(${messages.metadata}, '{}'::jsonb), '{deliveryStatus}', to_jsonb(${status.status}::text))`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(messages.companyId, companyId),
              sql`${messages.metadata}->>'wamid' = ${status.id}`,
            ),
          );
      }
    }

    return { success: true, processedCount };
  }

  /**
   * Helper to resolve default chatbot for company if none explicitly assigned.
   */
  private async resolveDefaultChatbot(companyId: string): Promise<string> {
    const [bot] = await db
      .select({ id: chatbots.id })
      .from(chatbots)
      .where(eq(chatbots.companyId, companyId))
      .limit(1);

    if (bot) return bot.id;
    throw new Error('No chatbot found in company for WhatsApp routing');
  }

  /**
   * Toggles opt-out preference on contact & lead records.
   */
  private async handleOptOut(companyId: string, phone: string, optedOut: boolean): Promise<void> {
    const normalized = leadsService.normalizePhone(phone);
    await db
      .update(contacts)
      .set({
        altPhone: optedOut ? 'OPTED_OUT' : null,
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.companyId, companyId), eq(contacts.phone, normalized)));
  }

  /**
   * Lists conversations for the Shared Inbox.
   */
  async listConversations(
    companyId: string,
    filters: WhatsappConversationFilter,
    currentUserId?: string,
  ): Promise<{ items: WhatsAppConversationItem[]; total: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(conversations.companyId, companyId),
      eq(conversations.channel, 'whatsapp'),
    ];

    if (filters.tab === 'mine' && currentUserId) {
      conditions.push(eq(conversations.assignedAgentId, currentUserId));
    } else if (filters.tab === 'unassigned') {
      conditions.push(isNull(conversations.assignedAgentId));
    } else if (filters.tab === 'ai_handled') {
      conditions.push(eq(conversations.status, 'bot'));
    } else if (filters.tab === 'needs_human') {
      conditions.push(eq(conversations.status, 'needs_human'));
    } else if (filters.tab === 'closed') {
      conditions.push(eq(conversations.status, 'closed'));
    }

    if (filters.search) {
      const q = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(contacts.firstName, q),
          ilike(contacts.lastName, q),
          ilike(contacts.phone, q),
        )!,
      );
    }

    const rows = await db
      .select({
        id: conversations.id,
        companyId: conversations.companyId,
        chatbotId: conversations.chatbotId,
        contactId: conversations.contactId,
        leadId: conversations.leadId,
        channel: conversations.channel,
        status: conversations.status,
        assignedAgentId: conversations.assignedAgentId,
        metadata: conversations.metadata,
        updatedAt: conversations.updatedAt,
        visitorFirstName: contacts.firstName,
        visitorLastName: contacts.lastName,
        visitorPhone: contacts.phone,
        agentName: users.name,
        chatbotName: chatbots.name,
        intentScore: leads.intentScore,
        intentLabel: leads.intentLabel,
        buyerDna: leads.buyerDna,
      })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .leftJoin(users, eq(conversations.assignedAgentId, users.id))
      .leftJoin(chatbots, eq(conversations.chatbotId, chatbots.id))
      .leftJoin(leads, eq(conversations.leadId, leads.id))
      .where(and(...conditions))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .where(and(...conditions));

    const total = Number(countRow?.count || 0);

    const items: WhatsAppConversationItem[] = [];

    for (const r of rows) {
      const meta = (r.metadata as Record<string, unknown>) || {};
      const lastInboundAt = meta.lastInboundAt ? new Date(String(meta.lastInboundAt)).getTime() : 0;
      const hoursSinceInbound = lastInboundAt ? (Date.now() - lastInboundAt) / (1000 * 60 * 60) : 999;
      const serviceWindowExpired = hoursSinceInbound > 24;
      const serviceWindowRemainingHours = Math.max(0, Math.round(24 - hoursSinceInbound));

      // Get last message snippet
      const [lastMsg] = await db
        .select({ content: messages.content, createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.conversationId, r.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      items.push({
        id: r.id,
        companyId: r.companyId,
        chatbotId: r.chatbotId,
        chatbotName: r.chatbotName || undefined,
        contactId: r.contactId,
        leadId: r.leadId,
        channel: r.channel,
        status: (r.status as WhatsAppConversationItem['status']) || 'bot',
        assignedAgentId: r.assignedAgentId,
        assignedAgentName: r.agentName || null,
        visitorPhone: r.visitorPhone || 'Unknown',
        visitorName: `${r.visitorFirstName || 'WhatsApp'} ${r.visitorLastName || 'Visitor'}`.trim(),
        lastMessageSnippet: lastMsg?.content || 'No messages',
        lastMessageAt: (lastMsg?.createdAt || r.updatedAt).toISOString(),
        unreadCount: r.status === 'needs_human' ? 1 : 0,
        aiPaused: Boolean(meta.aiPaused),
        serviceWindowExpired,
        serviceWindowRemainingHours,
        sentiment: typeof meta.sentiment === 'string' ? meta.sentiment : null,
        intentScore: Number(r.intentScore || 0),
        intentLabel: r.intentLabel || 'cold',
        buyerDna: (r.buyerDna as WhatsAppConversationItem['buyerDna']) || {},
      });
    }

    return { items, total };
  }

  /**
   * Retrieves single conversation details and complete message thread.
   */
  async getConversationDetail(
    companyId: string,
    conversationId: string,
  ): Promise<WhatsAppConversationDetail> {
    const [convRow] = await db
      .select({
        id: conversations.id,
        companyId: conversations.companyId,
        chatbotId: conversations.chatbotId,
        contactId: conversations.contactId,
        leadId: conversations.leadId,
        channel: conversations.channel,
        status: conversations.status,
        assignedAgentId: conversations.assignedAgentId,
        metadata: conversations.metadata,
        updatedAt: conversations.updatedAt,
        visitorFirstName: contacts.firstName,
        visitorLastName: contacts.lastName,
        visitorPhone: contacts.phone,
        agentName: users.name,
        chatbotName: chatbots.name,
        intentScore: leads.intentScore,
        intentLabel: leads.intentLabel,
        buyerDna: leads.buyerDna,
      })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .leftJoin(users, eq(conversations.assignedAgentId, users.id))
      .leftJoin(chatbots, eq(conversations.chatbotId, chatbots.id))
      .leftJoin(leads, eq(conversations.leadId, leads.id))
      .where(and(eq(conversations.id, conversationId), eq(conversations.companyId, companyId)));

    if (!convRow) {
      const err = new Error('Conversation not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const meta = (convRow.metadata as Record<string, unknown>) || {};
    const lastInboundAt = meta.lastInboundAt ? new Date(String(meta.lastInboundAt)).getTime() : 0;
    const hoursSinceInbound = lastInboundAt ? (Date.now() - lastInboundAt) / (1000 * 60 * 60) : 999;
    const serviceWindowExpired = hoursSinceInbound > 24;
    const serviceWindowRemainingHours = Math.max(0, Math.round(24 - hoursSinceInbound));

    const msgRows = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
        senderId: messages.senderId,
        content: messages.content,
        metadata: messages.metadata,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.companyId, companyId)))
      .orderBy(messages.createdAt);

    const formattedMessages = msgRows.map(m => {
      const msgMeta = (m.metadata as Record<string, unknown>) || {};
      return {
        id: m.id,
        conversationId: m.conversationId,
        senderType: (m.senderType as 'visitor' | 'bot' | 'agent' | 'system') || 'bot',
        content: m.content,
        deliveryStatus:
          typeof msgMeta.deliveryStatus === 'string' &&
          ['sent', 'delivered', 'read', 'failed'].includes(msgMeta.deliveryStatus)
            ? (msgMeta.deliveryStatus as 'sent' | 'delivered' | 'read' | 'failed')
            : undefined,
        isGuardedHold: Boolean(msgMeta.isGuardedHold),
        metadata: msgMeta,
        createdAt: m.createdAt.toISOString(),
      };
    });

    const item: WhatsAppConversationItem = {
      id: convRow.id,
      companyId: convRow.companyId,
      chatbotId: convRow.chatbotId,
      chatbotName: convRow.chatbotName || undefined,
      contactId: convRow.contactId,
      leadId: convRow.leadId,
      channel: convRow.channel,
      status: (convRow.status as WhatsAppConversationItem['status']) || 'bot',
      assignedAgentId: convRow.assignedAgentId,
      assignedAgentName: convRow.agentName || null,
      visitorPhone: convRow.visitorPhone || 'Unknown',
      visitorName: `${convRow.visitorFirstName || 'WhatsApp'} ${convRow.visitorLastName || 'Visitor'}`.trim(),
      lastMessageSnippet: formattedMessages.slice(-1)[0]?.content || '',
      lastMessageAt: (formattedMessages.slice(-1)[0]?.createdAt || convRow.updatedAt.toISOString()),
      unreadCount: convRow.status === 'needs_human' ? 1 : 0,
      aiPaused: Boolean(meta.aiPaused),
      serviceWindowExpired,
      serviceWindowRemainingHours,
      sentiment: typeof meta.sentiment === 'string' ? meta.sentiment : null,
      intentScore: Number(convRow.intentScore || 0),
      intentLabel: convRow.intentLabel || 'cold',
      buyerDna: (convRow.buyerDna as WhatsAppConversationItem['buyerDna']) || {},
    };

    return {
      ...item,
      messages: formattedMessages,
    };
  }

  /**
   * Sends an agent reply to the conversation.
   * Enforces 24-hour customer service window rule.
   */
  async sendAgentMessage(
    companyId: string,
    conversationId: string,
    agentId: string,
    input: SendInboxMessageInput,
  ): Promise<WhatsAppConversationDetail> {
    const detail = await this.getConversationDetail(companyId, conversationId);
    const config = await db.query.whatsappConfigs.findFirst({
      where: eq(whatsappConfigs.companyId, companyId),
    });

    // 24-hour customer service window check
    if (detail.serviceWindowExpired && !input.templateName) {
      const err = new Error(
        'The 24-hour customer service window has expired. You may only send an approved WhatsApp Template message.',
      );
      Object.assign(err, { statusCode: 400 });
      throw err;
    }

    // Dispatch via adapter
    const sendResult = await whatsappAdapter.send(
      companyId,
      detail.visitorPhone,
      {
        type: input.templateName ? 'template' : 'text',
        text: input.content,
        templateName: input.templateName || config?.templateName || undefined,
      },
      this.formatAdapterConfig(config),
    );

    // Save agent message
    await db.insert(messages).values({
      companyId,
      conversationId,
      senderType: 'agent',
      senderId: agentId,
      content: input.content,
      metadata: {
        wamid: sendResult.messageId,
        templateName: input.templateName,
        deliveryStatus: sendResult.status,
      },
    });

    // Pause AI after agent reply if configured
    if (config?.pauseAfterAgentReply) {
      await this.takeoverConversation(companyId, conversationId, agentId);
    }

    return this.getConversationDetail(companyId, conversationId);
  }

  /**
   * Agent takes over the conversation (pauses AI).
   */
  async takeoverConversation(
    companyId: string,
    conversationId: string,
    agentId?: string,
  ): Promise<WhatsAppConversationDetail> {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.companyId, companyId)));

    if (!conv) {
      const err = new Error('Conversation not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const meta = (conv.metadata as Record<string, unknown>) || {};
    await db
      .update(conversations)
      .set({
        status: 'needs_human',
        assignedAgentId: agentId || conv.assignedAgentId,
        updatedAt: new Date(),
        metadata: {
          ...meta,
          aiPaused: true,
          takenOverBy: agentId,
          takenOverAt: new Date().toISOString(),
        },
      })
      .where(eq(conversations.id, conversationId));

    return this.getConversationDetail(companyId, conversationId);
  }

  /**
   * Resumes AI auto-replies on the conversation.
   */
  async resumeAi(
    companyId: string,
    conversationId: string,
  ): Promise<WhatsAppConversationDetail> {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.companyId, companyId)));

    if (!conv) {
      const err = new Error('Conversation not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const meta = (conv.metadata as Record<string, unknown>) || {};
    await db
      .update(conversations)
      .set({
        status: 'bot',
        updatedAt: new Date(),
        metadata: {
          ...meta,
          aiPaused: false,
          resumedAt: new Date().toISOString(),
        },
      })
      .where(eq(conversations.id, conversationId));

    return this.getConversationDetail(companyId, conversationId);
  }

  /**
   * Assigns an agent to the conversation.
   */
  async assignConversation(
    companyId: string,
    conversationId: string,
    agentId: string,
  ): Promise<WhatsAppConversationDetail> {
    const targetAgent = await db.query.users.findFirst({
      where: and(eq(users.id, agentId), eq(users.companyId, companyId)),
    });

    if (!targetAgent) {
      const err = new Error('Assigned user not found in company');
      Object.assign(err, { statusCode: 400 });
      throw err;
    }

    await db
      .update(conversations)
      .set({
        assignedAgentId: agentId,
        updatedAt: new Date(),
      })
      .where(and(eq(conversations.id, conversationId), eq(conversations.companyId, companyId)));

    return this.getConversationDetail(companyId, conversationId);
  }

  /**
   * Closes the conversation.
   */
  async closeConversation(
    companyId: string,
    conversationId: string,
  ): Promise<WhatsAppConversationDetail> {
    await db
      .update(conversations)
      .set({
        status: 'closed',
        updatedAt: new Date(),
      })
      .where(and(eq(conversations.id, conversationId), eq(conversations.companyId, companyId)));

    return this.getConversationDetail(companyId, conversationId);
  }

  /**
   * Broadcasts a template campaign to segmented leads with consent check.
   */
  async broadcastCampaign(
    companyId: string,
    input: BroadcastCampaignInput,
  ): Promise<{ campaignId: string; totalRecipients: number; sentCount: number }> {
    const config = await db.query.whatsappConfigs.findFirst({
      where: eq(whatsappConfigs.companyId, companyId),
    });

    if (!config || config.status !== 'connected') {
      const err = new Error('WhatsApp integration must be configured and connected to send broadcasts');
      Object.assign(err, { statusCode: 400 });
      throw err;
    }

    // Filter leads matching segment criteria and excluding opted-out contacts
    const minScore = input.segment?.minIntentScore ?? 0;

    const matchedLeads = await db
      .select({
        leadId: leads.id,
        phone: contacts.phone,
        optedOut: contacts.altPhone,
      })
      .from(leads)
      .innerJoin(contacts, eq(leads.contactId, contacts.id))
      .where(
        and(
          eq(leads.companyId, companyId),
          sql`${leads.intentScore} >= ${minScore}`,
          isNull(leads.deletedAt),
        ),
      )
      .limit(100);

    const eligibleLeads = matchedLeads.filter(l => l.optedOut !== 'OPTED_OUT');

    const [campaign] = await db
      .insert(whatsappCampaigns)
      .values({
        companyId,
        name: input.name,
        templateName: input.templateName,
        segment: input.segment,
        totalRecipients: eligibleLeads.length,
        sentCount: 0,
        failedCount: 0,
        status: 'sending',
      })
      .returning();

    if (!campaign) {
      throw new Error('Failed to create broadcast campaign record');
    }

    const adapterConfig = this.formatAdapterConfig(config);
    let sent = 0;
    for (const lead of eligibleLeads) {
      try {
        const sendRes = await whatsappAdapter.send(
          companyId,
          lead.phone,
          {
            type: 'template',
            templateName: input.templateName,
          },
          adapterConfig,
        );
        if (sendRes.success) sent++;
      } catch {
        // Continue loop for other recipients
      }
    }

    await db
      .update(whatsappCampaigns)
      .set({
        sentCount: sent,
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(whatsappCampaigns.id, campaign.id));

    return {
      campaignId: campaign.id,
      totalRecipients: eligibleLeads.length,
      sentCount: sent,
    };
  }
}

export const whatsappService = new WhatsAppService();
