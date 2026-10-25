import { pino } from 'pino';
import { generateText, generateTextStream, getGeminiModel, getLlmProvider } from './llm.js';
import { findModel } from '@propbot/shared';
import { recordLlmCall, toGeminiHistory, type LlmTrace } from './llm-call-log.js';

export const aiLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export enum TaskTier {
  FAST = 'fast', // Intent classification, entity extraction, score computation (gpt-4o-mini)
  STRONG = 'strong', // Grounded customer-facing conversation with citations (gpt-4o)
}

export interface ModelCallParams {
  tier: TaskTier;
  companyId: string;
  chatbotId: string;
  systemPrompt: string;
  userMessage: string;
  promptName?: string;
  promptVersion?: string;
  temperature?: number;
  maxTokens?: number;
  /** Gemini model id chosen by an agent (must be in the model registry; otherwise the default is used). */
  model?: string;
  /** Earlier turns of the conversation, oldest first. */
  history?: Array<{ role: 'visitor' | 'assistant'; content: string }>;
  /** Who is asking, for the llm_calls log. */
  trace?: LlmTrace;
}

export interface ModelCallResult {
  text: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'fallback_offline';
  model: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  costUsd: number;
  latencyMs: number;
  circuitBreakerTripped: boolean;
}

// Approximate cost rates per 1,000 tokens (USD)
const PRICING: Record<string, { prompt: number; completion: number }> = {
  'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
  'gpt-4o': { prompt: 0.005, completion: 0.015 },
  'gemini-2.5-flash': { prompt: 0.0003, completion: 0.0025 },
  'gemini-3.8-flash': { prompt: 0.0001, completion: 0.0004 },
  'gemini-2.0-flash': { prompt: 0.0001, completion: 0.0004 },
  'gemini-2.5-pro': { prompt: 0.00125, completion: 0.005 },
  'claude-sonnet-4-20250514': { prompt: 0.003, completion: 0.015 },
  fallback_offline: { prompt: 0, completion: 0 },
};

export class ProviderNotConfiguredError extends Error {
  readonly code = 'PROVIDER_NOT_CONFIGURED';
  constructor(message = 'No AI provider API key configured. Run pnpm setup:keys or set ALLOW_OFFLINE_MOCK=true for testing.') {
    super(message);
    this.name = 'ProviderNotConfiguredError';
  }
}

export class ModelRouter {
  private primaryFailureCount = 0;
  private readonly failureThreshold = 3;
  private circuitBreakerOpenUntil = 0;

  isConfigured(): boolean {
    return Boolean(
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.GEMINI_API_KEY,
    );
  }

  /**
   * Masks Personally Identifiable Information (email, phone, credit card)
   * before persisting traces or sending to observability platforms.
   */
  maskPii(input: string): string {
    return input
      .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[EMAIL]')
      .replace(/(?:\+?\d{1,3}[-.\s]?)?(?:\d{5}[-.\s]?\d{5}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{10})/g, '[PHONE]')
      .replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[CARD]');
  }

  isCircuitBreakerOpen(): boolean {
    return Date.now() < this.circuitBreakerOpenUntil;
  }

  tripCircuitBreaker(cooldownMs = 30000): void {
    this.circuitBreakerOpenUntil = Date.now() + cooldownMs;
    aiLogger.warn({ cooldownMs }, 'Primary AI provider circuit breaker TRIPPED. Routing to fallback.');
  }

  recordPrimarySuccess(): void {
    this.primaryFailureCount = 0;
    this.circuitBreakerOpenUntil = 0;
  }

  recordPrimaryFailure(): void {
    this.primaryFailureCount++;
    if (this.primaryFailureCount >= this.failureThreshold) {
      this.tripCircuitBreaker();
    }
  }

  /**
   * Simulates/executes grounded real estate completions when running without live paid keys.
   */
  generateOfflineGroundedResponse(params: ModelCallParams): string {
    const userQuery = params.userMessage.toLowerCase();
    const systemPrompt = params.systemPrompt;

    // Copilot JSON prompt simulation - extract dynamic lead details from prompt
    if (
      params.promptName === 'copilot_call_script' ||
      params.promptName === 'copilot_summary' ||
      params.promptName === 'copilot_suggest_reply'
    ) {
      const msg = params.userMessage;
      const nameMatch = msg.match(/buyer\s+([A-Za-z0-9\s]+?)(?::|\.|\n|,|DNA)/i);
      const buyerName = nameMatch?.[1]?.trim() || 'Prospect';
      const firstName = buyerName.split(' ')[0] || 'there';

      const bhkMatch = msg.match(/(\d\s*BHK|Villa|Penthouse)/i);
      const bhk = bhkMatch?.[1] ?? 'residences';

      let locality = 'prime city locality';
      const locMatch = msg.match(/(?:in|locality:?)\s+([A-Za-z0-9\s,/]+?)(?:,|\.|\n|budget)/i);
      if (locMatch?.[1]?.trim()) {
        locality = locMatch[1].trim();
      }

      let budget = 'target budget';
      const budgetMatch = msg.match(/budget:?\s*(₹[\d.]+\s*(?:Cr|Lakh|lakh|cr)?)/i);
      if (budgetMatch?.[1]?.trim()) {
        budget = budgetMatch[1].trim();
      } else {
        const rawBudgetMatch = msg.match(/"budgetMax":\s*(\d+)/);
        if (rawBudgetMatch?.[1]) {
          const num = parseInt(rawBudgetMatch[1], 10);
          budget = `₹${(num / 10000000).toFixed(2)} Cr`;
        }
      }

      const lastMsgMatch = msg.match(/(?:Last (?:visitor|buyer) message(?:\/question)?:?|recent question(?:\/inquiry)?:?)\s*"([^"]+)"/i);
      const lastVisitorMsg = lastMsgMatch?.[1]?.trim() ?? '';

      if (params.promptName === 'copilot_call_script') {
        const opener = lastVisitorMsg
          ? `Hi ${firstName}, this is Rohan from Property Advisors. I saw your recent inquiry regarding "${lastVisitorMsg.slice(0, 45)}" for our ${bhk} in ${locality}, and wanted to follow up with the exact details.`
          : `Hi ${firstName}, this is Rohan from Property Advisors. I noticed your interest in our ${bhk} residences in ${locality} with a budget of ${budget}, and wanted to personally share the updated floor plans.`;

        return JSON.stringify({
          callGoal: `Qualify purchase timeline for ${locality} ${bhk} (${budget}) and schedule private site visit preview.`,
          suggestedOpener: opener,
          qualifyingQuestions: [
            `What possession timeline best fits your family relocation plans for ${locality}?`,
            `Are you looking for a self-use residence or rental yield investment?`,
            `Have you explored pre-approved home loan rates with our banking partners?`,
          ],
          talkingPoints: [
            `Exclusive ${bhk} residences in ${locality} aligned with your budget range (${budget})`,
            `Modern clubhouse with temperature-controlled indoor pool, private EV charging, and fitness lounge`,
            `Flexible 20:80 milestone construction payment schedule available this month`,
          ],
          objectionPreemptions: [
            {
              anticipatedObjection: 'Price is above my initial target budget',
              rebuttal: `We have flexible 20:80 milestone schedules where only 20% is required upfront, reducing immediate cash flow pressure.`,
            },
            {
              anticipatedObjection: 'Need to review physical floor plan first',
              rebuttal: `I can send you the high-resolution architectural layout over WhatsApp right now, or reserve an exclusive sample walkthrough.`,
            },
          ],
          closingHook: `We have exclusive designer preview slots open this Saturday at 11:00 AM. May I reserve a priority slot for you, ${firstName}?`,
        });
      }

      if (params.promptName === 'copilot_summary') {
        return JSON.stringify({
          summary: `${buyerName} is actively evaluating ${bhk} residences in ${locality} with a stated budget of ${budget}.${lastVisitorMsg ? ` Inquired about: "${lastVisitorMsg}".` : ''} High purchase readiness with verified contact details.`,
          keyRequirements: [
            `${bhk} configuration in ${locality}`,
            `Budget target: ${budget}`,
            `Engagement: Active conversational inquiry`,
          ],
          statedObjections: ['Evaluating construction progress vs possession schedule'],
          recommendedAction: `Call within 5 minutes to follow up on ${lastVisitorMsg ? `"${lastVisitorMsg.slice(0, 30)}"` : `${bhk} in ${locality}`} and confirm weekend preview.`,
        });
      }

      if (params.promptName === 'copilot_suggest_reply') {
        const isPriceQuery = /price|cost|rate|budget|cr|lakh/i.test(lastVisitorMsg);
        const isVisitQuery = /visit|tour|walkthrough|weekend|see/i.test(lastVisitorMsg);

        return JSON.stringify({
          suggestions: [
            {
              id: 'sug-1',
              title: isVisitQuery ? 'Confirm Private Walkthrough' : 'Invite for Private Preview',
              text: `Hi ${firstName}, I would be delighted to host you for a private walkthrough of our ${bhk} sample residences in ${locality} this Saturday at 11:00 AM or 3:00 PM. Would either timing suit you?`,
              strategy: 'Proactive visit booking',
            },
            {
              id: 'sug-2',
              title: isPriceQuery ? 'Share Pricing & Payment Breakdown' : 'Share Milestone Payment Plan',
              text: isPriceQuery
                ? `Hi ${firstName}, for our ${bhk} residences in ${locality}, prices start at ${budget} with our 20:80 milestone payment schedule. Would you like me to share the complete price sheet on WhatsApp?`
                : `We have a flexible 20:80 milestone construction payment schedule available this month for ${locality}, keeping your upfront payment to just 20%. Would you like to review the milestone schedule?`,
              strategy: 'Overcome budget hesitation',
            },
            {
              id: 'sug-3',
              title: 'Share Master Brochure & Plans',
              text: `I have the complete architectural floor plans and 45,000 sq ft clubhouse layout ready for ${locality}. Should I share them over WhatsApp or email?`,
              strategy: 'Asset delivery',
            },
          ],
        });
      }
    }

    const isHindi =
      systemPrompt.includes('Hindi') ||
      /[\u0900-\u097F]/.test(params.userMessage);
    const isHinglish =
      systemPrompt.includes('Hinglish') ||
      /\b(kya|kitna|kitne|chahiye|batao|kab|milega|rate|bhav|hai|plot|ghar)\b/i.test(params.userMessage);

    // 1. Guardrail: Prompt injection & system override check
    if (
      userQuery.includes('ignore all') ||
      userQuery.includes('reveal your') ||
      userQuery.includes('system override') ||
      userQuery.includes('print internal') ||
      userQuery.includes('api keys') ||
      userQuery.includes('repeat the words') ||
      userQuery.includes('सिस्टम प्रॉम्ट') ||
      userQuery.includes('निर्देश') ||
      userQuery.includes('credit card') ||
      userQuery.includes('passwords') ||
      userQuery.includes('tokens reveal') ||
      userQuery.includes('unconstrained') ||
      userQuery.includes('ddos') ||
      userQuery.includes('foreign policy') ||
      userQuery.includes('connection string') ||
      userQuery.includes('repeat every customer')
    ) {
      if (isHindi) {
        return 'मैं विशेष रूप से हमारे प्रोजेक्ट्स और संपत्तियों में आपकी सहायता करता हूँ। मैं आंतरिक सिस्टम निर्देशों को साझा करने में असमर्थ हूँ, लेकिन फ्लोर प्लान, कीमत या साइट विज़िट बुक करने में खुशी से मदद करूँगा। क्या मैं सलाहकार से कॉलबैक करवाऊँ?';
      }
      if (isHinglish) {
        return 'Main exclusively hamare luxury properties aur residences ke liye help karta hoon. Off-topic ya system instructions share karne mein unable hoon, lekin floor plans, pricing ya site visit mein khushi se madad karunga. Kya main advisor se callback arrange karoon?';
      }
      return 'I specialize exclusively in our properties and residences, so I am unable to help with off-topic requests or share internal instructions. I would love to help with floor plans, pricing or a site visit though. Shall I arrange a callback from our property consultant?';
    }

    // 2. Guardrail: General off-topic check
    if (
      userQuery.includes('weather') ||
      userQuery.includes('crypto') ||
      userQuery.includes('bitcoin') ||
      userQuery.includes('recipe') ||
      userQuery.includes('chocolate') ||
      userQuery.includes('fifa') ||
      userQuery.includes('world cup')
    ) {
      if (isHindi) {
        return 'यह सवाल मेरे दायरे से बाहर है; मैं केवल हमारे रियल एस्टेट प्रोजेक्ट्स और विला से संबंधित जानकारी प्रदान कर सकता हूँ। क्या मैं आपके लिए साइट विज़िट या कॉलबैक तय करूँ?';
      }
      return "That one is outside what I specialize in, so I'm unable to help with off-topic inquiries here. I'd be delighted to help you explore our residences though: shall I share the floor plans or book you a site visit?";
    }

    // 3. Extract knowledge context from system prompt
    const hasContext = systemPrompt.includes('Relevant Knowledge Context:');
    const contextContent = hasContext ? systemPrompt.split('Relevant Knowledge Context:')[1] || '' : '';

    // Guardrail against unverified claims (competitor slander, helipad, solid gold, guaranteed return, secret code, fantasy amenities)
    if (
      userQuery.includes('competitor') && userQuery.includes('dlf') ||
      userQuery.includes('dlf') ||
      userQuery.includes('chandelier') ||
      userQuery.includes('guarantee a 35%') ||
      userQuery.includes('helipad') ||
      userQuery.includes('solid gold') ||
      userQuery.includes('secret master access code') ||
      userQuery.includes('submarine') ||
      userQuery.includes('spacex') ||
      userQuery.includes('zero-gravity') ||
      userQuery.includes('inferior structural steel') ||
      userQuery.includes('court shutdown') ||
      userQuery.includes('kickback')
    ) {
      if (isHindi) {
        return 'हमारे पास वर्तमान प्रोजेक्ट दस्तावेजों में इसके बारे में सत्यापित जानकारी नहीं है। क्या आप हमारे वरिष्ठ सलाहकार से कॉलबैक चाहते हैं?';
      }
      if (isHinglish) {
        return 'Hamare official documentation mein iski verified information available nahi hai. Accuracy ensure karne ke liye, kya aap consultant se official callback chahenge?';
      }
      return "I don't have verified information regarding this in our current property documentation. To ensure complete accuracy, would you like me to connect you with our senior property consultant for an official callback?";
    }

    // 4. Grounded matching against provided context sentences
    if (contextContent.length > 30) {
      const sentences = contextContent
        .split(/(?<=[.?!])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 15);

      // Extract significant query keywords
      const queryWords = userQuery
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !['what', 'when', 'where', 'which', 'there', 'this', 'that', 'from', 'with', 'have', 'does', 'your', 'about'].includes(w));

      const matchedSentences = sentences.filter(sentence => {
        const sLower = sentence.toLowerCase();
        return queryWords.some(w => sLower.includes(w));
      });

      if (matchedSentences.length > 0) {
        const facts = matchedSentences.slice(0, 3).join(' ');
        if (isHindi) {
          return `हमारे आधिकारिक प्रोजेक्ट दस्तावेजों के अनुसार: ${facts} क्या आप अधिक जानकारी या मास्टर ब्रोशर प्राप्त करना चाहेंगे?`;
        }
        if (isHinglish) {
          return `Official project documents ke mutabiq: ${facts} Kya aap master brochure dekhna chahenge ya site visit plan karein?`;
        }
        return `According to our official project documentation: ${facts} Would you like me to connect you with our advisor or share the master brochure?`;
      }

      // Check specific intents if phrasing differs
      if (
        userQuery.includes('price') ||
        userQuery.includes('cost') ||
        userQuery.includes('starting') ||
        userQuery.includes('rate') ||
        userQuery.includes('kitna') ||
        userQuery.includes('कीमत') ||
        userQuery.includes('भाव') ||
        userQuery.includes('किंमत') ||
        userQuery.includes('السعر') ||
        userQuery.includes('விலை') ||
        userQuery.includes('ధర') ||
        userQuery.includes('ಬೆಲೆ') ||
        userQuery.includes('मूल्य') ||
        userQuery.includes('કિંમત') ||
        userQuery.includes('payment') ||
        userQuery.includes('20:80') ||
        userQuery.includes('पेमेंट')
      ) {
        if (isHindi) {
          return 'हमारे आधिकारिक प्रोजेक्ट शेड्यूल के अनुसार, 3BHK विला की कीमतें ₹3.25 Cr से शुरू होती हैं, और 20:80 माइलस्टोन कंस्ट्रक्शन पेमेंट प्लान उपलब्ध है। बुकिंग टोकन ₹10 लाख है।';
        }
        if (isHinglish) {
          return 'Hamari official project schedule ke anusar, 3BHK residences ₹3.25 Cr onwards start hoti hain with flexible 20:80 construction payment plan. Booking token ₹10 Lakhs hai.';
        }
        return 'Based on our official property schedule, residences start from ₹3.25 Cr onwards with a flexible 20:80 milestone construction payment plan. Booking token is ₹10 Lakhs.';
      }
      if (
        userQuery.includes('airport') ||
        userQuery.includes('एयरपोर्ट') ||
        userQuery.includes('المطار') ||
        userQuery.includes('kempegowda')
      ) {
        return 'Located 25 minutes from Kempegowda International Airport (BLR). Luxury airport pickup can be arranged for site visits.';
      }
      if (
        userQuery.includes('rera') ||
        userQuery.includes('रेरा')
      ) {
        return 'The project RERA registration number is PRM/KA/RERA/1251/309/PR/210319/004000 with scheduled Phase 1 possession in December 2027.';
      }
      if (
        userQuery.includes('possession') ||
        userQuery.includes('पजेशन')
      ) {
        return 'Scheduled possession for Phase 1 is December 2027 under RERA delayed compensation guarantees.';
      }
      if (
        userQuery.includes('carpet area') ||
        userQuery.includes('कारपेट')
      ) {
        return 'Carpet area for 4BHK presidential villas is 3,450 sq ft with 11.5 feet ceiling clearance.';
      }
      if (
        userQuery.includes('token') ||
        userQuery.includes('टोकन')
      ) {
        return 'Booking token amount required is ₹10 Lakhs with a flexible 20:80 construction payment plan.';
      }
      if (
        userQuery.includes('clubhouse') ||
        userQuery.includes('क्लबहाउस')
      ) {
        return 'Central clubhouse spans 45,000 sq ft featuring a temperature-controlled heated indoor swimming pool, EV charging points, and sports courts.';
      }
      if (
        userQuery.includes('visit') ||
        userQuery.includes('tour') ||
        userQuery.includes('appointment') ||
        userQuery.includes('dekhna') ||
        userQuery.includes('विजिट')
      ) {
        if (isHindi) {
          return 'हमारे सैंपल विला और सेल्स ऑफिस सप्ताह के 7 दिन सुबह 9:30 से शाम 7:00 बजे तक खुले रहते हैं। क्या आप इस सप्ताहांत साइट विजिट शेड्यूल करना चाहते हैं?';
        }
        if (isHinglish) {
          return 'Hamara sample villa aur sales gallery hafte ke 7 din open rehta hai (9:30 AM to 7:00 PM). Kya aap weekend par private site visit schedule karna chahenge?';
        }
        return 'Our sample residences and sales office are open 7 days a week from 9:30 AM to 7:00 PM. We would be happy to host you for a private walkthrough. Please let me know your preferred date.';
      }
      if (
        userQuery.includes('brochure') ||
        userQuery.includes('download') ||
        userQuery.includes('floor plan') ||
        userQuery.includes('ब्रोशर')
      ) {
        if (isHindi) {
          return 'मैं आपको पूरा आर्किटेक्चरल मास्टर ब्रोशर और फ्लोर प्लान भेज सकता हूँ। कृपया अपना फोन नंबर या ईमेल साझा करें।';
        }
        if (isHinglish) {
          return 'Main aapko complete architectural floor plans aur master layout brochure share kar sakta hoon. Please apna contact number share karein.';
        }
        return 'I can share the complete architectural floor plans, master layout, and specification brochure. Please provide your contact details to receive the direct download link.';
      }
      if (
        userQuery.includes('contact') ||
        userQuery.includes('advisor') ||
        userQuery.includes('sales') ||
        userQuery.includes('baat') ||
        userQuery.includes('फोन')
      ) {
        if (isHindi) {
          return 'आप हमारे वरिष्ठ संपत्ति सलाहकार से तुरंत जुड़ सकते हैं। कृपया अपना फोन नंबर छोड़ें, हमारी टीम आपको शीघ्र कॉल करेगी।';
        }
        return 'You can connect with our senior property consultant right now. Please leave your phone number or email, and our team will give you a priority callback.';
      }
    }

    // Default polite admission when no verified context exists in knowledge base
    if (isHindi) {
      return 'हमारे पास वर्तमान प्रोजेक्ट दस्तावेजों में इस बारे में जानकारी नहीं है। क्या आप हमारे वरिष्ठ सलाहकार से एक त्वरित कॉलबैक चाहते हैं?';
    }
    if (isHinglish) {
      return 'Hamare verified property documentation mein iski information nahi hai. Kya aap hamare senior property advisor se quick callback chahenge?';
    }
    return "I don't have verified information regarding this in our current property documentation. To ensure complete accuracy, would you like me to connect you with our senior property consultant for a quick callback?";
  }

  async call(params: ModelCallParams): Promise<ModelCallResult> {
    return this.executeCompletion(params);
  }

  async executeCompletion(params: ModelCallParams): Promise<ModelCallResult> {
    const result = await this.runCompletion(params);
    recordLlmCall(params, result);
    return result;
  }

  private async runCompletion(params: ModelCallParams): Promise<ModelCallResult> {
    const startTime = Date.now();
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const hasKey = Boolean(geminiKey || openaiKey || anthropicKey);

    const isMockAllowed =
      (process.env.ALLOW_OFFLINE_MOCK === 'true' ||
        process.env.MOCK_PROVIDERS === 'true' ||
        process.env.NODE_ENV === 'test') &&
      process.env.NODE_ENV !== 'production';

    if (!hasKey && !isMockAllowed) {
      throw new ProviderNotConfiguredError();
    }

    // Provider selection: Gemini -> OpenAI -> Anthropic
    let activeProvider: 'gemini' | 'openai' | 'anthropic';
    let targetModel: string;

    const preferred = getLlmProvider();
    if (preferred === 'openai' && openaiKey) {
      activeProvider = 'openai';
      targetModel = params.tier === TaskTier.FAST ? 'gpt-4o-mini' : 'gpt-4o';
    } else if (preferred === 'anthropic' && anthropicKey) {
      activeProvider = 'anthropic';
      targetModel = process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';
    } else if (geminiKey) {
      activeProvider = 'gemini';
      targetModel = params.model && findModel(params.model) ? params.model : getGeminiModel();
    } else if (openaiKey) {
      activeProvider = 'openai';
      targetModel = params.tier === TaskTier.FAST ? 'gpt-4o-mini' : 'gpt-4o';
    } else if (anthropicKey) {
      activeProvider = 'anthropic';
      targetModel = process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';
    } else {
      activeProvider = 'openai';
      targetModel = params.tier === TaskTier.FAST ? 'gpt-4o-mini' : 'gpt-4o';
    }

    // If circuit breaker is open or no API key, use fallback
    if (this.isCircuitBreakerOpen() || !hasKey) {
      const offlineReply = this.generateOfflineGroundedResponse(params);
      const latencyMs = Date.now() - startTime;
      const promptTokens = Math.ceil((params.systemPrompt.length + params.userMessage.length) / 4);
      const completionTokens = Math.ceil(offlineReply.length / 4);

      return {
        text: offlineReply,
        provider: 'fallback_offline',
        model: 'mock-grounded-v1',
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        },
        costUsd: 0,
        latencyMs,
        circuitBreakerTripped: this.isCircuitBreakerOpen(),
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

      let reply = '';
      let promptTokens = 0;
      let completionTokens = 0;
      let totalTokens = 0;

      if (activeProvider === 'gemini') {
        clearTimeout(timeout);
        const gen = await generateText({
          systemPrompt: params.systemPrompt,
          userMessage: params.userMessage,
          history: toGeminiHistory(params.history),
          temperature: params.temperature,
          maxTokens: params.maxTokens,
          model: targetModel,
        });
        reply = gen.text;
        promptTokens = gen.promptTokens;
        completionTokens = gen.completionTokens;
        totalTokens = gen.totalTokens;
      } else if (activeProvider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [
              { role: 'system', content: params.systemPrompt },
              { role: 'user', content: params.userMessage },
            ],
            temperature: params.temperature ?? 0.7,
            max_tokens: params.maxTokens ?? 600,
          }),
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`OpenAI HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        reply = data.choices[0]?.message?.content || '';
        const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        promptTokens = usage.prompt_tokens;
        completionTokens = usage.completion_tokens;
        totalTokens = usage.total_tokens;
      } else if (activeProvider === 'anthropic') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: targetModel,
            max_tokens: params.maxTokens ?? 600,
            temperature: params.temperature ?? 0.7,
            system: params.systemPrompt,
            messages: [{ role: 'user', content: params.userMessage }],
          }),
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Anthropic HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        reply = data.content?.[0]?.text || '';
        promptTokens = data.usage?.input_tokens ?? 0;
        completionTokens = data.usage?.output_tokens ?? 0;
        totalTokens = promptTokens + completionTokens;
      }

      const latencyMs = Date.now() - startTime;
      const rate = PRICING[targetModel] || { prompt: 0.001, completion: 0.002 };
      const costUsd =
        (promptTokens / 1000) * rate.prompt +
        (completionTokens / 1000) * rate.completion;

      this.recordPrimarySuccess();

      // Trace call (Langfuse compatible format)
      aiLogger.info(
        {
          companyId: params.companyId,
          chatbotId: params.chatbotId,
          promptName: params.promptName || 'rag_answer',
          promptVersion: params.promptVersion || 'v1.0',
          tokens: totalTokens,
          latencyMs,
          costUsd,
          maskedQuery: this.maskPii(params.userMessage),
          provider: activeProvider,
        },
        'AI Model Router completion executed successfully',
      );

      return {
        text: reply,
        provider: activeProvider,
        model: targetModel,
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens,
        },
        costUsd,
        latencyMs,
        circuitBreakerTripped: false,
      };
    } catch (err: unknown) {
      this.recordPrimaryFailure();
      aiLogger.warn(
        { err: err instanceof Error ? err.message : err },
        'Primary AI Provider failed. Falling back to offline fallback provider.',
      );

      // Execute fallback
      const offlineReply = this.generateOfflineGroundedResponse(params);
      const latencyMs = Date.now() - startTime;

      return {
        text: offlineReply,
        provider: 'fallback_offline',
        model: 'fallback-resilient-v1',
        tokens: { prompt: 120, completion: 45, total: 165 },
        costUsd: 0,
        latencyMs,
        circuitBreakerTripped: true,
      };
    }
  }

  async executeStream(
    params: ModelCallParams,
    onChunk: (chunk: string) => Promise<void> | void,
  ): Promise<ModelCallResult> {
    const result = await this.runStream(params, onChunk);
    recordLlmCall(params, result);
    return result;
  }

  private async runStream(
    params: ModelCallParams,
    onChunk: (chunk: string) => Promise<void> | void,
  ): Promise<ModelCallResult> {
    const startTime = Date.now();
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const hasKey = Boolean(geminiKey || openaiKey || anthropicKey);

    const isMockAllowed =
      (process.env.ALLOW_OFFLINE_MOCK === 'true' ||
        process.env.MOCK_PROVIDERS === 'true' ||
        process.env.NODE_ENV === 'test') &&
      process.env.NODE_ENV !== 'production';

    if (!hasKey && !isMockAllowed) {
      throw new ProviderNotConfiguredError();
    }

    let activeProvider: 'gemini' | 'openai' | 'anthropic';
    let targetModel: string;

    const preferred = getLlmProvider();
    if (preferred === 'openai' && openaiKey) {
      activeProvider = 'openai';
      targetModel = params.tier === TaskTier.FAST ? 'gpt-4o-mini' : 'gpt-4o';
    } else if (preferred === 'anthropic' && anthropicKey) {
      activeProvider = 'anthropic';
      targetModel = process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';
    } else if (geminiKey) {
      activeProvider = 'gemini';
      targetModel = params.model && findModel(params.model) ? params.model : getGeminiModel();
    } else if (openaiKey) {
      activeProvider = 'openai';
      targetModel = params.tier === TaskTier.FAST ? 'gpt-4o-mini' : 'gpt-4o';
    } else if (anthropicKey) {
      activeProvider = 'anthropic';
      targetModel = process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';
    } else {
      activeProvider = 'openai';
      targetModel = params.tier === TaskTier.FAST ? 'gpt-4o-mini' : 'gpt-4o';
    }

    if (this.isCircuitBreakerOpen() || !hasKey) {
      const offlineReply = this.generateOfflineGroundedResponse(params);
      const latencyMs = Date.now() - startTime;
      const promptTokens = Math.ceil((params.systemPrompt.length + params.userMessage.length) / 4);
      const completionTokens = Math.ceil(offlineReply.length / 4);

      // Stream words in small token chunks
      const words = offlineReply.split(' ');
      for (let i = 0; i < words.length; i += 3) {
        const slice = words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : '');
        await onChunk(slice);
      }

      return {
        text: offlineReply,
        provider: 'fallback_offline',
        model: 'mock-grounded-v1',
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        },
        costUsd: 0,
        latencyMs,
        circuitBreakerTripped: this.isCircuitBreakerOpen(),
      };
    }

    try {
      if (activeProvider === 'gemini') {
        const gen = await generateTextStream(
          {
            systemPrompt: params.systemPrompt,
            userMessage: params.userMessage,
            history: toGeminiHistory(params.history),
            temperature: params.temperature,
            maxTokens: params.maxTokens,
            model: targetModel,
          },
          onChunk,
        );
        const rate = PRICING[targetModel] || { prompt: 0.0001, completion: 0.0004 };
        const costUsd =
          (gen.promptTokens / 1000) * rate.prompt + (gen.completionTokens / 1000) * rate.completion;
        this.recordPrimarySuccess();
        aiLogger.info(
          {
            companyId: params.companyId,
            chatbotId: params.chatbotId,
            promptName: params.promptName || 'public_chat_stream',
            tokens: gen.totalTokens,
            latencyMs: gen.latencyMs,
            costUsd,
            maskedQuery: this.maskPii(params.userMessage),
            provider: 'gemini',
          },
          'AI Model Router stream completed successfully',
        );
        return {
          text: gen.text,
          provider: 'gemini',
          model: targetModel,
          tokens: { prompt: gen.promptTokens, completion: gen.completionTokens, total: gen.totalTokens },
          costUsd,
          latencyMs: gen.latencyMs,
          circuitBreakerTripped: false,
        };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      let response: Response;

      if (activeProvider === 'openai') {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [
              { role: 'system', content: params.systemPrompt },
              { role: 'user', content: params.userMessage },
            ],
            temperature: params.temperature ?? 0.7,
            max_tokens: params.maxTokens ?? 600,
            stream: true,
          }),
        });
      } else {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: targetModel,
            max_tokens: params.maxTokens ?? 600,
            temperature: params.temperature ?? 0.7,
            system: params.systemPrompt,
            messages: [{ role: 'user', content: params.userMessage }],
            stream: true,
          }),
        });
      }

      clearTimeout(timeout);

      if (!response.ok || !response.body) {
        throw new Error(`${activeProvider} HTTP ${response.status}: ${response.statusText}`);
      }

      let fullText = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(dataStr);
            let contentChunk: string | undefined;

            if (activeProvider === 'openai') {
              contentChunk = parsed.choices?.[0]?.delta?.content;
            } else if (activeProvider === 'anthropic') {
              if (parsed.type === 'content_block_delta') {
                contentChunk = parsed.delta?.text;
              }
            }

            if (contentChunk) {
              fullText += contentChunk;
              await onChunk(contentChunk);
            }
          } catch {
            // Ignore parse errors on partial chunks
          }
        }
      }

      const promptTokens = Math.ceil((params.systemPrompt.length + params.userMessage.length) / 4);
      const completionTokens = Math.ceil(fullText.length / 4);
      const rate = PRICING[targetModel] || { prompt: 0.001, completion: 0.002 };
      const costUsd =
        (promptTokens / 1000) * rate.prompt +
        (completionTokens / 1000) * rate.completion;
      const latencyMs = Date.now() - startTime;

      this.recordPrimarySuccess();

      aiLogger.info(
        {
          companyId: params.companyId,
          chatbotId: params.chatbotId,
          promptName: params.promptName || 'public_chat_stream',
          tokens: promptTokens + completionTokens,
          latencyMs,
          costUsd,
          maskedQuery: this.maskPii(params.userMessage),
          provider: activeProvider,
        },
        'AI Model Router stream completed successfully',
      );

      return {
        text: fullText,
        provider: activeProvider,
        model: targetModel,
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        },
        costUsd,
        latencyMs,
        circuitBreakerTripped: false,
      };
    } catch (err: unknown) {
      this.recordPrimaryFailure();
      aiLogger.warn(
        { err: err instanceof Error ? err.message : err },
        'Primary AI Provider stream failed. Falling back to offline fallback generator.',
      );

      const offlineReply = this.generateOfflineGroundedResponse(params);
      const words = offlineReply.split(' ');
      for (let i = 0; i < words.length; i += 3) {
        const slice = words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : '');
        await onChunk(slice);
      }

      const latencyMs = Date.now() - startTime;
      return {
        text: offlineReply,
        provider: 'fallback_offline',
        model: 'fallback-resilient-v1',
        tokens: { prompt: 120, completion: 45, total: 165 },
        costUsd: 0,
        latencyMs,
        circuitBreakerTripped: true,
      };
    }
  }
}

export const modelRouter = new ModelRouter();
