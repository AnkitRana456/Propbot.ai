import { and, desc, eq, inArray, or } from 'drizzle-orm';
import type { Contact360, TimelineEntry } from '@propbot/shared';
import { db } from '../../db/index.js';
import {
  appointments,
  contacts,
  conversationInsights,
  conversationNotes,
  conversations,
  leadActivities,
  leads,
  messages,
  surveyResponses,
  surveys,
  voiceCalls,
} from '../../db/schema/index.js';
import { notFound } from '../../utils/api-error.js';
import { tagsService } from './tags-groups.service.js';

const MAX_TIMELINE = 200;
const clip = (s: string | null | undefined, n = 240) => (s ? (s.length > n ? `${s.slice(0, n)}…` : s) : null);

class Contact360Service {
  /** One chronological view of everything that happened with a person, across channels. */
  async get(companyId: string, contactId: string): Promise<Contact360> {
    const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.companyId, companyId)));
    if (!contact) throw notFound('Contact');

    const leadRows = await db.select().from(leads).where(and(eq(leads.contactId, contactId), eq(leads.companyId, companyId))).orderBy(desc(leads.createdAt));
    const lead = leadRows[0] ?? null;
    const leadIds = leadRows.map(l => l.id);

    const convs = await db
      .select({ id: conversations.id, channel: conversations.channel })
      .from(conversations)
      .where(and(eq(conversations.companyId, companyId), leadIds.length ? or(eq(conversations.contactId, contactId), inArray(conversations.leadId, leadIds)) : eq(conversations.contactId, contactId)));
    const convIds = convs.map(c => c.id);
    const channelOf = new Map(convs.map(c => [c.id, c.channel]));

    const [msgs, calls, visits, activities, notes, insights, tags, surveyRows] = await Promise.all([
      convIds.length ? db.select().from(messages).where(and(eq(messages.companyId, companyId), inArray(messages.conversationId, convIds))).orderBy(desc(messages.createdAt)).limit(MAX_TIMELINE) : Promise.resolve([]),
      db.select().from(voiceCalls).where(and(eq(voiceCalls.companyId, companyId), or(eq(voiceCalls.contactId, contactId), leadIds.length ? inArray(voiceCalls.leadId, leadIds) : undefined))).orderBy(desc(voiceCalls.createdAt)).limit(50),
      leadIds.length ? db.select().from(appointments).where(and(eq(appointments.companyId, companyId), inArray(appointments.leadId, leadIds))).orderBy(desc(appointments.scheduledAt)).limit(50) : Promise.resolve([]),
      leadIds.length ? db.select().from(leadActivities).where(and(eq(leadActivities.companyId, companyId), inArray(leadActivities.leadId, leadIds))).orderBy(desc(leadActivities.createdAt)).limit(100) : Promise.resolve([]),
      convIds.length ? db.select().from(conversationNotes).where(and(eq(conversationNotes.companyId, companyId), inArray(conversationNotes.conversationId, convIds))).orderBy(desc(conversationNotes.createdAt)).limit(50) : Promise.resolve([]),
      convIds.length ? db.select().from(conversationInsights).where(and(eq(conversationInsights.companyId, companyId), inArray(conversationInsights.conversationId, convIds))) : Promise.resolve([]),
      tagsService.forEntity(companyId, 'contact', contactId),
      leadIds.length ? db.select({ r: surveyResponses, name: surveys.name }).from(surveyResponses).innerJoin(surveys, eq(surveys.id, surveyResponses.surveyId)).where(and(eq(surveyResponses.companyId, companyId), inArray(surveyResponses.leadId, leadIds))) : Promise.resolve([]),
    ]);
    const leadTags = lead ? await tagsService.forEntity(companyId, 'lead', lead.id) : [];

    const timeline: TimelineEntry[] = [
      ...msgs.map<TimelineEntry>(m => ({ at: m.createdAt.toISOString(), kind: 'message', title: m.senderType === 'visitor' ? 'Buyer wrote' : m.senderType === 'agent' ? 'Team replied' : 'AI replied', detail: clip(m.content), channel: channelOf.get(m.conversationId) ?? null, refId: m.conversationId })),
      ...calls.map<TimelineEntry>(c => ({ at: (c.startedAt ?? c.createdAt).toISOString(), kind: 'call', title: `Call: ${(c.outcome ?? c.status).replace(/_/g, ' ')}`, detail: clip(c.summary), channel: 'voice', refId: c.id })),
      ...visits.map<TimelineEntry>(v => ({ at: v.scheduledAt.toISOString(), kind: 'visit', title: `Site visit ${v.status.replace(/_/g, ' ')}`, detail: null, refId: v.id })),
      ...activities.map<TimelineEntry>(a => ({ at: a.createdAt.toISOString(), kind: 'activity', title: a.title, detail: clip(a.description), refId: a.id })),
      ...notes.map<TimelineEntry>(n => ({ at: n.createdAt.toISOString(), kind: 'note', title: 'Internal note', detail: clip(n.body), refId: n.conversationId })),
      ...surveyRows.map<TimelineEntry>(s => ({ at: s.r.createdAt.toISOString(), kind: 'survey', title: `${s.name}: ${s.r.score ?? '-'}${s.r.isEstimated ? ' (estimated)' : ''}`, detail: null, refId: s.r.id })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, MAX_TIMELINE);

    const attributes = ((lead?.customFields as { attributes?: Record<string, unknown> } | null)?.attributes ?? {}) as Record<string, unknown>;
    return {
      contact: { id: contact.id, name: `${contact.firstName} ${contact.lastName ?? ''}`.trim(), phone: /^\+?\d/.test(contact.phone) ? contact.phone : null, email: contact.email, lifecycleStage: contact.lifecycleStage },
      lead: lead
        ? { id: lead.id, status: lead.status, source: lead.source, intentScore: lead.intentScore, intentLabel: lead.intentLabel, buyerDna: lead.buyerDna as Record<string, unknown>, attributes, scoreHistory: (lead.scoreHistory as Array<{ at?: string; score?: number }>) ?? [] }
        : null,
      tags: [...tags, ...leadTags.filter(t => !tags.some(x => x.id === t.id))],
      insights: insights.map(i => ({ conversationId: i.conversationId, summary: i.summary, intent: i.intent, sentiment: i.sentiment, labels: i.labels })),
      stats: { conversations: convs.length, messages: msgs.length, calls: calls.length, visits: visits.length },
      timeline,
    };
  }
}

export const contact360Service = new Contact360Service();
