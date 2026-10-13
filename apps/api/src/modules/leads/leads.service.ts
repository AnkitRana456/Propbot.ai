import { eq, and, sql, desc, isNull, or, ilike } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  leads,
  contacts,
  conversations,
  leadActivities,
  domainEvents,
  companyAiSettings,
  users,
} from '../../db/schema/index.js';
import type {
  BuyerDna,
  CaptureLeadInput,
  LeadItemResponse,
  LeadsListResponse,
  LeadStatus,
  LeadPriority,
  IntentLabel,
  HandoffBrief,
  DuplicateMergeSuggestion,
  ScoreHistoryItem,
  ScoringConfig,
} from '@propbot/shared';
import { buyerDnaService } from './buyer-dna.service.js';
import { intentScorerService, type ScoringSignalsInput } from './intent-scorer.service.js';
import { handoffBriefService } from './handoff-brief.service.js';

export class LeadsService {
  /**
   * Normalizes phone numbers supporting Indian (+91) and international E.164 formats.
   */
  normalizePhone(rawPhone: string): string {
    const cleaned = rawPhone.trim().replace(/[\s\-()]/g, '');
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    // Indian 10-digit format starting with 6, 7, 8, or 9
    if (/^[6-9]\d{9}$/.test(cleaned)) {
      return `+91${cleaned}`;
    }
    if (/^0[6-9]\d{9}$/.test(cleaned)) {
      return `+91${cleaned.slice(1)}`;
    }
    if (/^91[6-9]\d{9}$/.test(cleaned)) {
      return `+${cleaned}`;
    }
    return cleaned;
  }

  /**
   * Captures or updates a lead from conversational chat or explicit forms.
   * Enforces duplicate detection: duplicate phone creates a merge suggestion, not a second lead.
   */
  async captureOrUpdateLead(
    companyId: string,
    input: CaptureLeadInput,
  ): Promise<{ lead: LeadItemResponse; isDuplicate: boolean }> {
    const normalizedPhone = this.normalizePhone(input.phone);
    const email = input.email && input.email.trim() ? input.email.trim().toLowerCase() : null;

    // 1. Check for existing contact in this company
    const existingContact = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.companyId, companyId),
        or(
          eq(contacts.phone, normalizedPhone),
          email ? eq(contacts.email, email) : sql`false`,
        ),
        isNull(contacts.deletedAt),
      ),
    });

    if (existingContact) {
      // Find existing active lead for this contact
      const existingLead = await db.query.leads.findFirst({
        where: and(
          eq(leads.companyId, companyId),
          eq(leads.contactId, existingContact.id),
          isNull(leads.deletedAt),
        ),
      });

      if (existingLead) {
        // PDF Requirement: Duplicate phone creates a merge suggestion, not a second lead
        const mergeSuggestion = {
          existingContactId: existingContact.id,
          existingLeadId: existingLead.id,
          matchingField: 'phone' as const,
          matchingValue: normalizedPhone,
          conflictFields: [
            input.name !== `${existingContact.firstName} ${existingContact.lastName || ''}`.trim()
              ? 'name'
              : '',
            email && existingContact.email && email !== existingContact.email ? 'email' : '',
          ].filter(Boolean),
          suggestedAction:
            'Merge recent inquiry details and updated preferences into primary lead record.',
        };

        // Link current conversation if provided
        if (input.conversationId) {
          await db
            .update(conversations)
            .set({ leadId: existingLead.id, contactId: existingContact.id, updatedAt: new Date() })
            .where(
              and(eq(conversations.id, input.conversationId), eq(conversations.companyId, companyId)),
            );
        }

        // Record merge suggestion on existing lead
        await db
          .update(leads)
          .set({
            duplicateMergeSuggestion: mergeSuggestion,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, existingLead.id));

        // Activity log
        await db.insert(leadActivities).values({
          companyId,
          leadId: existingLead.id,
          contactId: existingContact.id,
          activityType: 'duplicate_detected',
          title: 'Duplicate Contact Attempted in Chat',
          description: `Visitor with phone ${normalizedPhone} submitted inquiry. Merge suggestion created.`,
          metadata: { inputName: input.name, matchingField: 'phone' },
        });

        const fullLead = await this.getLeadById(companyId, existingLead.id);
        return { lead: fullLead, isDuplicate: true };
      }
    }

    // 2. New Contact & Lead Creation inside transaction
    const nameParts = input.name.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Prospective';
    const lastName = nameParts.slice(1).join(' ') || null;

    return await db.transaction(async tx => {
      // Insert contact
      const [newContact] = await tx
        .insert(contacts)
        .values({
          companyId,
          firstName,
          lastName,
          phone: normalizedPhone,
          email,
          lifecycleStage: 'lead',
        })
        .returning();

      if (!newContact) {
        throw new Error('Failed to create contact');
      }

      // Seed initial Buyer DNA from explicit input fields
      const initialDna: BuyerDna = buyerDnaService.getDefaultDna();
      if (input.budget) {
        const ruleDna = buyerDnaService.extractWithRules(input.budget);
        if (ruleDna.budgetMin) initialDna.budgetMin = ruleDna.budgetMin;
        if (ruleDna.budgetMax) initialDna.budgetMax = ruleDna.budgetMax;
      }
      if (input.bhk) initialDna.bhk = [input.bhk];
      if (input.location) initialDna.localities = [input.location];
      if (input.purpose) initialDna.purpose = input.purpose;
      if (input.timeline) initialDna.timeline = input.timeline;
      if (input.loanNeed !== undefined) {
        initialDna.financing = input.loanNeed ? 'bank_loan' : 'self_funded';
      }

      // Calculate initial intent score
      const signals: ScoringSignalsInput = {
        hasSharedPhone: true,
        hasAskedPriceOrPaymentPlan: Boolean(input.budget),
        messageCount: 1,
      };
      const scoringResult = intentScorerService.calculateScore(signals);

      const scoreHistoryItem = {
        score: scoringResult.score,
        delta: scoringResult.score,
        reason: 'Contact information captured via conversational widget',
        timestamp: new Date().toISOString(),
      };

      // Insert lead
      const [newLead] = await tx
        .insert(leads)
        .values({
          companyId,
          contactId: newContact.id,
          chatbotId: input.chatbotId,
          status: 'new',
          priority: scoringResult.priority,
          intentScore: scoringResult.score,
          intentLabel: scoringResult.label,
          scoreExplanation: scoringResult.topReasons,
          scoreHistory: [scoreHistoryItem],
          buyerDna: initialDna,
          phoneVerified: false,
          source: 'chat',
          customFields: input.metadata ?? {},
        })
        .returning();

      if (!newLead) {
        throw new Error('Failed to create lead');
      }

      // Link conversation if supplied
      if (input.conversationId) {
        await tx
          .update(conversations)
          .set({ leadId: newLead.id, contactId: newContact.id, updatedAt: new Date() })
          .where(
            and(eq(conversations.id, input.conversationId), eq(conversations.companyId, companyId)),
          );
      }

      // Record lead activity
      await tx.insert(leadActivities).values({
        companyId,
        leadId: newLead.id,
        contactId: newContact.id,
        activityType: 'lead_captured',
        title: 'New Lead Captured via Web Chat',
        description: `Prospect ${input.name} shared contact details (${normalizedPhone}). Initial Intent Score: ${scoringResult.score}%.`,
        metadata: { source: 'chat', initialScore: scoringResult.score },
      });

      // Write domain_events transactional outbox
      await tx.insert(domainEvents).values({
        companyId,
        type: 'lead_created',
        payload: {
          lead_id: newLead.id,
          contact_id: newContact.id,
          chatbot_id: input.chatbotId,
          source: 'chat',
          metadata: { phone: normalizedPhone, name: input.name },
        },
      });

      const responseLead: LeadItemResponse = {
        id: newLead.id,
        companyId: newLead.companyId,
        contactId: newLead.contactId,
        chatbotId: newLead.chatbotId,
        conversationId: input.conversationId ?? null,
        assignedAgentId: newLead.assignedAgentId,
        assignedAgentName: null,
        name: input.name,
        firstName: newContact.firstName,
        lastName: newContact.lastName,
        phone: newContact.phone,
        email: newContact.email,
        status: newLead.status as LeadStatus,
        lostReason: newLead.lostReason,
        priority: newLead.priority as LeadPriority,
        intentScore: newLead.intentScore,
        intentLabel: newLead.intentLabel as IntentLabel,
        scoreExplanation: newLead.scoreExplanation as string[],
        scoreHistory: newLead.scoreHistory as ScoreHistoryItem[],
        buyerDna: newLead.buyerDna as BuyerDna,
        handoffBrief: null,
        duplicateMergeSuggestion: null,
        phoneVerified: newLead.phoneVerified,
        tags: (newLead.tags as string[]) || [],
        pageUrl: newLead.pageUrl,
        nextFollowUpAt: newLead.nextFollowUpAt ? newLead.nextFollowUpAt.toISOString() : null,
        source: newLead.source,
        slaStartedAt: null,
        slaBreachedAt: null,
        createdAt: newLead.createdAt.toISOString(),
        updatedAt: newLead.updatedAt.toISOString(),
      };

      return { lead: responseLead, isDuplicate: false };
    });
  }

  /**
   * Processes a new message asynchronously:
   * Updates Buyer DNA, re-calculates Intent Score, updates score history,
   * emits events, and generates AI Handoff Brief if score >= 70.
   */
  async processMessageAsync(params: {
    companyId: string;
    chatbotId: string;
    conversationId: string;
    message: string;
    senderType: string;
    isReturning?: boolean;
  }): Promise<void> {
    const { companyId, chatbotId, conversationId, message, senderType, isReturning } = params;

    if (senderType !== 'visitor') return;

    // Find conversation and linked lead
    const conversation = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, conversationId), eq(conversations.companyId, companyId)),
    });

    if (!conversation || !conversation.leadId) {
      return;
    }

    const lead = await db.query.leads.findFirst({
      where: and(eq(leads.id, conversation.leadId), eq(leads.companyId, companyId)),
    });

    if (!lead) return;

    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, lead.contactId),
    });

    const leadName = contact
      ? `${contact.firstName} ${contact.lastName || ''}`.trim()
      : 'Prospective Buyer';

    // 1. Update Buyer DNA
    const currentDna = (lead.buyerDna as BuyerDna) || buyerDnaService.getDefaultDna();
    const updatedDna = await buyerDnaService.extractFromMessage(
      companyId,
      chatbotId,
      message,
      currentDna,
    );

    // 2. Detect signals and compute new intent score
    const existingSignals: ScoringSignalsInput = {
      hasSharedPhone: Boolean(contact?.phone),
      isReturningVisitor: Boolean(isReturning),
      messageCount: 5, // Active session
    };

    const detectedSignals = intentScorerService.detectSignalsFromText(message, existingSignals);

    // Fetch company scoring config
    const aiSettings = await db.query.companyAiSettings.findFirst({
      where: eq(companyAiSettings.companyId, companyId),
    });
    const customConfig = (aiSettings?.scoringConfig as ScoringConfig) || undefined;

    const scoringResult = intentScorerService.calculateScore(detectedSignals, customConfig);

    const oldScore = lead.intentScore;
    const newScore = scoringResult.score;
    const delta = newScore - oldScore;

    const currentHistory = (lead.scoreHistory as ScoreHistoryItem[]) || [];
    let updatedHistory = currentHistory;

    // Record score history item if score changed
    if (delta !== 0) {
      updatedHistory = [
        ...currentHistory,
        {
          score: newScore,
          delta,
          reason: scoringResult.topReasons[0] || 'Message engagement update',
          timestamp: new Date().toISOString(),
        },
      ];
    }

    // 3. Persist updated lead state
    await db
      .update(leads)
      .set({
        buyerDna: updatedDna,
        intentScore: newScore,
        intentLabel: scoringResult.label,
        priority: scoringResult.priority,
        scoreExplanation: scoringResult.topReasons,
        scoreHistory: updatedHistory,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, lead.id));

    // 4. Emit intent_changed if change is material (delta >= 5 or crossed threshold)
    if (Math.abs(delta) >= 5 || scoringResult.label !== lead.intentLabel) {
      await db.insert(domainEvents).values({
        companyId,
        type: 'intent_changed',
        payload: {
          lead_id: lead.id,
          previous_score: oldScore,
          new_score: newScore,
          reasons: scoringResult.topReasons,
        },
      });

      await db.insert(leadActivities).values({
        companyId,
        leadId: lead.id,
        contactId: lead.contactId,
        activityType: 'intent_changed',
        title: `Intent Score Updated: ${oldScore}% ➜ ${newScore}% (${scoringResult.label.toUpperCase()})`,
        description: `Score changed by ${delta > 0 ? `+${delta}` : delta}%. Top reason: ${scoringResult.topReasons[0]}`,
        metadata: { oldScore, newScore, delta, reasons: scoringResult.topReasons },
      });
    }

    // 5. Trigger Hot Lead Alert & Brief if score crosses >= 70
    if (newScore >= 70 && oldScore < 70) {
      await handoffBriefService.generateBrief({
        companyId,
        chatbotId,
        leadId: lead.id,
        leadName,
        intentScore: newScore,
        buyerDna: updatedDna,
        assignedAgentId: lead.assignedAgentId,
      });
    }
  }

  /**
   * Retrieves paginated leads for a company with filters and search.
   */
  async listLeads(
    companyId: string,
    options: {
      status?: string;
      priority?: string;
      intentLabel?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<LeadsListResponse> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions = [eq(leads.companyId, companyId), isNull(leads.deletedAt)];

    if (options.status && options.status !== 'all') {
      conditions.push(eq(leads.status, options.status));
    }
    if (options.priority && options.priority !== 'all') {
      conditions.push(eq(leads.priority, options.priority));
    }
    if (options.intentLabel && options.intentLabel !== 'all') {
      conditions.push(eq(leads.intentLabel, options.intentLabel));
    }

    // Search query on name, phone, or email
    if (options.search && options.search.trim()) {
      const q = `%${options.search.trim()}%`;
      conditions.push(
        or(
          ilike(contacts.firstName, q),
          ilike(contacts.lastName, q),
          ilike(contacts.phone, q),
          ilike(contacts.email, q),
        )!,
      );
    }

    const whereClause = and(...conditions);

    // Count query
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .where(whereClause);

    const total = countRow?.count ?? 0;

    // Data query
    const rows = await db
      .select({
        lead: leads,
        contact: contacts,
        agent: users,
      })
      .from(leads)
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .leftJoin(users, eq(leads.assignedAgentId, users.id))
      .where(whereClause)
      .orderBy(desc(leads.createdAt))
      .limit(limit)
      .offset(offset);

    const items: LeadItemResponse[] = rows.map(({ lead, contact, agent }) => {
      const name = contact
        ? `${contact.firstName} ${contact.lastName || ''}`.trim()
        : 'Prospective Buyer';

      return {
        id: lead.id,
        companyId: lead.companyId,
        contactId: lead.contactId,
        chatbotId: lead.chatbotId,
        conversationId: null,
        assignedAgentId: lead.assignedAgentId,
        assignedAgentName: agent ? agent.name : null,
        name,
        firstName: contact?.firstName ?? 'Prospect',
        lastName: contact?.lastName ?? null,
        phone: contact?.phone ?? '—',
        email: contact?.email ?? null,
        status: lead.status as LeadStatus,
        lostReason: lead.lostReason,
        priority: lead.priority as LeadPriority,
        intentScore: lead.intentScore,
        intentLabel: lead.intentLabel as IntentLabel,
        scoreExplanation: (lead.scoreExplanation as string[]) || [],
        scoreHistory: (lead.scoreHistory as ScoreHistoryItem[]) || [],
        buyerDna: (lead.buyerDna as BuyerDna) || buyerDnaService.getDefaultDna(),
        handoffBrief: (lead.handoffBrief as HandoffBrief | null) || null,
        duplicateMergeSuggestion:
          (lead.duplicateMergeSuggestion as DuplicateMergeSuggestion | null) || null,
        phoneVerified: lead.phoneVerified,
        tags: (lead.tags as string[]) || [],
        pageUrl: lead.pageUrl,
        nextFollowUpAt: lead.nextFollowUpAt ? lead.nextFollowUpAt.toISOString() : null,
        source: lead.source,
        slaStartedAt: lead.slaStartedAt ? lead.slaStartedAt.toISOString() : null,
        slaBreachedAt: lead.slaBreachedAt ? lead.slaBreachedAt.toISOString() : null,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves single lead by ID with complete details.
   */
  async getLeadById(companyId: string, leadId: string): Promise<LeadItemResponse> {
    const row = await db.query.leads.findFirst({
      where: and(eq(leads.id, leadId), eq(leads.companyId, companyId), isNull(leads.deletedAt)),
    });

    if (!row) {
      throw new Error('Lead not found');
    }

    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, row.contactId),
    });

    let agentName: string | null = null;
    if (row.assignedAgentId) {
      const agent = await db.query.users.findFirst({
        where: eq(users.id, row.assignedAgentId),
      });
      agentName = agent ? agent.name : null;
    }

    const name = contact
      ? `${contact.firstName} ${contact.lastName || ''}`.trim()
      : 'Prospective Buyer';

    return {
      id: row.id,
      companyId: row.companyId,
      contactId: row.contactId,
      chatbotId: row.chatbotId,
      conversationId: null,
      assignedAgentId: row.assignedAgentId,
      assignedAgentName: agentName,
      name,
      firstName: contact?.firstName ?? 'Prospect',
      lastName: contact?.lastName ?? null,
      phone: contact?.phone ?? '—',
      email: contact?.email ?? null,
      status: row.status as LeadStatus,
      lostReason: row.lostReason,
      priority: row.priority as LeadPriority,
      intentScore: row.intentScore,
      intentLabel: row.intentLabel as IntentLabel,
      scoreExplanation: (row.scoreExplanation as string[]) || [],
      scoreHistory: (row.scoreHistory as ScoreHistoryItem[]) || [],
      buyerDna: (row.buyerDna as BuyerDna) || buyerDnaService.getDefaultDna(),
      handoffBrief: (row.handoffBrief as HandoffBrief | null) || null,
      duplicateMergeSuggestion:
        (row.duplicateMergeSuggestion as DuplicateMergeSuggestion | null) || null,
      phoneVerified: row.phoneVerified,
      tags: (row.tags as string[]) || [],
      pageUrl: row.pageUrl,
      nextFollowUpAt: row.nextFollowUpAt ? row.nextFollowUpAt.toISOString() : null,
      source: row.source,
      slaStartedAt: row.slaStartedAt ? row.slaStartedAt.toISOString() : null,
      slaBreachedAt: row.slaBreachedAt ? row.slaBreachedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Updates lead stage status and emits lead_status_changed event.
   */
  async updateLeadStatus(
    companyId: string,
    leadId: string,
    status: LeadStatus,
    lostReason?: string,
  ): Promise<LeadItemResponse> {
    const existing = await this.getLeadById(companyId, leadId);

    await db
      .update(leads)
      .set({
        status,
        lostReason: lostReason ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(leads.id, leadId), eq(leads.companyId, companyId)));

    await db.insert(domainEvents).values({
      companyId,
      type: 'lead_status_changed',
      payload: {
        lead_id: leadId,
        previous_status: existing.status,
        new_status: status,
        reason: lostReason,
      },
    });

    await db.insert(leadActivities).values({
      companyId,
      leadId,
      contactId: existing.contactId,
      activityType: 'status_changed',
      title: `Lead Status Changed to ${status.toUpperCase()}`,
      description: lostReason ? `Reason: ${lostReason}` : undefined,
      metadata: { previousStatus: existing.status, newStatus: status },
    });

    return this.getLeadById(companyId, leadId);
  }

  /**
   * Merges a duplicate lead into a primary target lead.
   */
  async mergeLeads(
    companyId: string,
    sourceLeadId: string,
    targetLeadId: string,
  ): Promise<LeadItemResponse> {
    const sourceLead = await this.getLeadById(companyId, sourceLeadId);
    const targetLead = await this.getLeadById(companyId, targetLeadId);

    // Merge Buyer DNA
    const mergedDna = buyerDnaService.mergeDna(
      targetLead.buyerDna,
      sourceLead.buyerDna,
      sourceLead.buyerDna.explicitFields,
    );

    await db.transaction(async tx => {
      // Clear duplicate merge suggestion and save merged DNA on target
      await tx
        .update(leads)
        .set({
          buyerDna: mergedDna,
          duplicateMergeSuggestion: null,
          intentScore: Math.max(targetLead.intentScore, sourceLead.intentScore),
          updatedAt: new Date(),
        })
        .where(and(eq(leads.id, targetLeadId), eq(leads.companyId, companyId)));

      // Re-point conversations from source to target
      await tx
        .update(conversations)
        .set({ leadId: targetLeadId })
        .where(and(eq(conversations.leadId, sourceLeadId), eq(conversations.companyId, companyId)));

      // Soft delete source lead
      await tx
        .update(leads)
        .set({ deletedAt: new Date() })
        .where(and(eq(leads.id, sourceLeadId), eq(leads.companyId, companyId)));

      // Record activity
      await tx.insert(leadActivities).values({
        companyId,
        leadId: targetLeadId,
        contactId: targetLead.contactId,
        activityType: 'lead_merged',
        title: 'Duplicate Lead Merged',
        description: `Merged conversation records and preferences from duplicate lead ${sourceLeadId}.`,
        metadata: { sourceLeadId, targetLeadId },
      });
    });

    return this.getLeadById(companyId, targetLeadId);
  }

  /**
   * Gets company scoring config.
   */
  async getScoringConfig(companyId: string): Promise<ScoringConfig> {
    const settings = await db.query.companyAiSettings.findFirst({
      where: eq(companyAiSettings.companyId, companyId),
    });

    const defaultCfg = {
      thresholds: { coldMax: 34, warmMin: 35, warmMax: 69, hotMin: 70 },
      weights: {
        requestedSiteVisit: 25,
        sharedPhone: 20,
        askedPricePaymentPlan: 15,
        budgetFitInventory: 15,
        urgencyWords: 15,
        viewedShortlistRoom: 15,
        askedPossessionDate: 10,
        returnedToChat: 10,
        messagesDepth5: 5,
        messagesDepth10: 5,
        sentimentPositive: 5,
        timeOnPage: 5,
        brokerCasualDeduction: -25,
      },
    };

    const raw = settings?.scoringConfig as Record<string, unknown> | null | undefined;
    if (!raw || typeof raw !== 'object' || !('thresholds' in raw) || !('weights' in raw)) {
      return defaultCfg;
    }

    return raw as unknown as ScoringConfig;
  }

  /**
   * Updates company scoring config.
   */
  async updateScoringConfig(companyId: string, config: ScoringConfig): Promise<ScoringConfig> {
    await db
      .insert(companyAiSettings)
      .values({
        companyId,
        scoringConfig: config,
      })
      .onConflictDoUpdate({
        target: companyAiSettings.companyId,
        set: {
          scoringConfig: config,
          updatedAt: new Date(),
        },
      });

    return this.getScoringConfig(companyId);
  }
}

export const leadsService = new LeadsService();
