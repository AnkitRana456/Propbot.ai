import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LeadItemResponse } from '@propbot/shared';
import { Card } from '../ui/Card.js';
import { StatusBadge, statusInfo, STATUS_KEYS, type LeadStatusKey } from '../ui/StatusBadge.js';
import { Skeleton } from '../common/Skeleton.js';
import { leadsBySource, leadsPerDay } from '../../lib/lead-stats.js';
import { SOURCE_COLOURS } from './OverviewCharts.js';
import { timeAgo } from '../../lib/format.js';

/* Overview widgets in the CustomerDesk style: range switch, KPI cards with delta pill + sparkline,
   bar+line chart with hover tooltip, status stacked bar, agent leaderboard, newest leads. All from real leads. */

export type Range = 7 | 30 | 90;
const AV = ['#e0e7ff', '#dcfce7', '#fef3c7', '#fce7f3', '#e0f2fe', '#ede9fe', '#ffedd5'];
const AVT = ['#3730a3', '#166534', '#92400e', '#9d174d', '#075985', '#5b21b6', '#9a3412'];
const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const initials = (n: string) => n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const statusColour = (k: LeadStatusKey) => `var(--status-${k}-fg)`;
const STATUS_LABEL: Record<LeadStatusKey, string> = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', 'site-visit': 'Site visit', negotiation: 'Negotiation', won: 'Booked / won', lost: 'Lost' };

export const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 28 }) => {
  const i = hash(name) % AV.length;
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full font-semibold" style={{ width: size, height: size, fontSize: size * 0.38, background: AV[i], color: AVT[i] }}>
      {initials(name || '?')}
    </span>
  );
};

export const RangeSwitch: React.FC<{ value: Range; onChange: (r: Range) => void }> = ({ value, onChange }) => (
  <div role="group" aria-label="Date range" className="inline-flex rounded-lg border border-border bg-surface p-0.5">
    {([7, 30, 90] as const).map(r => (
      <button key={r} type="button" aria-pressed={value === r} onClick={() => onChange(r)}
        className={`h-7 rounded-md px-3 text-xs font-semibold tabular-nums transition-colors ${value === r ? 'bg-accent-soft text-accent' : 'text-text-muted hover:text-text'}`}>
        {r}d
      </button>
    ))}
  </div>
);

const Spark: React.FC<{ data: number[]; colour: string }> = ({ data, colour }) => {
  if (data.length < 2) return null;
  const m = Math.max(...data), n = Math.min(...data);
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${i},${(24 - ((v - n) / (m - n || 1)) * 22).toFixed(1)}`).join('');
  return (
    <svg className="mt-3 block" width="100%" height="26" viewBox={`0 0 ${data.length - 1} 26`} preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke={colour} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
};

export const KpiCard: React.FC<{ label: string; value: React.ReactNode; delta?: { text: string; good: boolean } | null; hint?: string; spark?: number[]; colour: string; loading?: boolean }> = ({ label, value, delta, hint, spark, colour, loading }) => (
  <Card className="p-4">
    <p className="text-xs text-text-muted">{label}</p>
    {loading ? <Skeleton className="mt-2 h-8 w-20" /> : <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-text">{value}</p>}
    <div className="mt-1 min-h-[20px]">
      {!loading && delta && (
        <span className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-medium ${delta.good ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>{delta.text}</span>
      )}
      {!loading && !delta && hint && <span className="text-[11.5px] text-text-muted">{hint}</span>}
    </div>
    {!loading && spark && <Spark data={spark} colour={colour} />}
  </Card>
);

/** Daily bars (new leads) with a line (hot leads), hover highlights the day and shows a tooltip. */
export const LeadsOverTime: React.FC<{ leads: LeadItemResponse[]; range: Range }> = ({ leads, range }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hi, setHi] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 640));
    ro.observe(el);
    setW(el.clientWidth || 640);
    return () => ro.disconnect();
  }, []);
  const created = useMemo(() => leadsPerDay(leads, range), [leads, range]);
  const hot = useMemo(() => leadsPerDay(leads.filter(l => l.intentLabel === 'hot'), range), [leads, range]);
  // tall enough to match the status card beside it, so the row has no empty gap
  const H = 330, L = 28, R = 6, T = 10, B = 24, iw = Math.max(10, w - L - R), ih = H - T - B;
  const yMax = Math.max(4, Math.ceil(Math.max(...created.map(p => p.count), 1) / 4) * 4);
  const bw = iw / range;
  const x = (i: number) => L + i * bw + bw / 2;
  const y = (v: number) => T + ih - (v / yMax) * ih;
  const line = hot.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join('');
  const ticks = range === 7 ? [0, 2, 4, 6] : range === 30 ? [0, 7, 14, 21, 29] : [0, 30, 60, 89];
  const total = created.reduce((s, p) => s + p.count, 0);

  return (
    <div ref={wrap} className="relative" onPointerMove={e => { const r = wrap.current!.getBoundingClientRect(); setHi(Math.max(0, Math.min(range - 1, Math.floor((e.clientX - r.left - L) / bw)))); }} onPointerLeave={() => setHi(null)}>
      {total === 0 && <p className="absolute inset-x-0 top-16 text-center text-sm text-text-muted">No leads in the last {range} days yet.</p>}
      <svg width="100%" height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`New and hot leads per day, last ${range} days`} className="block overflow-visible">
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={L} x2={w - R} y1={y(yMax * f)} y2={y(yMax * f)} stroke="var(--border-subtle)" />
            <text x={0} y={y(yMax * f) + 4} fontSize="10.5" fill="var(--text-muted)">{Math.round(yMax * f)}</text>
          </g>
        ))}
        {created.map((p, i) => (
          <rect key={p.date} x={x(i) - Math.max(1.5, bw * 0.32)} y={y(p.count)} width={Math.max(3, bw * 0.64)} height={T + ih - y(p.count)} rx={Math.min(3, bw * 0.2)}
            fill="var(--accent)" opacity={hi === i ? 0.75 : 0.32} />
        ))}
        <path d={line} fill="none" stroke="var(--success)" strokeWidth="2" strokeLinejoin="round" />
        {hi != null && <circle cx={x(hi)} cy={y(hot[hi]!.count)} r="3.5" fill="var(--success)" stroke="var(--surface)" strokeWidth="2" />}
        {ticks.map(i => <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="var(--text-muted)">{created[i]?.label}</text>)}
      </svg>
      {hi != null && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[110%] whitespace-nowrap rounded-lg bg-text px-2.5 py-1.5 text-[11.5px] text-surface"
          style={{ left: Math.min(Math.max(x(hi), 80), w - 80), top: y(Math.max(created[hi]!.count, hot[hi]!.count)) }}>
          {created[hi]!.label} · <b>{created[hi]!.count}</b> new · <b>{hot[hi]!.count}</b> hot
        </div>
      )}
    </div>
  );
};

/** Stacked bar + clickable legend by pipeline stage, then the channel split. */
export const LeadsByStatus: React.FC<{ leads: LeadItemResponse[] }> = ({ leads }) => {
  const total = leads.length || 1;
  const byStatus = STATUS_KEYS.map(k => [k, leads.filter(l => statusInfo(l.status).key === k).length] as const).filter(([, n]) => n > 0);
  const bySource = leadsBySource(leads).slice(0, 4);
  return (
    <>
      <div className="mb-3.5 mt-1 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
        {byStatus.map(([k, n]) => <i key={k} title={`${STATUS_LABEL[k]}: ${n}`} style={{ width: `${(n / total) * 100}%`, background: statusColour(k) }} className="h-full transition-[width] duration-500" />)}
      </div>
      <ul className="space-y-0.5">
        {byStatus.map(([k, n]) => (
          <li key={k}>
            <Link to="/leads" className="flex items-center gap-2 rounded-md px-1 py-1 text-[12.5px] text-text hover:bg-surface-2">
              <i aria-hidden className="h-2 w-2 rounded-full" style={{ background: statusColour(k) }} />
              {STATUS_LABEL[k]}
              <b className="ml-auto font-medium tabular-nums">{n}</b>
              <small className="w-10 text-right text-text-muted">{Math.round((n / total) * 100)}%</small>
            </Link>
          </li>
        ))}
      </ul>
      <h3 className="mb-2 mt-4 text-[13.5px] font-semibold text-text">Channel</h3>
      <ul className="space-y-0.5">
        {bySource.map(s => (
          <li key={s.name} className="flex items-center gap-2 px-1 py-1 text-[12.5px] text-text">
            <i aria-hidden className="h-2 w-2 rounded-full" style={{ background: SOURCE_COLOURS[s.name] ?? 'var(--text-faint)' }} />
            {s.name}
            <b className="ml-auto font-medium tabular-nums">{s.value}</b>
            <small className="w-10 text-right text-text-muted">{Math.round((s.value / total) * 100)}%</small>
          </li>
        ))}
      </ul>
    </>
  );
};

/** Agents ranked by booked leads, with how many leads each holds. */
export const AgentLeaderboard: React.FC<{ leads: LeadItemResponse[] }> = ({ leads }) => {
  const rows = useMemo(() => {
    const m = new Map<string, { leads: number; booked: number }>();
    for (const l of leads) {
      if (!l.assignedAgentName) continue;
      const r = m.get(l.assignedAgentName) ?? { leads: 0, booked: 0 };
      r.leads++;
      if (l.status === 'booked' || l.status === 'converted') r.booked++;
      m.set(l.assignedAgentName, r);
    }
    return [...m.entries()].map(([name, r]) => ({ name, ...r })).sort((a, b) => b.booked - a.booked || b.leads - a.leads).slice(0, 5);
  }, [leads]);
  const max = Math.max(1, ...rows.map(r => r.leads));
  if (!rows.length) return <p className="py-10 text-center text-sm text-text-muted">Assign leads to agents to see who is closing.</p>;
  return (
    <div>
      <div className="grid grid-cols-[1fr_64px_64px] gap-2 pb-1 text-[11px] text-text-muted"><span>Agent</span><span className="text-right">Leads</span><span className="text-right">Booked</span></div>
      {rows.map(r => (
        <div key={r.name} className="grid grid-cols-[1fr_64px_64px] items-center gap-x-2 border-t border-border-subtle py-2 text-[12.5px] first-of-type:border-t-0">
          <span className="flex min-w-0 items-center gap-2"><Avatar name={r.name} size={24} /><span className="truncate text-text">{r.name}</span></span>
          <span className="text-right tabular-nums text-text-muted">{r.leads}</span>
          <span className="text-right tabular-nums text-text-muted">{r.booked}</span>
          <span className="col-span-3 mt-1.5 h-1 rounded-full bg-surface-2"><i className="block h-full rounded-full bg-accent" style={{ width: `${(r.leads / max) * 100}%` }} /></span>
        </div>
      ))}
    </div>
  );
};

/** The six newest leads; a click opens the lead. */
export const NewestLeads: React.FC<{ leads: LeadItemResponse[]; onOpen: (l: LeadItemResponse) => void }> = ({ leads, onOpen }) => {
  const recent = useMemo(() => [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6), [leads]);
  if (!recent.length) return <p className="py-10 text-center text-sm text-text-muted">New leads show up here as they arrive.</p>;
  return (
    <ul>
      {recent.map(l => (
        <li key={l.id}>
          <button type="button" onClick={() => onOpen(l)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-lg px-1.5 py-2 text-left hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <Avatar name={l.name} />
            <span className="min-w-0">
              <b className="block truncate text-[12.5px] font-medium text-text">{l.name}</b>
              <small className="block truncate text-[11.5px] text-text-muted">{[l.buyerDna?.bhk?.[0], l.buyerDna?.localities?.[0]].filter(Boolean).join(' · ') || l.phone} · {timeAgo(l.createdAt)}</small>
            </span>
            <StatusBadge status={l.status} />
          </button>
        </li>
      ))}
    </ul>
  );
};
