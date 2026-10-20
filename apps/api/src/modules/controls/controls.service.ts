import type { NextFunction, Request, Response } from 'express';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type {
  AccessLogItem,
  ChangelogItem,
  ConsentItem,
  CreateDataRequestInput,
  CreateNotificationRuleInput,
  DataRequestItem,
  NotificationEntry,
  NotificationRuleItem,
  PrivacySettings,
  RecordConsentInput,
  UsageSummary,
} from '@propbot/shared';
import { db } from '../../db/index.js';
import {
  accessLogs,
  appointments,
  changelogEntries,
  companies,
  consentRecords,
  contacts,
  conversationNotes,
  conversations,
  dataRequests,
  leads,
  llmCalls,
  messages,
  notificationRules,
  notifications,
  taggings,
  users,
  voiceCalls,
} from '../../db/schema/index.js';
import { badRequest, conflict, notFound } from '../../utils/api-error.js';
import { emailChannelAdapter } from '../integrations/email.adapter.js';
import { addDnd } from '../voice/dnd.js';

// ---------------------------------------------------------------- PII masking
export const maskPhone = (p: string | null | undefined): string | null => {
  if (!p) return null;
  const digits = p.replace(/\D/g, '');
  if (digits.length < 6) return '••••';
  return `${p.startsWith('+') ? '+' : ''}${digits.slice(0, 2)}${'•'.repeat(Math.max(3, digits.length - 6))}${digits.slice(-4)}`;
};
export const maskEmail = (e: string | null | undefined): string | null => {
  if (!e) return null;
  const [user, domain] = e.split('@');
  if (!domain) return '••••';
  return `${user!.slice(0, 1)}${'•'.repeat(Math.max(3, user!.length - 1))}@${domain}`;
};

const DEFAULT_MASK_ROLES: PrivacySettings['maskRoles'] = ['viewer'];

class PrivacySettingsService {
  async get(companyId: string): Promise<PrivacySettings> {
    const [c] = await db.select({ settings: companies.settings }).from(companies).where(eq(companies.id, companyId));
    const roles = ((c?.settings as { privacy?: { maskRoles?: PrivacySettings['maskRoles'] } } | null)?.privacy?.maskRoles ?? DEFAULT_MASK_ROLES) as PrivacySettings['maskRoles'];
    return { maskRoles: roles };
  }
  async set(companyId: string, input: PrivacySettings): Promise<PrivacySettings> {
    const [c] = await db.select({ settings: companies.settings }).from(companies).where(eq(companies.id, companyId));
    const settings = { ...((c?.settings as Record<string, unknown> | null) ?? {}), privacy: { maskRoles: [...new Set(input.maskRoles)] } };
    await db.update(companies).set({ settings, updatedAt: new Date() }).where(eq(companies.id, companyId));
    return { maskRoles: [...new Set(input.maskRoles)] };
  }
  async shouldMask(companyId: string, role: string): Promise<boolean> {
    return (await this.get(companyId)).maskRoles.includes(role as never);
  }
}
export const privacySettingsService = new PrivacySettingsService();

// ---------------------------------------------------------------- access logs
class AccessLogsService {
  record(entry: { companyId: string; userId?: string | null; apiKeyId?: string | null; action: string; resourceType: string; resourceId?: string | null; ip?: string | null; userAgent?: string | null; metadata?: Record<string, unknown> }): void {
    void db
      .insert(accessLogs)
      .values({ companyId: entry.companyId, userId: entry.userId ?? null, apiKeyId: entry.apiKeyId ?? null, action: entry.action, resourceType: entry.resourceType, resourceId: entry.resourceId ?? null, ipAddress: entry.ip?.slice(0, 64) ?? null, userAgent: entry.userAgent?.slice(0, 300) ?? null, metadata: entry.metadata ?? {} })
      .catch(() => undefined);
  }

  async list(companyId: string, f: { userId?: string; action?: string; resourceType?: string; days: number; limit: number }): Promise<AccessLogItem[]> {
    const since = new Date(Date.now() - f.days * 86_400_000);
    const conds = [eq(accessLogs.companyId, companyId), gte(accessLogs.createdAt, since), f.userId ? eq(accessLogs.userId, f.userId) : undefined, f.action ? eq(accessLogs.action, f.action) : undefined, f.resourceType ? eq(accessLogs.resourceType, f.resourceType) : undefined].filter((c): c is NonNullable<typeof c> => c !== undefined);
    const rows = await db.select({ l: accessLogs, name: users.name }).from(accessLogs).leftJoin(users, eq(users.id, accessLogs.userId)).where(and(...conds)).orderBy(desc(accessLogs.createdAt)).limit(f.limit);
    return rows.map(r => ({ id: r.l.id, userId: r.l.userId, userName: r.name, apiKeyId: r.l.apiKeyId, action: r.l.action, resourceType: r.l.resourceType, resourceId: r.l.resourceId, ipAddress: r.l.ipAddress, createdAt: r.l.createdAt.toISOString() }));
  }
}
export const accessLogsService = new AccessLogsService();

/** Records who viewed/exported what, after a successful response. Never blocks or fails the request. */
export function logAccess(resourceType: string, action: string, idParam = 'id') {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      if (res.statusCode >= 400 || !req.tenant) return;
      accessLogsService.record({ companyId: req.tenant.companyId, userId: req.tenant.userId, action, resourceType, resourceId: req.params[idParam] ?? null, ip: req.ip, userAgent: req.headers['user-agent'] });
    });
    next();
  };
}

// ---------------------------------------------------------------- notifications
const EVENT_COPY: Record<string, { title: string; fallback: string }> = {
  lead_hot: { title: '🔥 Hot lead', fallback: 'A lead just became hot.' },
  handoff_requested: { title: '👤 Takeover requested', fallback: 'A visitor needs a person.' },
  visit_booked: { title: '📅 Site visit booked', fallback: 'A new site visit was booked.' },
  lead_created: { title: '🆕 New lead', fallback: 'A new lead was captured.' },
  call_completed: { title: '📞 AI call finished', fallback: 'An AI voice call has finished.' },
  sla_breach: { title: '⏱ Reply overdue', fallback: 'A conversation is waiting too long for a reply.' },
  webhook_failed: { title: '⚠️ Webhook failing', fallback: 'A webhook endpoint keeps failing.' },
  credits_low: { title: '💳 Credits running low', fallback: 'Your prepaid credits are running low.' },
  payment_received: { title: '💰 Payment received', fallback: 'A payment was received.' },
  payment_failed: { title: '⚠️ Payment failed', fallback: 'A subscription payment failed.' },
};

class NotificationsService {
  async listRules(companyId: string): Promise<NotificationRuleItem[]> {
    const rows = await db.select().from(notificationRules).where(eq(notificationRules.companyId, companyId)).orderBy(notificationRules.eventType);
    return rows.map(r => ({ id: r.id, eventType: r.eventType, channels: r.channels, userId: r.userId, isActive: r.isActive }));
  }

  async createRule(companyId: string, input: CreateNotificationRuleInput): Promise<NotificationRuleItem> {
    if (input.userId) {
      const [u] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, input.userId), eq(users.companyId, companyId)));
      if (!u) throw badRequest('USER_INVALID', 'That person is not on your team.');
    }
    const existing = (await this.listRules(companyId)).find(r => r.eventType === input.eventType && (r.userId ?? null) === (input.userId ?? null));
    if (existing) {
      const [r] = await db.update(notificationRules).set({ channels: input.channels, isActive: input.isActive }).where(eq(notificationRules.id, existing.id)).returning();
      return { id: r!.id, eventType: r!.eventType, channels: r!.channels, userId: r!.userId, isActive: r!.isActive };
    }
    const [r] = await db.insert(notificationRules).values({ companyId, userId: input.userId ?? null, eventType: input.eventType, channels: input.channels, isActive: input.isActive }).returning();
    return { id: r!.id, eventType: r!.eventType, channels: r!.channels, userId: r!.userId, isActive: r!.isActive };
  }

  async removeRule(companyId: string, id: string): Promise<void> {
    const res = await db.delete(notificationRules).where(and(eq(notificationRules.id, id), eq(notificationRules.companyId, companyId))).returning({ id: notificationRules.id });
    if (res.length === 0) throw notFound('Rule');
  }

  /**
   * Routes an event through the company's rules. Returns false when the company has no rule for it,
   * so the built-in behaviour (alert the first admin in-app) still applies.
   */
  async deliver(event: { companyId: string; type: string; payload: Record<string, unknown> }): Promise<boolean> {
    const rules = await db.select().from(notificationRules).where(and(eq(notificationRules.companyId, event.companyId), eq(notificationRules.eventType, event.type)));
    if (rules.length === 0) return false;
    const def = rules.find(r => r.userId === null && r.isActive);
    const personal = new Map(rules.filter(r => r.userId).map(r => [r.userId!, r]));
    const staff = await db.select({ id: users.id, email: users.email, role: users.role }).from(users).where(and(eq(users.companyId, event.companyId), eq(users.status, 'active')));
    const copy = EVENT_COPY[event.type] ?? { title: event.type.replace(/_/g, ' '), fallback: `Event ${event.type}` };
    const message = typeof event.payload.summary === 'string' ? event.payload.summary : copy.fallback;
    const link = typeof event.payload.conversation_id === 'string' ? `/inbox?conversation=${event.payload.conversation_id}` : null;

    for (const u of staff) {
      const rule = personal.get(u.id) ?? (['company_admin', 'sales_manager'].includes(u.role) ? def : undefined);
      if (!rule || !rule.isActive) continue;
      if (rule.channels.includes('in_app')) {
        await db.insert(notifications).values({ companyId: event.companyId, userId: u.id, type: event.type, title: copy.title, message, linkUrl: link, metadata: event.payload });
      }
      if (rule.channels.includes('email') && u.email) {
        await emailChannelAdapter.send(event.companyId, u.email, { type: 'text', text: `${copy.title}\n\n${message}` }).catch(() => undefined);
      }
      // whatsapp / slack alerts are accepted in rules but delivered only once those connectors exist
    }
    return true;
  }

  async list(companyId: string, userId: string, onlyUnread = false, limit = 50): Promise<{ unreadCount: number; items: NotificationEntry[] }> {
    const where = and(eq(notifications.companyId, companyId), eq(notifications.userId, userId), onlyUnread ? eq(notifications.isRead, false) : undefined);
    const rows = await db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(Math.min(limit, 200));
    const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.companyId, companyId), eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return { unreadCount: n, items: rows.map(r => ({ id: r.id, type: r.type, title: r.title, message: r.message, isRead: r.isRead, linkUrl: r.linkUrl, createdAt: r.createdAt.toISOString() })) };
  }

  async markRead(companyId: string, userId: string, ids?: string[]): Promise<number> {
    const res = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.companyId, companyId), eq(notifications.userId, userId), eq(notifications.isRead, false), ids?.length ? inArray(notifications.id, ids) : undefined))
      .returning({ id: notifications.id });
    return res.length;
  }
}
export const notificationsService = new NotificationsService();

// ---------------------------------------------------------------- usage (tracking only)
class UsageService {
  async summary(companyId: string, days: number): Promise<UsageSummary> {
    const since = new Date(Date.now() - days * 86_400_000);
    const [llm] = await db
      .select({ tokens: sql<number>`coalesce(sum(${llmCalls.totalTokens}), 0)::int`, cost: sql<string>`coalesce(sum(${llmCalls.costUsd}), 0)`, calls: sql<number>`count(*)::int` })
      .from(llmCalls)
      .where(and(eq(llmCalls.companyId, companyId), gte(llmCalls.createdAt, since)));
    const purposes = await db.select({ p: llmCalls.purpose, n: sql<number>`coalesce(sum(${llmCalls.totalTokens}), 0)::int` }).from(llmCalls).where(and(eq(llmCalls.companyId, companyId), gte(llmCalls.createdAt, since))).groupBy(llmCalls.purpose);
    const msgs = await db
      .select({ channel: conversations.channel, n: sql<number>`count(*)::int` })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(and(eq(messages.companyId, companyId), gte(messages.createdAt, since), inArray(messages.senderType, ['bot', 'agent'])))
      .groupBy(conversations.channel);
    const [call] = await db
      .select({ secs: sql<number>`coalesce(sum(${voiceCalls.durationSeconds}), 0)::int`, n: sql<number>`count(*)::int` })
      .from(voiceCalls)
      .where(and(eq(voiceCalls.companyId, companyId), gte(voiceCalls.createdAt, since), sql`${voiceCalls.direction} <> 'test'`));
    const dailyTokens = await db.select({ d: sql<string>`to_char(date_trunc('day', ${llmCalls.createdAt}), 'YYYY-MM-DD')`, n: sql<number>`coalesce(sum(${llmCalls.totalTokens}), 0)::int` }).from(llmCalls).where(and(eq(llmCalls.companyId, companyId), gte(llmCalls.createdAt, since))).groupBy(sql`1`);
    const dailyMsgs = await db.select({ d: sql<string>`to_char(date_trunc('day', ${messages.createdAt}), 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` }).from(messages).where(and(eq(messages.companyId, companyId), gte(messages.createdAt, since), inArray(messages.senderType, ['bot', 'agent']))).groupBy(sql`1`);
    const days_ = [...new Set([...dailyTokens.map(x => x.d), ...dailyMsgs.map(x => x.d)])].sort();
    return {
      days,
      llm: { tokens: llm?.tokens ?? 0, costUsd: Math.round(Number(llm?.cost ?? 0) * 10000) / 10000, calls: llm?.calls ?? 0, byPurpose: Object.fromEntries(purposes.map(p => [p.p, p.n])) },
      messages: { total: msgs.reduce((a, m) => a + m.n, 0), byChannel: Object.fromEntries(msgs.map(m => [m.channel, m.n])) },
      calls: { minutes: Math.round(((call?.secs ?? 0) / 60) * 10) / 10, count: call?.n ?? 0 },
      daily: days_.map(day => ({ day, tokens: dailyTokens.find(x => x.d === day)?.n ?? 0, messages: dailyMsgs.find(x => x.d === day)?.n ?? 0 })),
    };
  }
}
export const usageService = new UsageService();

// ---------------------------------------------------------------- consent & data requests (DPDP)
class PrivacyService {
  private async assertContact(companyId: string, contactId: string) {
    const [c] = await db.select({ id: contacts.id, first: contacts.firstName, last: contacts.lastName, phone: contacts.phone }).from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.companyId, companyId)));
    if (!c) throw badRequest('CONTACT_INVALID', 'That contact does not exist.');
    return c;
  }

  async recordConsent(companyId: string, input: RecordConsentInput): Promise<ConsentItem> {
    const c = await this.assertContact(companyId, input.contactId);
    const [r] = await db.insert(consentRecords).values({ companyId, contactId: input.contactId, channel: input.channel, purpose: input.purpose, granted: input.granted, source: input.source, evidence: input.evidence }).returning();
    // Withdrawing voice consent must stop automated calls straight away
    if (!input.granted && input.channel === 'voice' && /^\+?\d/.test(c.phone)) await addDnd(companyId, c.phone, 'requested');
    return { id: r!.id, contactId: r!.contactId, channel: r!.channel, purpose: r!.purpose, granted: r!.granted, source: r!.source, createdAt: r!.createdAt.toISOString() };
  }

  /** The latest decision per channel and purpose wins. */
  async consentFor(companyId: string, contactId: string): Promise<ConsentItem[]> {
    await this.assertContact(companyId, contactId);
    const rows = await db.select().from(consentRecords).where(and(eq(consentRecords.companyId, companyId), eq(consentRecords.contactId, contactId))).orderBy(desc(consentRecords.createdAt));
    const seen = new Set<string>();
    const latest: ConsentItem[] = [];
    for (const r of rows) {
      const k = `${r.channel}:${r.purpose}`;
      if (seen.has(k)) continue;
      seen.add(k);
      latest.push({ id: r.id, contactId: r.contactId, channel: r.channel, purpose: r.purpose, granted: r.granted, source: r.source, createdAt: r.createdAt.toISOString() });
    }
    return latest;
  }

  private toItem(r: typeof dataRequests.$inferSelect): DataRequestItem {
    return { id: r.id, kind: r.kind as DataRequestItem['kind'], contactId: r.contactId, subjectLabel: r.subjectLabel, status: r.status as DataRequestItem['status'], createdAt: r.createdAt.toISOString(), completedAt: r.completedAt?.toISOString() ?? null };
  }

  async createRequest(companyId: string, userId: string | null, input: CreateDataRequestInput): Promise<DataRequestItem> {
    const c = await this.assertContact(companyId, input.contactId);
    const [dup] = await db.select({ id: dataRequests.id }).from(dataRequests).where(and(eq(dataRequests.companyId, companyId), eq(dataRequests.contactId, input.contactId), eq(dataRequests.kind, input.kind), eq(dataRequests.status, 'pending')));
    if (dup) throw conflict('REQUEST_PENDING', 'There is already a pending request of this kind for this person.');
    const [r] = await db.insert(dataRequests).values({ companyId, kind: input.kind, contactId: input.contactId, subjectLabel: `${c.first} ${c.last ?? ''}`.trim(), requestedBy: userId }).returning();
    return this.toItem(r!);
  }

  async listRequests(companyId: string): Promise<DataRequestItem[]> {
    return (await db.select().from(dataRequests).where(eq(dataRequests.companyId, companyId)).orderBy(desc(dataRequests.createdAt)).limit(100)).map(r => this.toItem(r));
  }

  private async bundle(companyId: string, contactId: string) {
    const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.companyId, companyId)));
    const leadRows = await db.select().from(leads).where(and(eq(leads.contactId, contactId), eq(leads.companyId, companyId)));
    const convs = await db.select().from(conversations).where(and(eq(conversations.contactId, contactId), eq(conversations.companyId, companyId)));
    const msgs = convs.length ? await db.select().from(messages).where(and(eq(messages.companyId, companyId), inArray(messages.conversationId, convs.map(c => c.id)))) : [];
    const calls = await db.select().from(voiceCalls).where(and(eq(voiceCalls.contactId, contactId), eq(voiceCalls.companyId, companyId)));
    const visits = leadRows.length ? await db.select().from(appointments).where(and(eq(appointments.companyId, companyId), inArray(appointments.leadId, leadRows.map(l => l.id)))) : [];
    const consents = await db.select().from(consentRecords).where(and(eq(consentRecords.contactId, contactId), eq(consentRecords.companyId, companyId)));
    return {
      exportedAt: new Date().toISOString(),
      contact,
      leads: leadRows.map(l => ({ id: l.id, status: l.status, source: l.source, intentScore: l.intentScore, attributes: (l.customFields as { attributes?: unknown } | null)?.attributes ?? {}, createdAt: l.createdAt })),
      conversations: convs.map(c => ({ id: c.id, channel: c.channel, createdAt: c.createdAt, messages: msgs.filter(m => m.conversationId === c.id).map(m => ({ from: m.senderType, text: m.content, at: m.createdAt })) })),
      calls: calls.map(c => ({ id: c.id, direction: c.direction, outcome: c.outcome, durationSeconds: c.durationSeconds, summary: c.summary, at: c.createdAt })),
      siteVisits: visits.map(v => ({ id: v.id, status: v.status, scheduledAt: v.scheduledAt })),
      consents: consents.map(c => ({ channel: c.channel, purpose: c.purpose, granted: c.granted, source: c.source, at: c.createdAt })),
    };
  }

  /** Erasure by anonymisation: personal details and message text are removed, aggregates and the lead record stay. */
  private async anonymise(companyId: string, contactId: string): Promise<void> {
    const c = await this.assertContact(companyId, contactId);
    await db.transaction(async tx => {
      const convs = await tx.select({ id: conversations.id }).from(conversations).where(and(eq(conversations.contactId, contactId), eq(conversations.companyId, companyId)));
      const convIds = convs.map(x => x.id);
      if (convIds.length) {
        await tx.update(messages).set({ content: '[removed at the person\'s request]', metadata: {} }).where(and(eq(messages.companyId, companyId), inArray(messages.conversationId, convIds)));
        await tx.update(conversationNotes).set({ body: '[removed]' }).where(and(eq(conversationNotes.companyId, companyId), inArray(conversationNotes.conversationId, convIds)));
      }
      await tx.update(voiceCalls).set({ transcript: null, summary: null, recordingUrl: null, toNumber: 'removed' }).where(and(eq(voiceCalls.contactId, contactId), eq(voiceCalls.companyId, companyId)));
      await tx.update(leads).set({ customFields: {}, buyerDna: {}, handoffBrief: null, updatedAt: new Date() }).where(and(eq(leads.contactId, contactId), eq(leads.companyId, companyId)));
      await tx.delete(taggings).where(and(eq(taggings.companyId, companyId), eq(taggings.entityType, 'contact'), eq(taggings.entityId, contactId)));
      await tx.update(contacts).set({ firstName: 'Deleted', lastName: null, phone: `deleted:${contactId.slice(0, 8)}`, email: null, altPhone: null, lifecycleStage: 'deleted', updatedAt: new Date() }).where(eq(contacts.id, contactId));
    });
    // never contact the original number again
    if (/^\+?\d/.test(c.phone)) await addDnd(companyId, c.phone, 'requested');
  }

  async decide(companyId: string, id: string, decision: 'approve' | 'reject'): Promise<DataRequestItem> {
    const [r] = await db.select().from(dataRequests).where(and(eq(dataRequests.id, id), eq(dataRequests.companyId, companyId)));
    if (!r) throw notFound('Request');
    if (r.status !== 'pending') throw conflict('REQUEST_DECIDED', `This request is already ${r.status}.`);
    if (decision === 'reject') {
      const [x] = await db.update(dataRequests).set({ status: 'rejected', completedAt: new Date() }).where(eq(dataRequests.id, id)).returning();
      return this.toItem(x!);
    }
    if (!r.contactId) throw badRequest('REQUEST_NO_CONTACT', 'The person no longer exists.');
    let resultRef: string | null = null;
    if (r.kind === 'export') resultRef = JSON.stringify(await this.bundle(companyId, r.contactId));
    else await this.anonymise(companyId, r.contactId);
    const [x] = await db.update(dataRequests).set({ status: 'completed', resultRef, completedAt: new Date() }).where(eq(dataRequests.id, id)).returning();
    return this.toItem(x!);
  }

  async download(companyId: string, id: string): Promise<string> {
    const [r] = await db.select().from(dataRequests).where(and(eq(dataRequests.id, id), eq(dataRequests.companyId, companyId)));
    if (!r) throw notFound('Request');
    if (r.kind !== 'export' || r.status !== 'completed' || !r.resultRef) throw conflict('REQUEST_NO_EXPORT', 'There is no export to download for this request.');
    return r.resultRef;
  }
}
export const privacyService = new PrivacyService();

// ---------------------------------------------------------------- changelog
class ChangelogService {
  async list(limit = 50): Promise<ChangelogItem[]> {
    const rows = await db.select().from(changelogEntries).orderBy(desc(changelogEntries.publishedAt)).limit(Math.min(limit, 200));
    return rows.map(r => ({ id: r.id, title: r.title, bodyMd: r.bodyMd, category: r.category, publishedAt: r.publishedAt.toISOString() }));
  }
  async create(input: { title: string; bodyMd: string; category: string }): Promise<ChangelogItem> {
    const [r] = await db.insert(changelogEntries).values(input).returning();
    return { id: r!.id, title: r!.title, bodyMd: r!.bodyMd, category: r!.category, publishedAt: r!.publishedAt.toISOString() };
  }
}
export const changelogService = new ChangelogService();
