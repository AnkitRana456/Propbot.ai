import { eq, and, sql, desc, isNull, or, ilike } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  leads,
  contacts,
  conversations,
  messages,
  leadActivities,
  domainEvents,
  companyAiSettings,
  users,
  chatbots,
} from '../../db/schema/index.js';
import type {
  UpdateLeadInput,
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
import { normalizePhoneNumber, validatePhone } from '@propbot/shared';
import { buyerDnaService } from './buyer-dna.service.js';
import { intentScorerService, type ScoringSignalsInput } from './intent-scorer.service.js';
import { enrichTracking } from './tracking-enrichment.js';
import { handoffBriefService } from './handoff-brief.service.js';

/** True for a Postgres unique-constraint violation (SQLSTATE 23505), also when wrapped by Drizzle. */
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | undefined;
  return e?.code === '23505' || e?.cause?.code === '23505';
}

export class LeadsService {
  /**
   * Normalizes a phone number to E.164 using the shared validator (same rules as the widget and web app).
   * Invalid numbers are returned sanitized; use validatePhone() before relying on the result.
   */
  normalizePhone(rawPhone: string): string {
    return normalizePhoneNumber(rawPhone);
  }

  /**
   * Captures or updates a lead from conversational chat, brochure gating or explicit forms.
   *
   * Race-safe de-duplication: a person is one contact per company and one lead per contact per
   * chatbot, enforced by partial unique indexes. If two requests race, the loser hits the unique
   * index (SQLSTATE 23505), the transaction rolls back and the call is retried, finding the winner.
   * Returning visitors never create a second lead: name/phone/lastSeenAt are refreshed and
   * visit_count is incremented in SQL (visit_count = visit_count + 1), so concurrent updates are not lost.
   */
  async captureOrUpdateLead(
    companyId: string,
    input: CaptureLeadInput,
    attempt = 0,
  ): Promise<{ lead: LeadItemResponse; isDuplicate: boolean }> {
    let phoneCheck = validatePhone(input.phone);
    if (input.source === 'whatsapp') {
      // Meta delivers E.164 without the "+" and from any country, so interpret it as international and,
      // for countries outside our rule table, accept any well-formed E.164 number.
      const digits = input.phone.replace(/\D/g, '');
      phoneCheck = validatePhone(`+${digits}`);
      if (!phoneCheck.valid && /^[1-9]\d{7,14}$/.test(digits)) {
        phoneCheck = { valid: true, e164: `+${digits}` };
      }
    }
    if (!phoneCheck.valid || !phoneCheck.e164) {
      throw Object.assign(new Error('Please enter a valid phone number.'), {
        statusCode: 400,
        code: 'INVALID_PHONE',
        reason: phoneCheck.reason,
      });
    }

    try {
      const outcome = await this.upsertLead(companyId, input, phoneCheck.e164);
      const lead = await this.getLeadById(companyId, outcome.leadId);
      return { lead, isDuplicate: outcome.isDuplicate };
    } catch (err) {
      if (isUniqueViolation(err) && attempt < 3) {
        return this.captureOrUpdateLead(companyId, input, attempt + 1);
      }
      throw err;
    }
  }

  /**
   * Invalid-lead purge (spec section 3): conversations flagged as having a lead whose contact has no
   * valid phone lose that lead link (lead_id / contact_id cleared). Lead and contact rows are kept.
   * `companyId` scopes the run to one tenant; omit it for a platform-wide cron run.
   */
  async cleanupInvalidLeadLinks(companyId?: string): Promise<{ scanned: number; cleaned: number }> {
    const rows = await db
      .select({ id: conversations.id, phone: contacts.phone })
      .from(conversations)
      .leftJoin(contacts, eq(contacts.id, conversations.contactId))
      .where(
        and(
          sql`${conversations.leadId} IS NOT NULL`,
          companyId ? eq(conversations.companyId, companyId) : undefined,
        ),
      );

    const invalidIds = rows.filter(r => !r.phone || !validatePhone(r.phone).valid).map(r => r.id);
    for (let i = 0; i < invalidIds.length; i += 500) {
      const batch = invalidIds.slice(i, i + 500);
      await db
        .update(conversations)
        .set({ leadId: null, contactId: null, updatedAt: new Date() })
        .where(sql`${conversations.id} IN (${sql.join(batch.map(id => sql`${id}::uuid`), sql`, `)})`);
    }
    return { scanned: rows.length, cleaned: invalidIds.length };
  }

  private async upsertLead(
    companyId: string,
    input: CaptureLeadInput,
    normalizedPhone: string,
  ): Promise<{ leadId: string; isDuplicate: boolean }> {
    const email = input.email && input.email.trim() ? input.email.trim().toLowerCase() : null;
    const source = input.source ?? 'chat';
    const utm = input.utmParams ?? {};
    const tracking = enrichTracking(input.userAgent, input.ipAddress);
    const nameParts = input.name.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Prospective';
    const lastName = nameParts.slice(1).join(' ') || null;

    return await db.transaction(async tx => {
      // 1. Resolve the contact: phone match wins, otherwise email match.
      const phoneContact = await tx.query.contacts.findFirst({
        where: and(
          eq(contacts.companyId, companyId),
          eq(contacts.phone, normalizedPhone),
          isNull(contacts.deletedAt),
        ),
      });
      const emailContact = email
        ? await tx.query.contacts.findFirst({
            where: and(
              eq(contacts.companyId, companyId),
              sql`lower(${contacts.email}) = ${email}`,
              isNull(contacts.deletedAt),
            ),
          })
        : undefined;
      const existingContact = phoneContact ?? emailContact;

      // 2. Existing lead for this contact on this chatbot -> refresh instead of duplicating.
      if (existingContact) {
        const existingLead = await tx.query.leads.findFirst({
          where: and(
            eq(leads.companyId, companyId),
            eq(leads.contactId, existingContact.id),
            input.chatbotId ? eq(leads.chatbotId, input.chatbotId) : isNull(leads.chatbotId),
            isNull(leads.deletedAt),
          ),
        });

        if (existingLead) {
          const contactPatch: Partial<typeof contacts.$inferInsert> = {
            ...(input.preserveName ? {} : { firstName, lastName }),
            phone: normalizedPhone,
            updatedAt: new Date(),
          };
          // Only adopt the email when no other contact already owns it.
          if (email && !existingContact.email && (!emailContact || emailContact.id === existingContact.id)) {
            contactPatch.email = email;
          }
          // When matched by email only, the phone moves to the new number (no other contact has it).
          await tx.update(contacts).set(contactPatch).where(eq(contacts.id, existingContact.id));

          const mergeSuggestion = {
            existingContactId: existingContact.id,
            existingLeadId: existingLead.id,
            matchingField: phoneContact ? ('phone' as const) : ('email' as const),
            matchingValue: phoneContact ? normalizedPhone : (email as string),
            conflictFields: [
              input.name.trim() !== `${existingContact.firstName} ${existingContact.lastName || ''}`.trim()
                ? 'name'
                : '',
              email && existingContact.email && email !== existingContact.email.toLowerCase()
                ? 'email'
                : '',
            ].filter(Boolean),
            suggestedAction:
              'Merge recent inquiry details and updated preferences into primary lead record.',
          };

          await tx
            .update(leads)
            .set({
              visitCount: sql`${leads.visitCount} + 1`,
              lastSeenAt: new Date(),
              utmParams: Object.keys(utm).length
                ? sql`${leads.utmParams} || ${JSON.stringify(utm)}::jsonb`
                : leads.utmParams,
              ipAddress: input.ipAddress ?? existingLead.ipAddress,
              userAgent: input.userAgent ?? existingLead.userAgent,
              duplicateMergeSuggestion: mergeSuggestion,
              updatedAt: new Date(),
            })
            .where(eq(leads.id, existingLead.id));

          if (input.conversationId) {
            await tx
              .update(conversations)
              .set({ leadId: existingLead.id, contactId: existingContact.id, updatedAt: new Date() })
              .where(
                and(eq(conversations.id, input.conversationId), eq(conversations.companyId, companyId)),
              );
          }

          if (input.chatbotId && source === 'brochure_download') {
            await tx
              .update(chatbots)
              .set({ brochureDownloads: sql`${chatbots.brochureDownloads} + 1` })
              .where(eq(chatbots.id, input.chatbotId));
          }

          await tx.insert(leadActivities).values({
            companyId,
            leadId: existingLead.id,
            contactId: existingContact.id,
            activityType: 'duplicate_detected',
            title: 'Returning Visitor Re-submitted Contact Details',
            description: `Visitor with phone ${normalizedPhone} submitted again. Visit count incremented; merge suggestion created.`,
            metadata: { inputName: input.name, matchingField: mergeSuggestion.matchingField, source },
          });

          return { leadId: existingLead.id, isDuplicate: true };
        }
      }

      // 3. New lead (and new contact if needed)
      let contact = existingContact;
      if (!contact) {
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
        contact = newContact;
      }
      if (!contact) {
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

      const [newLead] = await tx
        .insert(leads)
        .values({
          companyId,
          contactId: contact.id,
          chatbotId: input.chatbotId,
          status: 'new',
          priority: scoringResult.priority,
          intentScore: scoringResult.score,
          intentLabel: scoringResult.label,
          scoreExplanation: scoringResult.topReasons,
          scoreHistory: [scoreHistoryItem],
          buyerDna: initialDna,
          phoneVerified: false,
          source,
          utmParams: utm,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          deviceType: tracking.deviceType,
          osName: tracking.osName,
          browserName: tracking.browserName,
          city: tracking.city,
          state: tracking.state,
          country: tracking.country,
          referrerUrl: input.referrerUrl ?? null,
          landingPage: input.landingPage ?? null,
          customFields: input.metadata ?? {},
        })
        .returning();

      if (!newLead) {
        throw new Error('Failed to create lead');
      }

      if (input.chatbotId) {
        await tx
          .update(chatbots)
          .set({
            totalLeads: sql`${chatbots.totalLeads} + 1`,
            ...(source === 'brochure_download'
              ? { brochureDownloads: sql`${chatbots.brochureDownloads} + 1` }
              : {}),
          })
          .where(eq(chatbots.id, input.chatbotId));
      }

      if (input.conversationId) {
        await tx
          .update(conversations)
          .set({ leadId: newLead.id, contactId: contact.id, updatedAt: new Date() })
          .where(
            and(eq(conversations.id, input.conversationId), eq(conversations.companyId, companyId)),
          );
      }

      await tx.insert(leadActivities).values({
        companyId,
        leadId: newLead.id,
        contactId: contact.id,
        activityType: 'lead_captured',
        title: source === 'brochure_download' ? 'Brochure Downloaded' : 'New Lead Captured via Web Chat',
        description: `Prospect ${input.name} shared contact details (${normalizedPhone}). Initial Intent Score: ${scoringResult.score}%.`,
        metadata: { source, initialScore: scoringResult.score },
      });

      await tx.insert(domainEvents).values({
        companyId,
        type: 'lead_created',
        payload: {
          lead_id: newLead.id,
          contact_id: contact.id,
          chatbot_id: input.chatbotId,
          source,
          metadata: { phone: normalizedPhone, name: input.name, utm_params: utm },
        },
      });

      return { leadId: newLead.id, isDuplicate: false };
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

    // 2. Detect signals across the full conversation history so score accumulates over time
    const allVisitorMessages = await db
      .select({ content: messages.content })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), sql`${messages.senderType} = 'visitor'`))
      .orderBy(desc(messages.createdAt))
      .limit(50);

    // Include current message even if not yet persisted to DB
    const actualMessageCount = allVisitorMessages.length + 1;
    const fullConversationText = [...allVisitorMessages.map(m => m.content), message].join(' ');

    const existingSignals: ScoringSignalsInput = {
      hasSharedPhone: Boolean(contact?.phone),
      isReturningVisitor: Boolean(isReturning),
      messageCount: actualMessageCount,
    };

    // Run signal detection over all visitor messages combined so signals persist across turns
    const detectedSignals = intentScorerService.detectSignalsFromText(fullConversationText, existingSignals);

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
        utmParams: (lead.utmParams as Record<string, unknown> | null) ?? null,
        ipAddress: lead.ipAddress ?? null,
        userAgent: lead.userAgent ?? null,
        deviceType: lead.deviceType ?? null,
        osName: lead.osName ?? null,
        browserName: lead.browserName ?? null,
        city: lead.city ?? null,
        state: lead.state ?? null,
        country: lead.country ?? null,
        referrerUrl: lead.referrerUrl ?? null,
        landingPage: lead.landingPage ?? null,
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
      utmParams: (row.utmParams as Record<string, unknown> | null) ?? null,
      ipAddress: row.ipAddress ?? null,
      userAgent: row.userAgent ?? null,
      deviceType: row.deviceType ?? null,
      osName: row.osName ?? null,
      browserName: row.browserName ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      country: row.country ?? null,
      referrerUrl: row.referrerUrl ?? null,
      landingPage: row.landingPage ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Inline edits from the leads grid: contact details, upper budget and the next follow-up.
   * Phone numbers are validated like every other entry point, and a number already used by another contact is a 409.
   */
  async updateLead(companyId: string, leadId: string, input: UpdateLeadInput): Promise<LeadItemResponse> {
    const existing = await db.query.leads.findFirst({ where: and(eq(leads.id, leadId), eq(leads.companyId, companyId), isNull(leads.deletedAt)) });
    if (!existing) throw new Error('Lead not found');

    const contactPatch: Partial<typeof contacts.$inferInsert> = {};
    if (input.name !== undefined) {
      const parts = input.name.trim().split(/\s+/);
      contactPatch.firstName = parts[0] || 'Prospective';
      contactPatch.lastName = parts.slice(1).join(' ') || null;
    }
    let phoneChanged = false;
    if (input.phone !== undefined) {
      const check = validatePhone(input.phone);
      if (!check.valid || !check.e164) {
        throw Object.assign(new Error('Please enter a valid phone number.'), { statusCode: 400, code: 'INVALID_PHONE', reason: check.reason });
      }
      contactPatch.phone = check.e164;
      phoneChanged = true;
    }
    if (input.email !== undefined) contactPatch.email = input.email ? input.email.trim().toLowerCase() : null;

    try {
      await db.transaction(async tx => {
        if (Object.keys(contactPatch).length > 0) {
          await tx.update(contacts).set({ ...contactPatch, updatedAt: new Date() }).where(and(eq(contacts.id, existing.contactId), eq(contacts.companyId, companyId)));
        }
        const leadPatch: Partial<typeof leads.$inferInsert> = { updatedAt: new Date() };
        if (phoneChanged) leadPatch.phoneVerified = false;
        if (input.nextFollowUpAt !== undefined) leadPatch.nextFollowUpAt = input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null;
        if (input.budgetMax !== undefined) {
          const dna = (existing.buyerDna as BuyerDna) ?? buyerDnaService.getDefaultDna();
          const explicit = new Set(dna.explicitFields ?? []);
          explicit.add('budgetMax');
          leadPatch.buyerDna = { ...dna, budgetMax: input.budgetMax, explicitFields: [...explicit] };
        }
        await tx.update(leads).set(leadPatch).where(eq(leads.id, leadId));
        await tx.insert(leadActivities).values({ companyId, leadId, contactId: existing.contactId, activityType: 'edit', title: 'Lead details edited', description: Object.keys(input).join(', '), metadata: { fields: Object.keys(input) } });
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw Object.assign(new Error('Another contact already uses that phone number or e-mail.'), { statusCode: 409, code: 'CONTACT_EXISTS' });
      }
      throw err;
    }
    return this.getLeadById(companyId, leadId);
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

  /**
   * Retrieves conversation transcript and messages for a lead.
   */
  async getLeadConversation(companyId: string, leadId: string): Promise<{
    conversationId: string | null;
    status: string | null;
    channel: string | null;
    messages: Array<{
      id: string;
      senderType: 'visitor' | 'bot' | 'agent' | 'system';
      content: string;
      createdAt: string;
      metadata: Record<string, unknown>;
    }>;
  }> {
    const lead = await db.query.leads.findFirst({
      where: and(eq(leads.id, leadId), eq(leads.companyId, companyId), isNull(leads.deletedAt)),
    });

    if (!lead) {
      const err = new Error('Lead not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const conv = await db.query.conversations.findFirst({
      where: and(eq(conversations.leadId, leadId), eq(conversations.companyId, companyId)),
      orderBy: desc(conversations.createdAt),
    });

    if (!conv) {
      return {
        conversationId: null,
        status: null,
        channel: null,
        messages: [],
      };
    }

    const rows = await db
      .select({
        id: messages.id,
        senderType: messages.senderType,
        content: messages.content,
        createdAt: messages.createdAt,
        metadata: messages.metadata,
      })
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(messages.createdAt);

    return {
      conversationId: conv.id,
      status: conv.status,
      channel: conv.channel,
      messages: rows.map(r => ({
        id: r.id,
        senderType: r.senderType as 'visitor' | 'bot' | 'agent' | 'system',
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        metadata: (r.metadata as Record<string, unknown>) || {},
      })),
    };
  }
}

export const leadsService = new LeadsService();
