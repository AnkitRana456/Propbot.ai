import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { eq, and, sql, desc, ne } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  chatbots,
  conversations,
  messages,
  leads,
  domainEvents,
} from '../../db/schema/index.js';
import { modelRouter, TaskTier } from '../ai/router.js';
import { retrievalService } from '../ai/retrieval.service.js';
import { leadsService } from '../leads/leads.service.js';
import { buyerDnaService } from '../leads/buyer-dna.service.js';
import type { BuyerDna } from '@propbot/shared';

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'propbot_pro_dev_jwt_access_secret_key_super_secure_32chars';

export interface PublicChatSessionPayload {
  conversationId: string;
  chatbotId: string;
  companyId: string;
  type: 'public_chat';
  sub: string;
}

export interface CreateSessionParams {
  publicKey: string;
  visitorId?: string;
  pageUrl?: string;
  referrer?: string;
  utmParams?: Record<string, unknown>;
  device?: Record<string, unknown>;
  origin?: string;
}

export interface SendMessageParams {
  token: string;
  conversationId: string;
  message: string;
  onChunk?: (chunk: string) => Promise<void> | void;
}

export interface CaptureLeadParams {
  token: string;
  conversationId: string;
  fullName: string;
  phone: string;
  email?: string;
  preferences?: Record<string, unknown>;
}

export class PublicChatService {
  verifySessionToken(token: string): PublicChatSessionPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as PublicChatSessionPayload;
      if (decoded.type !== 'public_chat') {
        const err = new Error('Invalid session token type');
        Object.assign(err, { statusCode: 401 });
        throw err;
      }
      return decoded;
    } catch {
      const err = new Error('Unauthorized or expired chat session token');
      Object.assign(err, { statusCode: 401 });
      throw err;
    }
  }

  async getPublicConfig(publicKey: string) {
    const [bot] = await db
      .select({
        id: chatbots.id,
        name: chatbots.name,
        type: chatbots.type,
        status: chatbots.status,
        config: chatbots.config,
        allowedDomains: chatbots.allowedDomains,
        companyId: chatbots.companyId,
      })
      .from(chatbots)
      .where(and(eq(chatbots.publicKey, publicKey), sql`${chatbots.deletedAt} IS NULL`));

    if (!bot) {
      const err = new Error('Chatbot not found or invalid public key');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    if (bot.status === 'paused') {
      const err = new Error('This chatbot assistant is currently paused');
      Object.assign(err, { statusCode: 403 });
      throw err;
    }

    const config = (bot.config as Record<string, unknown>) || {};
    const appearance = (config.appearance as Record<string, unknown>) || {};
    const behavior = (config.behavior as Record<string, unknown>) || {};

    return {
      chatbotId: bot.id,
      name: bot.name,
      botName: (appearance.botName as string) || bot.name,
      avatarUrl: appearance.botAvatarUrl as string | undefined,
      primaryColor: (appearance.primaryColor as string) || '#3b82f6',
      themeMode: (appearance.themeMode as 'light' | 'dark') || 'dark',
      greetingMessage: (behavior.greetingMessage as string) || 'Hello! Welcome to our property portal. How can I assist with your home search today?',
      quickQuestions: (behavior.quickQuestions as string[]) || [
        'What 2BHK and 3BHK configurations are available?',
        'Can I schedule a site visit this weekend?',
        'What are the current pricing and payment milestones?',
      ],
      aiConnected: modelRouter.isConfigured(),
    };
  }

  async createSession(params: CreateSessionParams) {
    const botConfig = await this.getPublicConfig(params.publicKey);

    const [bot] = await db
      .select({
        id: chatbots.id,
        companyId: chatbots.companyId,
        allowedDomains: chatbots.allowedDomains,
      })
      .from(chatbots)
      .where(eq(chatbots.id, botConfig.chatbotId));

    if (!bot) {
      const err = new Error('Chatbot not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    // CORS / Allowed domains check if configured
    if (bot.allowedDomains && bot.allowedDomains.length > 0 && params.origin) {
      const isAllowed = bot.allowedDomains.some(domain => {
        try {
          const originHost = new URL(params.origin!).hostname;
          return originHost === domain || originHost.endsWith(`.${domain}`);
        } catch {
          return false;
        }
      });
      if (!isAllowed) {
        const err = new Error(`Origin '${params.origin}' is not authorized for this chatbot.`);
        Object.assign(err, { statusCode: 403 });
        throw err;
      }
    }

    const visitorId = params.visitorId || `vis_${crypto.randomBytes(12).toString('hex')}`;

    // Look for active conversation with this visitorId
    let [conv] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.chatbotId, bot.id),
          sql`${conversations.metadata}->>'visitorId' = ${visitorId}`,
          ne(conversations.status, 'closed'),
        ),
      )
      .orderBy(desc(conversations.createdAt))
      .limit(1);

    let isNewSession = false;
    if (!conv) {
      isNewSession = true;
      const [newConv] = await db
        .insert(conversations)
        .values({
          companyId: bot.companyId,
          chatbotId: bot.id,
          channel: 'web',
          status: 'bot',
          metadata: {
            visitorId,
            pageUrl: params.pageUrl,
            referrer: params.referrer,
            utmParams: params.utmParams,
            device: params.device,
          },
        })
        .returning();
      conv = newConv!;
    }

    const sessionPayload: PublicChatSessionPayload = {
      conversationId: conv.id,
      chatbotId: bot.id,
      companyId: bot.companyId,
      type: 'public_chat',
      sub: visitorId,
    };

    const sessionToken = jwt.sign(sessionPayload, JWT_SECRET, { expiresIn: '24h' });

    return {
      sessionToken,
      conversationId: conv.id,
      chatbotId: bot.id,
      isNewSession,
      status: conv.status,
      config: botConfig,
    };
  }

  async sendMessage(params: SendMessageParams) {
    const session = this.verifySessionToken(params.token);
    if (session.conversationId !== params.conversationId) {
      const err = new Error('Conversation ID does not match session');
      Object.assign(err, { statusCode: 403 });
      throw err;
    }

    // Persist visitor query
    await db.insert(messages).values({
      companyId: session.companyId,
      conversationId: session.conversationId,
      senderType: 'visitor',
      content: params.message.trim(),
      metadata: {},
    });

    // Background Buyer DNA extraction from visitor message
    try {
      const extracted = buyerDnaService.extractWithRules(params.message);
      if (extracted.explicitFields && extracted.explicitFields.length > 0) {
        const [currentConv] = await db
          .select({ metadata: conversations.metadata, leadId: conversations.leadId })
          .from(conversations)
          .where(eq(conversations.id, session.conversationId));

        if (currentConv) {
          const meta = (currentConv.metadata as Record<string, unknown>) || {};
          const existingDna = (meta.buyerDna as Partial<BuyerDna>) || buyerDnaService.getDefaultDna();
          const merged = buyerDnaService.mergeDna(existingDna as BuyerDna, extracted, extracted.explicitFields);
          await db
            .update(conversations)
            .set({ metadata: { ...meta, buyerDna: merged }, updatedAt: new Date() })
            .where(eq(conversations.id, session.conversationId));

          if (currentConv.leadId) {
            void leadsService.processMessageAsync({
              companyId: session.companyId,
              chatbotId: session.chatbotId,
              conversationId: session.conversationId,
              message: params.message,
              senderType: 'visitor',
            }).catch(() => {});
          }
        }
      }
    } catch {
      // Non-blocking preference extraction
    }

    const isAiConfigured = modelRouter.isConfigured();
    const isMockAllowed =
      (process.env.ALLOW_OFFLINE_MOCK === 'true' || process.env.MOCK_PROVIDERS === 'true') &&
      process.env.NODE_ENV !== 'production';

    // If AI is not configured and offline mock is not allowed: FAIL LOUDLY with honest polite notice
    if (!isAiConfigured && !isMockAllowed) {
      const fallbackReply =
        'Thank you for reaching out! Our real estate AI assistant is currently offline for configuration. Please share your phone number or email, and our property advisor will contact you directly with verified project brochures and pricing.';

      if (params.onChunk) {
        const words = fallbackReply.split(' ');
        for (let i = 0; i < words.length; i += 3) {
          const chunk = words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : '');
          await params.onChunk(chunk);
        }
      }

      await db.insert(messages).values({
        companyId: session.companyId,
        conversationId: session.conversationId,
        senderType: 'bot',
        content: fallbackReply,
        metadata: { aiOffline: true },
      });

      return {
        reply: fallbackReply,
        citations: [],
        isGrounded: false,
        aiOffline: true,
      };
    }

    // Query RAG Retrieval Service
    const ragResponse = await retrievalService.query(session.companyId, session.chatbotId, {
      query: params.message,
    });

    let reply = ragResponse.answer;
    const citations = ragResponse.citations;
    const isGrounded = ragResponse.isGrounded;

    if (params.onChunk) {
      if (ragResponse.overrideApplied) {
        const words = ragResponse.answer.split(' ');
        for (let i = 0; i < words.length; i += 3) {
          const chunk = words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : '');
          await params.onChunk(chunk);
        }
      } else {
        const [bot] = await db
          .select({
            name: chatbots.name,
            config: chatbots.config,
          })
          .from(chatbots)
          .where(eq(chatbots.id, session.chatbotId));

        const botConfig = (bot?.config as {
          appearance?: { botName?: string };
          behavior?: { tone?: string };
        } | null) || {};
        const botName = botConfig.appearance?.botName || bot?.name || 'Property Advisor AI';
        const tone = botConfig.behavior?.tone || 'luxury';

        const systemPrompt = retrievalService.buildSystemPrompt(
          botName,
          tone,
          ragResponse.citations.map(c => ({
            content: c.snippet,
            sourceTitle: c.sourceTitle,
            sectionHeader: c.sectionHeader,
          })),
        );

        const result = await modelRouter.executeStream(
          {
            tier: TaskTier.STRONG,
            companyId: session.companyId,
            chatbotId: session.chatbotId,
            systemPrompt,
            userMessage: params.message,
            promptName: 'public_chat',
          },
          params.onChunk,
        );
        reply = result.text;
      }
    }

    await db.insert(messages).values({
      companyId: session.companyId,
      conversationId: session.conversationId,
      senderType: 'bot',
      content: reply,
      metadata: { citations },
    });

    return {
      reply,
      citations,
      isGrounded,
      aiOffline: false,
    };
  }

  async captureLead(params: CaptureLeadParams) {
    const session = this.verifySessionToken(params.token);
    if (session.conversationId !== params.conversationId) {
      const err = new Error('Conversation ID does not match session');
      Object.assign(err, { statusCode: 403 });
      throw err;
    }

    // 1. Recover any accumulated preferences from conversation metadata & messages
    let accumulatedDna: Partial<BuyerDna> = {};
    const [conv] = await db
      .select({ metadata: conversations.metadata })
      .from(conversations)
      .where(eq(conversations.id, session.conversationId));

    if (conv?.metadata) {
      const meta = conv.metadata as Record<string, unknown>;
      if (meta.buyerDna) {
        accumulatedDna = meta.buyerDna as Partial<BuyerDna>;
      }
    }

    // Check recent visitor messages in this conversation if DNA not yet populated
    if (!accumulatedDna.bhk && !accumulatedDna.budgetMax) {
      const pastMsgs = await db
        .select({ content: messages.content })
        .from(messages)
        .where(and(eq(messages.conversationId, session.conversationId), eq(messages.senderType, 'visitor')))
        .limit(10);

      for (const m of pastMsgs) {
        const extracted = buyerDnaService.extractWithRules(m.content);
        accumulatedDna = buyerDnaService.mergeDna(
          (accumulatedDna as BuyerDna) || buyerDnaService.getDefaultDna(),
          extracted,
          extracted.explicitFields,
        );
      }
    }

    // 2. Delegate to official leadsService.captureOrUpdateLead()
    const leadCaptureResult = await leadsService.captureOrUpdateLead(session.companyId, {
      name: params.fullName,
      phone: params.phone,
      email: params.email?.trim() || undefined,
      chatbotId: session.chatbotId,
      conversationId: session.conversationId,
      budget: accumulatedDna.budgetMax
        ? `₹${(accumulatedDna.budgetMax / 10000000).toFixed(2)} Cr`
        : (params.preferences?.budget as string | undefined),
      bhk: accumulatedDna.bhk?.[0] || (params.preferences?.bhk as string | undefined),
      location: accumulatedDna.localities?.[0] || (params.preferences?.location as string | undefined),
      timeline: accumulatedDna.timeline || undefined,
      purpose: accumulatedDna.purpose || undefined,
      metadata: params.preferences || {},
    });

    const lead = leadCaptureResult.lead;

    // 3. Merge full structured Buyer DNA if accumulated has extra fields
    if (Object.keys(accumulatedDna).length > 0) {
      const currentDna = (lead.buyerDna as BuyerDna) || buyerDnaService.getDefaultDna();
      const updatedDna = buyerDnaService.mergeDna(
        currentDna,
        accumulatedDna,
        accumulatedDna.explicitFields || [],
      );

      await db
        .update(leads)
        .set({ buyerDna: updatedDna, updatedAt: new Date() })
        .where(eq(leads.id, lead.id));
    }

    // 4. Ensure conversation links to contact and lead
    await db
      .update(conversations)
      .set({
        contactId: lead.contactId,
        leadId: lead.id,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, session.conversationId));

    // 5. Emit legacy lead.created event alongside standard lead_created
    await db.insert(domainEvents).values({
      companyId: session.companyId,
      type: 'lead.created',
      payload: {
        leadId: lead.id,
        contactId: lead.contactId,
        companyId: session.companyId,
        chatbotId: session.chatbotId,
        conversationId: session.conversationId,
        fullName: params.fullName,
        phone: lead.phone,
        email: params.email,
        source: 'web_widget',
      },
    });

    return {
      success: true,
      leadId: lead.id,
      contactId: lead.contactId,
      isDuplicate: leadCaptureResult.isDuplicate,
    };
  }

  async getHistory(token: string, conversationId: string) {
    const session = this.verifySessionToken(token);
    if (session.conversationId !== conversationId) {
      const err = new Error('Conversation ID does not match session');
      Object.assign(err, { statusCode: 403 });
      throw err;
    }

    const rows = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
        content: messages.content,
        createdAt: messages.createdAt,
        metadata: messages.metadata,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    return {
      conversationId,
      messages: rows,
    };
  }
}

export const publicChatService = new PublicChatService();
