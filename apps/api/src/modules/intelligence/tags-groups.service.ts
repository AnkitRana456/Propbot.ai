import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { ApplyTagInput, CreateGroupInput, CreateTagInput, GroupItem, GroupMemberItem, GroupRule, TagItem, UpdateGroupInput, UpdateTagInput } from '@propbot/shared';
import { db } from '../../db/index.js';
import { contacts, conversations, leads, segmentMembers, segments, taggings, tags } from '../../db/schema/index.js';
import { badRequest, conflict, notFound } from '../../utils/api-error.js';

const isUnique = (e: unknown) => /duplicate key|unique/i.test(String((e as Error)?.message ?? '') + String((e as { cause?: Error })?.cause?.message ?? ''));
const rowsOf = <T,>(res: unknown): T[] => (Array.isArray(res) ? res : ((res as { rows?: T[] }).rows ?? [])) as T[];

// ---------------------------------------------------------------- tags
type TagRow = typeof tags.$inferSelect;
const toTag = (r: TagRow, usage: number): TagItem => ({
  id: r.id,
  name: r.name,
  color: r.color,
  entityType: r.entityType as TagItem['entityType'],
  autoRule: (r.autoRule as TagItem['autoRule']) ?? null,
  usageCount: usage,
});

class TagsService {
  async list(companyId: string): Promise<TagItem[]> {
    const rows = await db.select().from(tags).where(eq(tags.companyId, companyId)).orderBy(tags.name);
    const counts = await db.select({ tagId: taggings.tagId, n: sql<number>`count(*)::int` }).from(taggings).where(eq(taggings.companyId, companyId)).groupBy(taggings.tagId);
    return rows.map(r => toTag(r, counts.find(c => c.tagId === r.id)?.n ?? 0));
  }

  private async mustGet(companyId: string, id: string): Promise<TagRow> {
    const [r] = await db.select().from(tags).where(and(eq(tags.id, id), eq(tags.companyId, companyId)));
    if (!r) throw notFound('Tag');
    return r;
  }

  async create(companyId: string, input: CreateTagInput): Promise<TagItem> {
    try {
      const [r] = await db.insert(tags).values({ companyId, name: input.name.trim(), color: input.color, entityType: input.entityType, autoRule: input.autoRule ?? null }).returning();
      return toTag(r!, 0);
    } catch (e) {
      if (isUnique(e)) throw conflict('TAG_EXISTS', `A ${input.entityType} tag named "${input.name}" already exists.`);
      throw e;
    }
  }

  async update(companyId: string, id: string, input: UpdateTagInput): Promise<TagItem> {
    await this.mustGet(companyId, id);
    try {
      const [r] = await db.update(tags).set({ ...(input.name ? { name: input.name.trim() } : {}), ...(input.color ? { color: input.color } : {}), ...(input.autoRule !== undefined ? { autoRule: input.autoRule } : {}) }).where(eq(tags.id, id)).returning();
      return toTag(r!, 0);
    } catch (e) {
      if (isUnique(e)) throw conflict('TAG_EXISTS', 'A tag with that name already exists.');
      throw e;
    }
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.mustGet(companyId, id);
    await db.delete(tags).where(eq(tags.id, id));
  }

  /** The ids must belong to this company; nothing is written otherwise. */
  private async assertEntities(companyId: string, type: string, ids: string[]) {
    const table = type === 'lead' ? leads : type === 'contact' ? contacts : conversations;
    const found = await db.select({ id: table.id }).from(table).where(and(eq(table.companyId, companyId), inArray(table.id, ids)));
    if (found.length !== new Set(ids).size) throw badRequest('TAG_ENTITY_INVALID', 'Some of the selected records do not exist.');
  }

  async apply(companyId: string, tagId: string, input: ApplyTagInput, source: 'manual' | 'ai' | 'rule' = 'manual'): Promise<{ applied: number }> {
    const tag = await this.mustGet(companyId, tagId);
    if (tag.entityType !== input.entityType) throw badRequest('TAG_TYPE_MISMATCH', `This tag is for ${tag.entityType}s.`);
    await this.assertEntities(companyId, input.entityType, input.entityIds);
    const res = await db
      .insert(taggings)
      .values([...new Set(input.entityIds)].map(entityId => ({ tagId, companyId, entityType: input.entityType, entityId, source })))
      .onConflictDoNothing()
      .returning({ id: taggings.entityId });
    return { applied: res.length };
  }

  async unapply(companyId: string, tagId: string, input: ApplyTagInput): Promise<{ removed: number }> {
    await this.mustGet(companyId, tagId);
    const res = await db
      .delete(taggings)
      .where(and(eq(taggings.tagId, tagId), eq(taggings.companyId, companyId), eq(taggings.entityType, input.entityType), inArray(taggings.entityId, input.entityIds)))
      .returning({ id: taggings.entityId });
    return { removed: res.length };
  }

  async forEntity(companyId: string, entityType: string, entityId: string) {
    return db
      .select({ id: tags.id, name: tags.name, color: tags.color })
      .from(taggings)
      .innerJoin(tags, eq(tags.id, taggings.tagId))
      .where(and(eq(taggings.companyId, companyId), eq(taggings.entityType, entityType), eq(taggings.entityId, entityId)));
  }

  /** Applies tags whose rule matches an AI label of this conversation (to the conversation, its lead or its contact). */
  async autoTag(companyId: string, conversationId: string, labels: string[]): Promise<number> {
    if (labels.length === 0) return 0;
    const rules = await db.select().from(tags).where(eq(tags.companyId, companyId));
    const matching = rules.filter(t => t.autoRule && labels.includes((t.autoRule as { aiLabel?: string }).aiLabel ?? '\0'));
    if (matching.length === 0) return 0;
    const [conv] = await db.select({ leadId: conversations.leadId, contactId: conversations.contactId }).from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.companyId, companyId)));
    if (!conv) return 0;
    let n = 0;
    for (const t of matching) {
      const entityId = t.entityType === 'conversation' ? conversationId : t.entityType === 'lead' ? conv.leadId : conv.contactId;
      if (!entityId) continue;
      const res = await db.insert(taggings).values({ tagId: t.id, companyId, entityType: t.entityType, entityId, source: 'ai' }).onConflictDoNothing().returning({ id: taggings.entityId });
      n += res.length;
    }
    return n;
  }
}

// ---------------------------------------------------------------- groups
const APPT_DONE = sql`('completed')`;

/** SQL condition for one rule over `leads l`. Values are always bound parameters. */
export function ruleSql(rule: GroupRule): SQL {
  const { field, op } = rule;
  const v = rule.value;
  const list = () => (Array.isArray(v) ? v.map(String) : v === undefined ? [] : [String(v)]);
  const num = (x: unknown) => {
    const n = Number(x);
    if (!Number.isFinite(n)) throw badRequest('GROUP_RULE_INVALID', `"${String(x)}" is not a number.`);
    return n;
  };
  const textCmp = (col: SQL): SQL => {
    switch (op) {
      case 'equals': return sql`lower(${col}) = lower(${String(v ?? '')})`;
      case 'not_equals': return sql`lower(coalesce(${col}, '')) <> lower(${String(v ?? '')})`;
      case 'in': return list().length ? sql`lower(${col}) IN (${sql.join(list().map(x => sql`lower(${x})`), sql`, `)})` : sql`false`;
      case 'contains': return sql`${col} ILIKE ${'%' + String(v ?? '').replace(/[%_\\]/g, m => '\\' + m) + '%'}`;
      default: throw badRequest('GROUP_RULE_INVALID', `Operator "${op}" does not work for ${field}.`);
    }
  };
  const numCmp = (col: SQL): SQL => {
    switch (op) {
      case 'gte': return sql`${col} >= ${num(v)}`;
      case 'lte': return sql`${col} <= ${num(v)}`;
      case 'equals': return sql`${col} = ${num(v)}`;
      case 'between': {
        const [lo, hi] = Array.isArray(v) ? v : [];
        return sql`${col} BETWEEN ${num(lo)} AND ${num(hi)}`;
      }
      default: throw badRequest('GROUP_RULE_INVALID', `Operator "${op}" does not work for ${field}.`);
    }
  };
  const exists = (inner: SQL): SQL => (op === 'is_false' ? sql`NOT EXISTS (${inner})` : sql`EXISTS (${inner})`);

  switch (field) {
    case 'status': return textCmp(sql`l.status`);
    case 'intent_label': return textCmp(sql`l.intent_label`);
    case 'source': return textCmp(sql`l.source`);
    case 'intent_score': return numCmp(sql`l.intent_score`);
    case 'created_days_ago': return op === 'lte' ? sql`l.created_at >= now() - make_interval(days => ${Math.round(num(v))})` : sql`l.created_at <= now() - make_interval(days => ${Math.round(num(v))})`;
    case 'has_visit': return exists(sql`SELECT 1 FROM appointments a WHERE a.lead_id = l.id AND a.status <> 'cancelled'`);
    case 'visit_completed': return exists(sql`SELECT 1 FROM appointments a WHERE a.lead_id = l.id AND a.status IN ${APPT_DONE}`);
    case 'has_tag':
      return exists(sql`SELECT 1 FROM taggings tg JOIN tags t ON t.id = tg.tag_id WHERE tg.entity_type = 'lead' AND tg.entity_id = l.id AND lower(t.name) = lower(${String(v ?? '')})`);
    case 'attribute': {
      if (!rule.key || !/^[a-z][a-z0-9_]{1,59}$/.test(rule.key)) throw badRequest('GROUP_RULE_INVALID', 'Choose a valid attribute key.');
      const raw = sql`(l.custom_fields->'attributes'->>${rule.key})`;
      if (op === 'gte' || op === 'lte' || op === 'between') return numCmp(sql`(CASE WHEN ${raw} ~ '^[0-9]+(\\.[0-9]+)?$' THEN ${raw}::numeric END)`);
      if (op === 'is_true') return sql`lower(coalesce(${raw}, '')) IN ('true','yes','1')`;
      if (op === 'is_false') return sql`lower(coalesce(${raw}, '')) NOT IN ('true','yes','1')`;
      return textCmp(raw);
    }
  }
}

type SegRow = typeof segments.$inferSelect;
const rulesOf = (s: SegRow): GroupRule[] => (((s.filterCriteria as { rules?: GroupRule[] } | null)?.rules ?? []) as GroupRule[]);

class GroupsService {
  private toItem(s: SegRow): GroupItem {
    return { id: s.id, name: s.name, description: s.description, rules: rulesOf(s), isDynamic: s.isDynamic, memberCount: s.cachedCount, refreshedAt: s.refreshedAt?.toISOString() ?? null };
  }

  private async mustGet(companyId: string, id: string): Promise<SegRow> {
    const [r] = await db.select().from(segments).where(and(eq(segments.id, id), eq(segments.companyId, companyId)));
    if (!r) throw notFound('Group');
    return r;
  }

  async list(companyId: string): Promise<GroupItem[]> {
    const rows = await db.select().from(segments).where(eq(segments.companyId, companyId)).orderBy(sql`${segments.createdAt} DESC`);
    return rows.map(r => this.toItem(r));
  }

  /** Counts leads matching the rules without saving anything. */
  async preview(companyId: string, rules: GroupRule[]): Promise<{ count: number }> {
    const where = sql.join([sql`l.company_id = ${companyId}`, sql`l.deleted_at IS NULL`, ...rules.map(ruleSql)], sql` AND `);
    const res = await db.execute(sql`SELECT count(DISTINCT l.contact_id)::int AS n FROM leads l WHERE ${where}`);
    return { count: rowsOf<{ n: number }>(res)[0]?.n ?? 0 };
  }

  async create(companyId: string, userId: string | null, input: CreateGroupInput): Promise<GroupItem> {
    await this.preview(companyId, input.rules); // validates every rule before saving
    const [r] = await db
      .insert(segments)
      .values({ companyId, name: input.name, description: input.description ?? null, filterCriteria: { rules: input.rules }, isDynamic: input.isDynamic, createdBy: userId })
      .returning();
    return this.refresh(companyId, r!.id);
  }

  async update(companyId: string, id: string, input: UpdateGroupInput): Promise<GroupItem> {
    const cur = await this.mustGet(companyId, id);
    if (input.rules) await this.preview(companyId, input.rules);
    await db
      .update(segments)
      .set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.isDynamic !== undefined ? { isDynamic: input.isDynamic } : {}),
        ...(input.rules ? { filterCriteria: { ...(cur.filterCriteria as object), rules: input.rules } } : {}),
        updatedAt: new Date(),
      })
      .where(eq(segments.id, id));
    return this.refresh(companyId, id);
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.mustGet(companyId, id);
    await db.delete(segments).where(eq(segments.id, id));
  }

  /** Re-evaluates the rules and replaces the stored membership. */
  async refresh(companyId: string, id: string): Promise<GroupItem> {
    const seg = await this.mustGet(companyId, id);
    const where = sql.join([sql`l.company_id = ${companyId}`, sql`l.deleted_at IS NULL`, ...rulesOf(seg).map(ruleSql)], sql` AND `);
    await db.transaction(async tx => {
      await tx.delete(segmentMembers).where(eq(segmentMembers.segmentId, id));
      await tx.execute(sql`
        INSERT INTO segment_members (segment_id, company_id, contact_id, lead_id)
        SELECT DISTINCT ON (l.contact_id) ${id}::uuid, ${companyId}::uuid, l.contact_id, l.id FROM leads l WHERE ${where} ORDER BY l.contact_id, l.created_at DESC`);
    });
    const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(segmentMembers).where(eq(segmentMembers.segmentId, id));
    const [r] = await db.update(segments).set({ cachedCount: n, refreshedAt: new Date() }).where(eq(segments.id, id)).returning();
    return this.toItem(r!);
  }

  async members(companyId: string, id: string, limit = 100): Promise<GroupMemberItem[]> {
    await this.mustGet(companyId, id);
    const rows = await db
      .select({ contactId: segmentMembers.contactId, leadId: segmentMembers.leadId, first: contacts.firstName, last: contacts.lastName, phone: contacts.phone, status: leads.status, intent: leads.intentLabel })
      .from(segmentMembers)
      .innerJoin(contacts, eq(contacts.id, segmentMembers.contactId))
      .leftJoin(leads, eq(leads.id, segmentMembers.leadId))
      .where(and(eq(segmentMembers.segmentId, id), eq(segmentMembers.companyId, companyId)))
      .limit(Math.min(limit, 500));
    return rows.map(r => ({ contactId: r.contactId, leadId: r.leadId, name: `${r.first} ${r.last ?? ''}`.trim(), phone: r.phone, status: r.status, intentLabel: r.intent }));
  }
}

export const tagsService = new TagsService();
export const groupsService = new GroupsService();
