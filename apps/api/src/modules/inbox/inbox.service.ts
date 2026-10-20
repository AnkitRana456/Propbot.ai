import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type {
  InboxConversationDetail,
  InboxConversationItem,
  InboxNoteInput,
  InboxNoteItem,
  InboxQuery,
  InboxReplyInput,
  InboxUpdateInput,
} from '@propbot/shared';
import { db } from '../../db/index.js';
import { conversationNotes, conversations, messages, notifications, users } from '../../db/schema/index.js';
import { badRequest, conflict, notFound } from '../../utils/api-error.js';
import { dispatchReply, whatsappWindowExpired } from './channel-dispatch.js';

type Row = {
  id: string;
  channel: string;
  status: string;
  priority: string;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  first_response_at: Date | null;
  contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  lead_id: string | null;
  lead_status: string | null;
  lead_custom: Record<string, unknown> | null;
  visit_count: number | null;
  assignee_id: string | null;
  assignee_name: string | null;
  last_content: string | null;
  last_at: Date | null;
  last_sender: string | null;
  last_visitor_at: Date | null;
  awaiting: number | null;
};

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

const SELECT = sql`
  SELECT c.id, c.channel, c.status, c.priority, c.tags, c.metadata, c.created_at, c.first_response_at,
         c.contact_id, ct.first_name, ct.last_name, ct.phone, ct.email,
         c.lead_id, l.status AS lead_status, l.custom_fields AS lead_custom, l.visit_count,
         c.assigned_agent_id AS assignee_id, u.name AS assignee_name,
         lm.content AS last_content, lm.created_at AS last_at, lm.sender_type AS last_sender,
         lv.created_at AS last_visitor_at,
         (SELECT count(*)::int FROM messages m
            WHERE m.conversation_id = c.id AND m.sender_type = 'visitor'
              AND m.created_at > COALESCE((SELECT max(created_at) FROM messages WHERE conversation_id = c.id AND sender_type IN ('bot','agent')), 'epoch'::timestamptz)) AS awaiting
  FROM conversations c
  LEFT JOIN contacts ct ON ct.id = c.contact_id
  LEFT JOIN leads l ON l.id = c.lead_id
  LEFT JOIN users u ON u.id = c.assigned_agent_id
  LEFT JOIN LATERAL (SELECT content, created_at, sender_type FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) lm ON true
  LEFT JOIN LATERAL (SELECT created_at FROM messages WHERE conversation_id = c.id AND sender_type = 'visitor' ORDER BY created_at DESC LIMIT 1) lv ON true
`;

function toItem(r: Row): InboxConversationItem {
  const name = `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim();
  return {
    id: r.id,
    channel: r.channel,
    status: r.status,
    priority: r.priority,
    tags: r.tags ?? [],
    contactName: name || r.email || 'Unknown visitor',
    // social contacts carry a placeholder phone ("instagram:<id>"); never show it as a number
    contactPhone: r.phone && /^\+?\d[\d\s-]{5,}$/.test(r.phone) ? r.phone : null,
    leadId: r.lead_id,
    leadStatus: r.lead_status,
    assigneeId: r.assignee_id,
    assigneeName: r.assignee_name,
    aiPaused: Boolean(r.metadata?.aiPaused),
    lastMessage: r.last_content ? r.last_content.slice(0, 160) : null,
    lastMessageAt: iso(r.last_at),
    lastSender: r.last_sender,
    awaitingReply: r.awaiting ?? 0,
    createdAt: iso(r.created_at)!,
  };
}

const DATE_COLS = ['created_at', 'first_response_at', 'last_at', 'last_visitor_at'] as const;
/** Raw SQL returns timestamps as strings; normalise to Date so the rest of the service can rely on it. */
const rowsOf = (res: unknown): Row[] => {
  const rows = (Array.isArray(res) ? res : ((res as { rows?: Row[] }).rows ?? [])) as Array<Record<string, unknown>>;
  return rows.map(r => {
    const out = { ...r };
    for (const c of DATE_COLS) if (typeof out[c] === 'string') out[c] = new Date(out[c] as string);
    return out as unknown as Row;
  });
};

class InboxService {
  async list(companyId: string, q: InboxQuery, userId: string | null): Promise<{ items: InboxConversationItem[]; total: number }> {
    const where = [sql`c.company_id = ${companyId}`];
    if (q.status) where.push(sql`c.status = ${q.status}`);
    if (q.channel) where.push(sql`c.channel = ${q.channel}`);
    if (q.priority) where.push(sql`c.priority = ${q.priority}`);
    if (q.tag) where.push(sql`${q.tag} = ANY(c.tags)`);
    if (q.assignee === 'unassigned') where.push(sql`c.assigned_agent_id IS NULL`);
    else if (q.assignee === 'me' && userId) where.push(sql`c.assigned_agent_id = ${userId}`);
    else if (q.assignee && /^[0-9a-f-]{36}$/i.test(q.assignee)) where.push(sql`c.assigned_agent_id = ${q.assignee}`);
    if (q.search) {
      const like = `%${q.search.replace(/[%_\\]/g, m => `\\${m}`)}%`;
      where.push(sql`(ct.first_name ILIKE ${like} OR ct.last_name ILIKE ${like} OR ct.phone ILIKE ${like} OR ct.email ILIKE ${like})`);
    }
    const cond = sql.join(where, sql` AND `);
    // Nothing happened yet in a conversation with no messages, so it stays out of the inbox.
    const res = await db.execute(sql`${SELECT} WHERE ${cond} AND lm.created_at IS NOT NULL ORDER BY lm.created_at DESC LIMIT ${q.limit} OFFSET ${q.offset}`);
    const totalRes = await db.execute(
      sql`SELECT count(*)::int AS n FROM conversations c LEFT JOIN contacts ct ON ct.id = c.contact_id WHERE ${cond} AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id)`,
    );
    const total = (rowsOf(totalRes)[0] as unknown as { n: number } | undefined)?.n ?? 0;
    return { items: rowsOf(res).map(toItem), total };
  }

  private async row(companyId: string, id: string): Promise<Row> {
    const res = await db.execute(sql`${SELECT} WHERE c.company_id = ${companyId} AND c.id = ${id}`);
    const r = rowsOf(res)[0];
    if (!r) throw notFound('Conversation');
    return r;
  }

  async get(companyId: string, id: string): Promise<InboxConversationDetail> {
    const r = await this.row(companyId, id);
    const msgs = await db.select().from(messages).where(and(eq(messages.conversationId, id), eq(messages.companyId, companyId))).orderBy(asc(messages.createdAt)).limit(500);
    const noteRows = await db
      .select({ n: conversationNotes, author: users.name })
      .from(conversationNotes)
      .leftJoin(users, eq(users.id, conversationNotes.authorId))
      .where(and(eq(conversationNotes.conversationId, id), eq(conversationNotes.companyId, companyId)))
      .orderBy(asc(conversationNotes.createdAt));
    const attributes = ((r.lead_custom?.attributes ?? {}) as Record<string, unknown>) ?? {};
    return {
      ...toItem(r),
      messages: msgs.map(m => ({ id: m.id, senderType: m.senderType, senderId: m.senderId, content: m.content, createdAt: m.createdAt.toISOString(), metadata: m.metadata as Record<string, unknown> })),
      notes: noteRows.map<InboxNoteItem>(({ n, author }) => ({ id: n.id, authorId: n.authorId, authorName: author, body: n.body, mentions: n.mentions, createdAt: n.createdAt.toISOString() })),
      contact: { id: r.contact_id, email: r.email, attributes, visitCount: r.visit_count ?? 0 },
      serviceWindowExpired: r.channel === 'whatsapp' ? whatsappWindowExpired(r.last_visitor_at) : false,
      firstResponseAt: iso(r.first_response_at),
    };
  }

  async reply(companyId: string, userId: string, id: string, input: InboxReplyInput): Promise<InboxConversationDetail> {
    const r = await this.row(companyId, id);
    if (r.status === 'closed') throw conflict('CONVERSATION_CLOSED', 'This conversation is closed. Reopen it to reply.');
    const result = await dispatchReply({
      companyId,
      channel: r.channel,
      conversationId: id,
      contactId: r.contact_id,
      phone: r.phone,
      email: r.email,
      text: input.content,
      templateName: input.templateName,
      templateLanguage: input.templateLanguage,
      mediaUrl: input.mediaUrl,
      lastInboundAt: r.last_visitor_at,
    });
    await db.insert(messages).values({
      companyId,
      conversationId: id,
      senderType: 'agent',
      senderId: userId,
      content: input.content,
      metadata: { channel: r.channel, provider: result.provider, providerMessageId: result.providerMessageId, deliveryStatus: result.status, templateName: result.templateName, mediaUrl: input.mediaUrl },
    });
    // A human answered: AI stays quiet, the conversation is theirs, response time is recorded once.
    const meta = { ...(r.metadata ?? {}), aiPaused: true, takenOverBy: userId };
    await db
      .update(conversations)
      .set({
        status: r.status === 'resolved' ? 'open' : r.status === 'pending' ? 'pending' : 'open',
        assignedAgentId: r.assignee_id ?? userId,
        metadata: meta,
        firstResponseAt: r.first_response_at ?? new Date(),
        resolvedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id));
    return this.get(companyId, id);
  }

  async takeControl(companyId: string, userId: string, id: string): Promise<InboxConversationDetail> {
    const r = await this.row(companyId, id);
    await db
      .update(conversations)
      .set({ status: 'open', assignedAgentId: userId, metadata: { ...(r.metadata ?? {}), aiPaused: true, takenOverBy: userId, takenOverAt: new Date().toISOString() }, updatedAt: new Date() })
      .where(eq(conversations.id, id));
    return this.get(companyId, id);
  }

  async handBackToAi(companyId: string, id: string): Promise<InboxConversationDetail> {
    const r = await this.row(companyId, id);
    const meta = { ...(r.metadata ?? {}), aiPaused: false };
    delete (meta as Record<string, unknown>).takenOverBy;
    await db.update(conversations).set({ status: 'bot', metadata: meta, updatedAt: new Date() }).where(eq(conversations.id, id));
    return this.get(companyId, id);
  }

  async update(companyId: string, id: string, input: InboxUpdateInput): Promise<InboxConversationDetail> {
    await this.row(companyId, id);
    const patch: Partial<typeof conversations.$inferInsert> = { updatedAt: new Date() };
    if (input.priority) patch.priority = input.priority;
    if (input.tags) patch.tags = [...new Set(input.tags.map(t => t.trim().toLowerCase()).filter(Boolean))];
    if (input.status) {
      patch.status = input.status;
      patch.resolvedAt = input.status === 'resolved' || input.status === 'closed' ? new Date() : null;
    }
    if (input.assigneeId !== undefined) {
      if (input.assigneeId) {
        const [u] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, input.assigneeId), eq(users.companyId, companyId)));
        if (!u) throw badRequest('ASSIGNEE_INVALID', 'That person is not on your team.');
      }
      patch.assignedAgentId = input.assigneeId;
    }
    await db.update(conversations).set(patch).where(and(eq(conversations.id, id), eq(conversations.companyId, companyId)));
    return this.get(companyId, id);
  }

  async addNote(companyId: string, userId: string, id: string, input: InboxNoteInput): Promise<InboxNoteItem> {
    const r = await this.row(companyId, id);
    const mentions = input.mentions.length
      ? (await db.select({ id: users.id }).from(users).where(and(eq(users.companyId, companyId), inArray(users.id, input.mentions)))).map(u => u.id)
      : [];
    const [note] = await db.insert(conversationNotes).values({ companyId, conversationId: id, authorId: userId, body: input.body, mentions }).returning();
    const [author] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
    const who = `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || 'a visitor';
    for (const uid of mentions.filter(m => m !== userId)) {
      await db.insert(notifications).values({
        companyId,
        userId: uid,
        type: 'mention',
        title: `${author?.name ?? 'A teammate'} mentioned you`,
        message: input.body.slice(0, 200),
        linkUrl: `/inbox?conversation=${id}`,
        metadata: { conversationId: id, contact: who },
      });
    }
    return { id: note!.id, authorId: userId, authorName: author?.name ?? null, body: note!.body, mentions, createdAt: note!.createdAt.toISOString() };
  }

  async counts(companyId: string): Promise<Record<string, number>> {
    const res = await db.execute(sql`SELECT c.status, count(*)::int AS n FROM conversations c WHERE c.company_id = ${companyId} AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id) GROUP BY c.status`);
    const out: Record<string, number> = {};
    for (const row of rowsOf(res) as unknown as Array<{ status: string; n: number }>) out[row.status] = row.n;
    return out;
  }
}

export const inboxService = new InboxService();
