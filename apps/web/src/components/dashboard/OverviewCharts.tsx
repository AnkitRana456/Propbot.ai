import React from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** Colours come from CSS variables, so charts follow the light and dark theme without a re-render. */
export const SOURCE_COLOURS: Record<string, string> = {
  'Web chatbot': 'var(--accent)',
  WhatsApp: 'var(--status-won-fg)',
  Form: 'var(--brass)',
  Other: 'var(--text-muted)',
};

const tooltipStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 12,
};

export const Sparkline: React.FC<{ data: number[]; label: string }> = ({ data, label }) => (
  <div role="img" aria-label={label} className="h-8 w-24">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="v" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export const LeadsLineChart: React.FC<{ data: Array<{ label: string; count: number }> }> = ({ data }) => (
  <div role="img" aria-label={`Leads per day for the last ${data.length} days. ${data.reduce((s, d) => s + d.count, 0)} in total.`} className="h-64 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={32} />
        <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--border)' }} formatter={(v: number) => [v, 'Leads']} />
        <Area type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2} fill="url(#leadsFill)" />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export const SourceDonut: React.FC<{ data: Array<{ name: string; value: number }> }> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div role="img" aria-label={`Leads by source: ${data.map(d => `${d.name} ${d.value}`).join(', ')}`} className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
              {data.map(d => <Cell key={d.name} fill={SOURCE_COLOURS[d.name] ?? 'var(--text-muted)'} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-text">{total}</span>
          <span className="text-xs text-text-muted">leads</span>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {data.map(d => (
          <li key={d.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-text">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: SOURCE_COLOURS[d.name] ?? 'var(--text-muted)' }} />
              {d.name}
            </span>
            <span className="tabular-nums text-text-muted">{d.value} · {total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
