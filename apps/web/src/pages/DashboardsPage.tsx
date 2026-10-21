import React, { useState } from 'react';
import { BarChart3, Plus, Trash2 } from 'lucide-react';
import { METRIC_KEYS, WIDGET_TYPES, type DashboardItem, type DashboardWidgetItem, type MetricData, type MetricKey } from '@propbot/shared';
import { useAddWidget, useCreateDashboard, useDashboards, useDeleteDashboard, useRemoveWidget, useWidgetData } from '../services/intelligence.service.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Skeleton } from '../components/common/Skeleton.js';

const METRIC_LABEL: Record<MetricKey, string> = {
  leads_total: 'New leads',
  leads_by_source: 'Leads by source',
  leads_by_stage: 'Leads by stage',
  leads_over_time: 'Leads per day',
  leads_by_agency_partner: 'Leads by agency partner',
  visit_conversion: 'Lead to site-visit rate',
  visits_by_status: 'Site visits by status',
  first_response_minutes: 'Average first response (min)',
  ai_resolution_rate: 'Chats resolved by AI only',
  call_outcomes: 'Call outcomes',
  campaign_performance: 'Calling campaigns (qualified)',
  csat_average: 'Customer satisfaction',
  funnel: 'Sales funnel',
};
const inputCls = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white';
const errMsg = (e: unknown, f: string) => (e instanceof Error ? e.message : f);
const PALETTE = ['var(--accent)', '#2563eb', '#D97706', '#7c3aed', '#db2777', '#0891b2', '#16a34a', '#64748b'];

const Chart: React.FC<{ type: DashboardWidgetItem['type']; data: MetricData }> = ({ type, data }) => {
  if (data.kind === 'number') {
    return <p className="font-serif text-4xl font-bold text-slate-900 dark:text-white">{data.value === null ? '-' : data.value}<span className="ml-1 text-sm font-normal text-slate-400">{data.value === null ? '' : data.unit ?? ''}</span></p>;
  }
  const pts = data.points;
  if (pts.length === 0) return <p className="text-xs text-slate-400">No data for this period.</p>;
  const max = Math.max(1, ...pts.map(p => p.value));
  const total = pts.reduce((a, p) => a + p.value, 0) || 1;
  if (type === 'line') {
    const w = 260;
    const h = 90;
    const step = pts.length > 1 ? w / (pts.length - 1) : w;
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - (p.value / max) * (h - 8) - 4).toFixed(1)}`).join(' ');
    return <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Line chart"><path d={path} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2" />{pts.map((p, i) => <circle key={i} cx={i * step} cy={h - (p.value / max) * (h - 8) - 4} r="2.5" style={{ fill: 'var(--accent)' }}><title>{`${p.label}: ${p.value}`}</title></circle>)}</svg>;
  }
  if (type === 'donut') {
    let acc = 0;
    return (
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90" role="img" aria-label="Donut chart">
          {pts.map((p, i) => {
            const frac = (p.value / total) * 100;
            const el = <circle key={i} cx="18" cy="18" r="15.9" fill="none" style={{ stroke: PALETTE[i % PALETTE.length] }} strokeWidth="4" strokeDasharray={`${frac} ${100 - frac}`} strokeDashoffset={-acc}><title>{`${p.label}: ${p.value}`}</title></circle>;
            acc += frac;
            return el;
          })}
        </svg>
        <ul className="space-y-0.5 text-[11px]">{pts.map((p, i) => <li key={i} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{p.label.replace(/_/g, ' ')} <b>{p.value}</b></li>)}</ul>
      </div>
    );
  }
  if (type === 'table') {
    return <table className="w-full text-xs"><tbody>{pts.map((p, i) => <tr key={i} className="border-b border-slate-100 dark:border-slate-800"><td className="py-1 text-slate-600 dark:text-slate-300">{p.label.replace(/_/g, ' ')}</td><td className="py-1 text-right font-semibold">{p.value}</td></tr>)}</tbody></table>;
  }
  // bar + funnel: horizontal bars (funnel scales to the first step)
  const base = type === 'funnel' ? Math.max(1, pts[0]!.value) : max;
  return (
    <ul className="space-y-1.5">
      {pts.map((p, i) => (
        <li key={i} className="flex items-center gap-2 text-[11px]">
          <span className="w-24 shrink-0 truncate text-slate-600 dark:text-slate-300">{p.label.replace(/_/g, ' ')}</span>
          <span className="h-3 rounded bg-accent" style={{ width: `${Math.max(2, (p.value / base) * 100)}%`, opacity: type === 'funnel' ? 1 - i * 0.12 : 1 }} />
          <b>{p.value}</b>
        </li>
      ))}
    </ul>
  );
};

const WidgetCard: React.FC<{ dashboard: DashboardItem; widget: DashboardWidgetItem }> = ({ dashboard, widget }) => {
  const { data, isLoading, error } = useWidgetData(dashboard.id, widget.id);
  const remove = useRemoveWidget();
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-2"><h3 className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{widget.title}</h3><button type="button" aria-label={`Remove ${widget.title}`} onClick={() => void remove.mutateAsync({ id: dashboard.id, widgetId: widget.id })} className="text-slate-300 hover:text-rose-600 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button></div>
      {isLoading ? <Skeleton className="h-16 w-full" /> : error || !data ? <p className="text-xs text-rose-600" role="alert">{error?.message ?? 'No data'}</p> : <Chart type={widget.type} data={data} />}
      <p className="mt-2 text-[10px] text-slate-400">Last {widget.config.days} days</p>
    </div>
  );
};

export const DashboardsPage: React.FC = () => {
  const { data, isLoading, error } = useDashboards();
  const create = useCreateDashboard();
  const del = useDeleteDashboard();
  const addWidget = useAddWidget();
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [w, setW] = useState<{ type: DashboardWidgetItem['type']; metric: MetricKey; days: number }>({ type: 'bar', metric: 'leads_by_source', days: 30 });
  const [err, setErr] = useState<string | null>(null);
  const dashboards = data ?? [];
  const current = dashboards.find(d => d.id === selected) ?? dashboards[0];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboards</h1><p className="mt-1 text-xs text-slate-500 sm:text-sm">Build your own views from ready-made metrics. Share them with your team.</p></div>
        <form onSubmit={e => { e.preventDefault(); setErr(null); create.mutateAsync({ name, isShared: shared }).then(d => { setName(''); setSelected(d.id); }, x => setErr(errMsg(x, 'Could not create the dashboard.'))); }} className="flex flex-wrap items-center gap-2">
          <input aria-label="New dashboard name" required minLength={2} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Weekly review" className={inputCls} />
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} /> Share with team</label>
          <button type="submit" disabled={create.isPending} className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white cursor-pointer"><Plus className="h-4 w-4" /> Dashboard</button>
        </form>
      </div>
      {(error || err) && <p className="text-sm text-rose-600" role="alert">{err ?? error?.message}</p>}
      {isLoading ? <Skeleton className="h-40 w-full" /> : dashboards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><EmptyState icon={<BarChart3 className="h-7 w-7" />} title="No dashboards yet" description="Create one, then add charts for leads, visits, calls and satisfaction." /></div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2" role="tablist">
            {dashboards.map(d => <button key={d.id} role="tab" aria-selected={current?.id === d.id} type="button" onClick={() => setSelected(d.id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer ${current?.id === d.id ? 'bg-slate-900 text-white dark:bg-slate-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{d.name}{d.isShared ? ' · shared' : ''}</button>)}
            {current && <button type="button" aria-label={`Delete dashboard ${current.name}`} onClick={() => window.confirm(`Delete "${current.name}"?`) && void del.mutateAsync(current.id).then(() => setSelected(null), x => setErr(errMsg(x, 'Could not delete.')))} className="ml-auto text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>}
          </div>
          {current && (
            <>
              <form onSubmit={e => { e.preventDefault(); setErr(null); addWidget.mutateAsync({ id: current.id, input: { type: w.type, title: METRIC_LABEL[w.metric], config: { metric: w.metric, days: w.days }, layout: { x: 0, y: 0, w: 4, h: 2 } } }).catch(x => setErr(errMsg(x, 'Could not add the chart.'))); }} className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <select aria-label="Metric" value={w.metric} onChange={e => setW({ ...w, metric: e.target.value as MetricKey })} className={inputCls}>{METRIC_KEYS.map(m => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}</select>
                <select aria-label="Chart type" value={w.type} onChange={e => setW({ ...w, type: e.target.value as typeof w.type })} className={inputCls}>{WIDGET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
                <select aria-label="Period" value={w.days} onChange={e => setW({ ...w, days: Number(e.target.value) })} className={inputCls}>{[7, 30, 90, 365].map(d => <option key={d} value={d}>Last {d} days</option>)}</select>
                <button type="submit" disabled={addWidget.isPending} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white dark:bg-slate-700 cursor-pointer">Add chart</button>
              </form>
              {current.widgets.length === 0 ? <p className="text-xs text-slate-400">This dashboard is empty. Pick a metric above and add your first chart.</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{current.widgets.map(wd => <WidgetCard key={wd.id} dashboard={current} widget={wd} />)}</div>}
            </>
          )}
        </>
      )}
    </div>
  );
};
