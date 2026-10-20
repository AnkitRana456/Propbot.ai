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
  brochures,
  projects,
} from '../../db/schema/index.js';
import { modelRouter, TaskTier } from '../ai/router.js';
import { isFrustrated, DEFAULT_ESCALATION_MESSAGE } from '../ai/llm.js';
import { retrievalService } from '../ai/retrieval.service.js';
import { leadsService } from '../leads/leads.service.js';
import { billingService } from '../billing/billing.service.js';
import { loadMediaForMessage } from './media-loader.js';
import { prepareAgentTurn, collectAttributes, applyPendingAttributes } from '../agents/agent-chat.js';
import type { MediaItem } from './media-triggers.js';
import { buyerDnaService } from '../leads/buyer-dna.service.js';
import { otpService, resolveOtpSettings, OtpError, type OtpSettings } from '../leads/otp.service.js';
import { validatePhone, trackingConfigSchema, type BuyerDna } from '@propbot/shared';

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
  utmParams?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface BrochureDownloadParams {
  token: string;
  conversationId: string;
  brochureId: string;
  fullName?: string;
  phone?: string;
  email?: string;
  utmParams?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/** Keeps only string UTM values and caps their size (attribution is untrusted visitor input). */
export function sanitizeUtmParams(raw: unknown): Record<string, string> {
  const allowed = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_sub_source',
    'utm_agencypartner',
  ];
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object') {
    for (const key of allowed) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === 'string' && v.trim()) out[key] = v.trim().slice(0, 200);
    }
  }
  return out;
}

export interface LeadSettings {
  requireEmail: boolean;
  requireLeadCapture: boolean;
  otp: OtpSettings;
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
      // Parsed through the shared schema so malformed IDs are dropped, never forwarded to the widget.
      tracking: (() => {
        const parsed = trackingConfigSchema.safeParse((config.tracking as unknown) ?? {});
        return parsed.success ? parsed.data : trackingConfigSchema.parse({});
      })(),
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
      // Server-side plan enforcement: a brand-new conversation counts against the monthly quota
      await billingService.assertConversationQuota(bot.companyId);
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

  /**
   * Answers a visitor message and attaches any triggered media (highlight photos on the first message,
   * floor plans, master plan, location map). Media never blocks or fails the answer.
   */
  async sendMessage(params: SendMessageParams) {
    const result = await this.answerMessage(params);
    if ((result as { escalated?: boolean }).escalated) return { ...result, media: [] as MediaItem[] };

    let media: MediaItem[] = [];
    try {
      const session = this.verifySessionToken(params.token);
      media = await loadMediaForMessage({
        companyId: session.companyId,
        chatbotId: session.chatbotId,
        conversationId: session.conversationId,
        message: params.message,
      });
      if (media.length > 0) {
        // Keep media on the stored bot message so conversation history shows it too
        await db.execute(sql`
          UPDATE messages SET metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ media })}::jsonb
           WHERE id = (SELECT id FROM messages
                        WHERE conversation_id = ${session.conversationId}::uuid AND sender_type = 'bot'
                        ORDER BY created_at DESC LIMIT 1)`);
      }
    } catch {
      media = []; // media is a bonus: ignore lookup failures
    }
    return { ...result, media };
  }

  private async answerMessage(params: SendMessageParams) {
    const session = this.verifySessionToken(params.token);
    if (session.conversationId !== params.conversationId) {
      const err = new Error('Conversation ID does not match session');
      Object.assign(err, { statusCode: 403 });
      throw err;
    }

    // Frustration check (cheap local heuristics: "useless", "not working", !!, ALL CAPS ...)
    const frustrated = isFrustrated(params.message);

    // Persist visitor query
    await db.insert(messages).values({
      companyId: session.companyId,
      conversationId: session.conversationId,
      senderType: 'visitor',
      content: params.message.trim(),
      sentiment: frustrated ? 'frustrated' : null,
      metadata: {},
    });

    // A teammate took control in the inbox: store the visitor message, stay silent (the agent will answer)
    const [owner] = await db.select({ metadata: conversations.metadata }).from(conversations).where(eq(conversations.id, session.conversationId));
    if ((owner?.metadata as Record<string, unknown> | undefined)?.aiPaused === true) {
      return { reply: '', citations: [], isGrounded: false, aiOffline: false, escalated: true, humanHandling: true };
    }

    if (frustrated) {
      return this.escalateToHuman(session, params);
    }

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

    // A chatbot with a published agent uses the agent's persona, model, knowledge scope, conversation memory
    // and data-collection form. Chatbots without one keep the original behaviour untouched.
    const agentTurn = await prepareAgentTurn({
      companyId: session.companyId,
      chatbotId: session.chatbotId,
      conversationId: session.conversationId,
      message: params.message,
      channel: 'web',
      skipGeneration: Boolean(params.onChunk), // streaming generates once, below, instead of twice
    });

    // Query RAG Retrieval Service
    const ragResponse = await retrievalService.query(
      session.companyId,
      session.chatbotId,
      { query: params.message },
      agentTurn?.options,
    );

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
      } else if (agentTurn && ragResponse.systemPrompt) {
        const result = await modelRouter.executeStream(
          {
            tier: TaskTier.STRONG,
            companyId: session.companyId,
            chatbotId: session.chatbotId,
            systemPrompt: ragResponse.systemPrompt,
            userMessage: params.message,
            promptName: 'public_chat_agent',
            model: agentTurn.options.model,
            temperature: agentTurn.options.temperature,
            maxTokens: agentTurn.options.maxTokens,
            history: agentTurn.history,
            trace: agentTurn.options.trace,
          },
          params.onChunk,
        );
        reply = result.text;
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

    // The agent's form: pull attributes the visitor just stated onto the lead (or the conversation until a
    // lead exists). Runs after the reply is stored and is never awaited, so it cannot slow or break the answer.
    if (agentTurn) {
      void collectAttributes({
        companyId: session.companyId,
        conversationId: session.conversationId,
        agent: agentTurn.agent,
        history: agentTurn.history,
        message: params.message,
      });
    }

    return {
      reply,
      citations,
      isGrounded,
      aiOffline: false,
    };
  }

  /**
   * Human escalation: the conversation is flagged (status needs_human + metadata.escalation), a
   * handoff_requested event notifies the team, and the visitor gets an empathetic message instead of
   * an AI answer. The flag is what the dashboard / inbox filters on.
   */
  private async escalateToHuman(
    session: PublicChatSessionPayload,
    params: SendMessageParams,
  ) {
    const [conv] = await db
      .select({ metadata: conversations.metadata, status: conversations.status, leadId: conversations.leadId })
      .from(conversations)
      .where(eq(conversations.id, session.conversationId));
    const alreadyEscalated = conv?.status === 'needs_human';

    if (!alreadyEscalated) {
      await db
        .update(conversations)
        .set({
          status: 'needs_human',
          updatedAt: new Date(),
          metadata: {
            ...((conv?.metadata as Record<string, unknown>) || {}),
            escalation: {
              reason: 'frustrated',
              at: new Date().toISOString(),
              triggerMessage: params.message.trim().slice(0, 300),
            },
          },
        })
        .where(eq(conversations.id, session.conversationId));

      await db.insert(domainEvents).values({
        companyId: session.companyId,
        type: 'handoff_requested',
        payload: {
          conversation_id: session.conversationId,
          lead_id: conv?.leadId ?? null,
          chatbot_id: session.chatbotId,
          channel: 'web',
          reason: 'frustrated',
          summary: `Visitor sounds frustrated: "${params.message.trim().slice(0, 120)}"`,
        },
      });
    }

    const [bot] = await db
      .select({ config: chatbots.config })
      .from(chatbots)
      .where(eq(chatbots.id, session.chatbotId));
    const behavior = ((bot?.config as Record<string, unknown> | undefined)?.behavior ?? {}) as {
      escalationMessage?: string;
    };
    const reply = behavior.escalationMessage?.trim() || DEFAULT_ESCALATION_MESSAGE;

    if (params.onChunk) {
      const words = reply.split(' ');
      for (let i = 0; i < words.length; i += 3) {
        await params.onChunk(words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : ''));
      }
    }

    await db.insert(messages).values({
      companyId: session.companyId,
      conversationId: session.conversationId,
      senderType: 'bot',
      content: reply,
      metadata: { isEscalationNotice: true },
    });

    return { reply, citations: [], isGrounded: false, aiOffline: false, escalated: true };
  }

  /** Per-chatbot lead rules (requireEmail, brochure gating, OTP) from the chatbot's config JSON. */
  async getLeadSettings(chatbotId: string): Promise<LeadSettings> {
    const [bot] = await db
      .select({ config: chatbots.config })
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), sql`${chatbots.deletedAt} IS NULL`));
    const lc = ((bot?.config as Record<string, unknown> | undefined)?.leadCapture ?? {}) as Record<
      string,
      unknown
    >;
    return {
      requireEmail: lc.requireEmail === true,
      requireLeadCapture: lc.requireLeadCapture === true,
      otp: resolveOtpSettings(lc.otpSettings),
    };
  }

  private assertSessionConversation(params: { token: string; conversationId: string }) {
    const session = this.verifySessionToken(params.token);
    if (session.conversationId !== params.conversationId) {
      const err = new Error('Conversation ID does not match session');
      Object.assign(err, { statusCode: 403 });
      throw err;
    }
    return session;
  }

  async sendOtp(params: { token: string; conversationId: string; phone: string }) {
    const session = this.assertSessionConversation(params);
    const { otp } = await this.getLeadSettings(session.chatbotId);
    if (!otp.enabled) {
      throw new OtpError('OTP_DISABLED', 'Phone verification is not enabled for this assistant.', 400);
    }
    return otpService.sendOtp({
      companyId: session.companyId,
      chatbotId: session.chatbotId,
      phone: params.phone,
      settings: otp,
    });
  }

  async verifyOtp(params: { token: string; conversationId: string; phone: string; code: string }) {
    const session = this.assertSessionConversation(params);
    return otpService.verifyOtp({
      companyId: session.companyId,
      chatbotId: session.chatbotId,
      phone: params.phone,
      code: params.code,
    });
  }

  /**
   * Brochure download. When the chatbot has requireLeadCapture=true the file URL is released only
   * after a valid lead (name + phone + email) is captured; the lead is stored with
   * source "brochure_download", IP and user agent, and the chatbot counters are incremented atomically.
   */
  async downloadBrochure(params: BrochureDownloadParams) {
    const session = this.assertSessionConversation(params);
    const settings = await this.getLeadSettings(session.chatbotId);

    const [brochure] = await db
      .select({ id: brochures.id, fileUrl: brochures.fileUrl, isGated: brochures.isGated, title: brochures.title })
      .from(brochures)
      .innerJoin(projects, eq(projects.id, brochures.projectId))
      .where(and(eq(brochures.id, params.brochureId), eq(brochures.companyId, session.companyId)));
    if (!brochure) {
      throw Object.assign(new Error('Brochure not found.'), { statusCode: 404, code: 'NOT_FOUND' });
    }

    const gated = settings.requireLeadCapture || brochure.isGated;
    if (gated) {
      if (!params.fullName?.trim() || !params.phone?.trim() || !params.email?.trim()) {
        throw Object.assign(
          new Error('Please share your name, email and phone number to download the brochure.'),
          { statusCode: 403, code: 'LEAD_CAPTURE_REQUIRED' },
        );
      }
      await this.captureLead({
        token: params.token,
        conversationId: params.conversationId,
        fullName: params.fullName,
        phone: params.phone,
        email: params.email,
        utmParams: params.utmParams,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        source: 'brochure_download',
      });
    } else {
      await db
        .update(chatbots)
        .set({ brochureDownloads: sql`${chatbots.brochureDownloads} + 1` })
        .where(eq(chatbots.id, session.chatbotId));
    }

    await db
      .update(brochures)
      .set({ downloadCount: sql`${brochures.downloadCount} + 1` })
      .where(eq(brochures.id, brochure.id));

    return { downloadUrl: brochure.fileUrl, title: brochure.title };
  }

  async captureLead(params: CaptureLeadParams & { source?: string }) {
    const session = this.assertSessionConversation(params);
    const settings = await this.getLeadSettings(session.chatbotId);

    if (settings.requireEmail && !params.email?.trim()) {
      throw Object.assign(new Error('Email address is required.'), {
        statusCode: 400,
        code: 'EMAIL_REQUIRED',
      });
    }
    const phoneOk = validatePhone(params.phone);
    if (!phoneOk.valid || !phoneOk.e164) {
      throw Object.assign(new Error('Please enter a valid phone number.'), {
        statusCode: 400,
        code: 'INVALID_PHONE',
      });
    }
    let otpVerified = false;
    if (settings.otp.enabled) {
      otpVerified = await otpService.hasRecentVerification(session.companyId, session.chatbotId, phoneOk.e164);
      if (!otpVerified) {
        throw Object.assign(new Error('Please verify your phone number with the code we sent you.'), {
          statusCode: 403,
          code: 'OTP_REQUIRED',
        });
      }
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
    // UTM: explicit values from the widget win over those stored at session start.
    const sessionUtm = ((conv?.metadata as Record<string, unknown> | undefined)?.utmParams ?? {}) as unknown;
    const utmParams = { ...sanitizeUtmParams(sessionUtm), ...sanitizeUtmParams(params.utmParams) };

    const leadCaptureResult = await leadsService.captureOrUpdateLead(session.companyId, {
      utmParams,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent?.slice(0, 500),
      source: params.source,
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
    // Attributes gathered in chat before the visitor shared contact details now belong to the new lead
    await applyPendingAttributes(session.companyId, session.conversationId, lead.id, session.chatbotId);
    if (otpVerified) {
      await otpService.markLeadPhoneVerified(session.companyId, lead.id);
    }

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
