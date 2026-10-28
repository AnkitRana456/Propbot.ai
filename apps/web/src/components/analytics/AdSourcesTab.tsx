import React from 'react';
import type { AdSourcesResponse } from '../../services/analytics.service.js';

interface Props {
  data?: AdSourcesResponse;
  isLoading: boolean;
}

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 truncate font-mono text-xs text-text capitalize">{label}</span>
      <div className="flex-1 bg-border rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-xs text-text-muted tabular-nums">{count}</span>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = rows[0]?.count ?? 0;
  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-text-muted">No data yet — start capturing leads with UTM links.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <Bar key={r.label} label={r.label} count={r.count} max={max} />
          ))}
        </div>
      )}
    </div>
  );
}

export const AdSourcesTab: React.FC<Props> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-xl border border-border bg-surface p-5 h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">
        Breakdown of leads by ad source (UTM), device type, and top cities — populated automatically from every lead capture with UTM parameters.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Section title="By Ad Source (utm_source)" rows={data?.bySource ?? []} />
        <Section title="By Device Type" rows={data?.byDevice ?? []} />
        <Section title="By City" rows={data?.byCity ?? []} />
      </div>
    </div>
  );
};
