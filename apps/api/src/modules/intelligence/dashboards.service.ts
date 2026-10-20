import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { CreateDashboardInput, CreateWidgetDefInput, DashboardItem, DashboardWidgetItem, MetricData, MetricKey } from '@propbot/shared';
import { db } from '../../db/index.js';
import { dashboardWidgets, dashboards } from '../../db/schema/index.js';
import { notFound } from '../../utils/api-error.js';

const rowsOf = <T,>(res: unknown): T[] => (Array.isArray(res) ? res : ((res as { rows?: T[] }).rows ?? [])) as T[];
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

type Series = Array<{ label: string; value: number }>;
const series = (rows: Array<{ label: string | null; n: number | string }>): MetricData => ({ kind: 'series', points: rows.map(r => ({ label: r.label ?? 'unknown', value: Number(r.n) })) });

/** The metric catalogue. Every query is scoped to the company and a day window; no SQL comes from the client. */
export async function computeMetric(companyId: string, metric: MetricKey, days: number): Promise<MetricData> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const q = async <T,>(query: ReturnType<typeof sql>) => rowsOf<T>(await db.execute(query));

  switch (metric) {
    case 'leads_total': {
      const [r] = await q<{ n: number }>(sql`SELECT count(*)::int AS n FROM leads WHERE company_id = ${companyId} AND deleted_at IS NULL AND created_at >= ${since}::timestamptz`);
      return { kind: 'number', value: r?.n ?? 0 };
    }
    case 'leads_by_source':
      return series(await q(sql`SELECT source AS label, count(*)::int AS n FROM leads WHERE company_id = ${companyId} AND deleted_at IS NULL AND created_at >= ${since}::timestamptz GROUP BY source ORDER BY n DESC LIMIT 12`));
    case 'leads_by_stage':
      return series(await q(sql`SELECT status AS label, count(*)::int AS n FROM leads WHERE company_id = ${companyId} AND deleted_at IS NULL AND created_at >= ${since}::timestamptz GROUP BY status ORDER BY n DESC`));
    case 'leads_over_time':
      return series(await q(sql`SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS label, count(*)::int AS n FROM leads WHERE company_id = ${companyId} AND deleted_at IS NULL AND created_at >= ${since}::timestamptz GROUP BY 1 ORDER BY 1`));
    case 'leads_by_agency_partner':
      return series(await q(sql`SELECT coalesce(nullif(utm_params->>'utm_agencypartner', ''), 'direct') AS label, count(*)::int AS n FROM leads WHERE company_id = ${companyId} AND deleted_at IS NULL AND created_at >= ${since}::timestamptz GROUP BY 1 ORDER BY n DESC LIMIT 12`));
    case 'visit_conversion': {
      const [r] = await q<{ total: number; visited: number }>(sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM appointments a WHERE a.lead_id = l.id AND a.status <> 'cancelled'))::int AS visited FROM leads l WHERE l.company_id = ${companyId} AND l.deleted_at IS NULL AND l.created_at >= ${since}::timestamptz`);
      return { kind: 'number', value: r && r.total ? Math.round((r.visited / r.total) * 100) : null, unit: '%' };
    }
    case 'visits_by_status':
      return series(await q(sql`SELECT status AS label, count(*)::int AS n FROM appointments WHERE company_id = ${companyId} AND scheduled_at >= ${since}::timestamptz GROUP BY status ORDER BY n DESC`));
    case 'first_response_minutes': {
      const [r] = await q<{ m: string | null }>(sql`SELECT round(avg(extract(epoch FROM (first_response_at - created_at)) / 60)::numeric, 1) AS m FROM conversations WHERE company_id = ${companyId} AND first_response_at IS NOT NULL AND created_at >= ${since}::timestamptz`);
      return { kind: 'number', value: num(r?.m), unit: 'min' };
    }
    case 'ai_resolution_rate': {
      const [r] = await q<{ total: number; ai: number }>(sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.sender_type = 'agent'))::int AS ai FROM conversations c WHERE c.company_id = ${companyId} AND c.created_at >= ${since}::timestamptz AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.sender_type = 'visitor')`);
      return { kind: 'number', value: r && r.total ? Math.round((r.ai / r.total) * 100) : null, unit: '%' };
    }
    case 'call_outcomes':
      return series(await q(sql`SELECT coalesce(outcome, status) AS label, count(*)::int AS n FROM voice_calls WHERE company_id = ${companyId} AND direction <> 'test' AND created_at >= ${since}::timestamptz GROUP BY 1 ORDER BY n DESC`));
    case 'campaign_performance':
      return series(await q(sql`SELECT name AS label, coalesce((stats->>'qualified')::int, 0) AS n FROM call_campaigns WHERE company_id = ${companyId} AND created_at >= ${since}::timestamptz ORDER BY n DESC LIMIT 10`));
    case 'csat_average': {
      const [r] = await q<{ a: string | null }>(sql`SELECT round(avg(r.score)::numeric, 2) AS a FROM survey_responses r JOIN surveys s ON s.id = r.survey_id WHERE r.company_id = ${companyId} AND s.kind = 'csat' AND r.score IS NOT NULL AND r.created_at >= ${since}::timestamptz`);
      return { kind: 'number', value: num(r?.a), unit: '/5' };
    }
    case 'funnel': {
      const [r] = await q<{ total: number; contacted: number; qualified: number; visit: number; won: number }>(sql`
        SELECT count(*)::int AS total,
          count(*) FILTER (WHERE status <> 'new')::int AS contacted,
          count(*) FILTER (WHERE status IN ('qualified','site_visit_scheduled','site_visit_done','negotiation','booked','converted'))::int AS qualified,
          count(*) FILTER (WHERE status IN ('site_visit_scheduled','site_visit_done','negotiation','booked','converted'))::int AS visit,
          count(*) FILTER (WHERE status IN ('booked','converted'))::int AS won
        FROM leads WHERE company_id = ${companyId} AND deleted_at IS NULL AND created_at >= ${since}::timestamptz`);
      const x = r ?? { total: 0, contacted: 0, qualified: 0, visit: 0, won: 0 };
      return { kind: 'series', points: [{ label: 'Leads', value: x.total }, { label: 'Contacted', value: x.contacted }, { label: 'Qualified', value: x.qualified }, { label: 'Site visit', value: x.visit }, { label: 'Booked', value: x.won }] satisfies Series };
    }
  }
}

type WRow = typeof dashboardWidgets.$inferSelect;
const toWidget = (w: WRow): DashboardWidgetItem => ({ id: w.id, type: w.type as DashboardWidgetItem['type'], title: w.title, config: w.config as DashboardWidgetItem['config'], layout: w.layout as DashboardWidgetItem['layout'] });

class DashboardsService {
  private async mustGet(companyId: string, id: string, userId?: string | null) {
    const [d] = await db.select().from(dashboards).where(and(eq(dashboards.id, id), eq(dashboards.companyId, companyId), isNull(dashboards.deletedAt)));
    if (!d) throw notFound('Dashboard');
    if (!d.isShared && d.createdBy && userId && d.createdBy !== userId) throw notFound('Dashboard');
    return d;
  }

  private async item(d: typeof dashboards.$inferSelect): Promise<DashboardItem> {
    const ws = await db.select().from(dashboardWidgets).where(eq(dashboardWidgets.dashboardId, d.id)).orderBy(dashboardWidgets.createdAt);
    return { id: d.id, name: d.name, description: d.description, isShared: d.isShared, isStarred: d.isStarred, createdBy: d.createdBy, widgets: ws.map(toWidget), createdAt: d.createdAt.toISOString() };
  }

  /** A person sees their own dashboards plus the ones shared with the company. */
  async list(companyId: string, userId: string | null): Promise<DashboardItem[]> {
    const rows = await db.select().from(dashboards).where(and(eq(dashboards.companyId, companyId), isNull(dashboards.deletedAt))).orderBy(desc(dashboards.isStarred), desc(dashboards.createdAt));
    return Promise.all(rows.filter(d => d.isShared || !d.createdBy || d.createdBy === userId).map(d => this.item(d)));
  }

  async get(companyId: string, userId: string | null, id: string) {
    return this.item(await this.mustGet(companyId, id, userId));
  }

  async create(companyId: string, userId: string | null, input: CreateDashboardInput) {
    const [d] = await db.insert(dashboards).values({ companyId, name: input.name, description: input.description ?? null, isShared: input.isShared, createdBy: userId }).returning();
    return this.item(d!);
  }

  async update(companyId: string, userId: string | null, id: string, input: Partial<CreateDashboardInput> & { isStarred?: boolean }) {
    const d = await this.mustGet(companyId, id, userId);
    if (d.createdBy && userId && d.createdBy !== userId) throw notFound('Dashboard');
    const [r] = await db.update(dashboards).set({ ...input, updatedAt: new Date() }).where(eq(dashboards.id, id)).returning();
    return this.item(r!);
  }

  async remove(companyId: string, userId: string | null, id: string) {
    const d = await this.mustGet(companyId, id, userId);
    if (d.createdBy && userId && d.createdBy !== userId) throw notFound('Dashboard');
    await db.update(dashboards).set({ deletedAt: new Date() }).where(eq(dashboards.id, id));
  }

  async addWidget(companyId: string, userId: string | null, id: string, input: CreateWidgetDefInput) {
    const d = await this.mustGet(companyId, id, userId);
    if (d.createdBy && userId && d.createdBy !== userId) throw notFound('Dashboard');
    const [w] = await db.insert(dashboardWidgets).values({ dashboardId: id, companyId, type: input.type, title: input.title, config: input.config, layout: input.layout }).returning();
    return toWidget(w!);
  }

  async removeWidget(companyId: string, userId: string | null, id: string, widgetId: string) {
    const d = await this.mustGet(companyId, id, userId);
    if (d.createdBy && userId && d.createdBy !== userId) throw notFound('Dashboard');
    const res = await db.delete(dashboardWidgets).where(and(eq(dashboardWidgets.id, widgetId), eq(dashboardWidgets.dashboardId, id))).returning({ id: dashboardWidgets.id });
    if (res.length === 0) throw notFound('Widget');
  }

  async widgetData(companyId: string, userId: string | null, id: string, widgetId: string): Promise<MetricData> {
    await this.mustGet(companyId, id, userId);
    const [w] = await db.select().from(dashboardWidgets).where(and(eq(dashboardWidgets.id, widgetId), eq(dashboardWidgets.dashboardId, id)));
    if (!w) throw notFound('Widget');
    const cfg = w.config as DashboardWidgetItem['config'];
    return computeMetric(companyId, cfg.metric, cfg.days ?? 30);
  }
}

export const dashboardsService = new DashboardsService();
