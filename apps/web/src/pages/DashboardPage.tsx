import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, CalendarX2, Inbox, RefreshCw, ShieldAlert, TrendingDown, TrendingUp, UserPlus } from 'lucide-react';
import type { LeadItemResponse } from '@propbot/shared';
import { useAuth } from '../contexts/AuthContext.js';
import { useLeads } from '../services/leads.service.js';
import { useAppointments } from '../services/appointments.service.js';
import { usePendingApprovalsCount } from '../services/approvals.service.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { Skeleton } from '../components/common/Skeleton.js';
import { LeadsLineChart, SourceDonut, Sparkline } from '../components/dashboard/OverviewCharts.js';
import { LeadDetailDrawer } from '../components/leads/LeadDetailDrawer.js';
import { leadsBySource, leadsPerDay, trendPercent } from '../lib/lead-stats.js';
import { formatDateTime, timeAgo } from '../lib/format.js';

const Trend: React.FC<{ pct: number | null }> = ({ pct }) => {
  if (pct === null) return <span className="text-xs text-text-muted">New this period</span>;
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? 'text-success' : 'text-danger'}`}>
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {up ? '+' : ''}{pct}% <span className="font-normal text-text-muted">vs previous 7 days</span>
    </span>
  );
};

const StatCard: React.FC<{ label: string; value: number | string; trend?: number | null; spark?: number[]; loading: boolean; hint?: string }> = ({ label, value, trend, spark, loading, hint }) => (
  <Card className="p-5">
    <p className="text-sm font-medium text-text-muted">{label}</p>
    <div className="mt-2 flex items-end justify-between gap-3">
      {loading ? <Skeleton className="h-9 w-16" /> : <p className="text-3xl font-bold tabular-nums tracking-tight text-text">{value}</p>}
      {spark && !loading && <Sparkline data={spark} label={`${label} trend, last 14 days`} />}
    </div>
    <div className="mt-2 min-h-[1rem]">{loading ? null : trend !== undefined ? <Trend pct={trend} /> : <span className="text-xs text-text-muted">{hint}</span>}</div>
  </Card>
);

export const DashboardPage: React.FC = () => {
  const { user, company } = useAuth();
  const [open, setOpen] = useState<LeadItemResponse | null>(null);
  const leadsQuery = useLeads({ limit: 200 });
  const visitsQuery = useAppointments({ date: 'upcoming', limit: 6 });
  const todayQuery = useAppointments({ date: 'today', limit: 50 });
  const { data: pendingApprovals } = usePendingApprovalsCount();

  const leads = useMemo(() => leadsQuery.data?.items ?? [], [leadsQuery.data]);
  const series = useMemo(() => leadsPerDay(leads, 30), [leads]);
  const sources = useMemo(() => leadsBySource(leads), [leads]);
  const last30 = series.reduce((s, p) => s + p.count, 0);
  const booked = leads.filter(l => l.status === 'booked' || l.status === 'converted').length;
  const hot = leads.filter(l => l.intentLabel === 'hot').length;
  const visits = visitsQuery.data?.items ?? [];
  const loading = leadsQuery.isLoading;
  const firstName = user?.name?.split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const refresh = () => void Promise.all([leadsQuery.refetch(), visitsQuery.refetch(), todayQuery.refetch()]);

  return (
    <div>
      <PageHeader
        title={`${greeting}${firstName ? `, ${firstName}` : ''}`}
        description={`${company?.name ?? 'Your agency'} · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        action={
          <Button variant="outline" size="sm" onClick={refresh} disabled={leadsQuery.isFetching} leftIcon={<RefreshCw className={`h-4 w-4 ${leadsQuery.isFetching ? 'animate-spin' : ''}`} />}>
            Refresh
          </Button>
        }
      />

      {(pendingApprovals ?? 0) > 0 && (
        <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-text">
            <ShieldAlert aria-hidden className="h-5 w-5 text-danger" />
            {pendingApprovals} AI action{pendingApprovals === 1 ? '' : 's'} waiting for your approval
          </p>
          <Link to="/approvals" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
            Review <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
      )}

      {leadsQuery.isError && (
        <div role="alert" className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-text">
          Could not load your leads. {leadsQuery.error.message}
          <Button size="sm" variant="outline" onClick={refresh}>Retry</Button>
        </div>
      )}

      <section aria-label="Key numbers" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Leads (last 30 days)" value={last30} trend={trendPercent(series)} spark={series.slice(-14).map(p => p.count)} loading={loading} />
        <StatCard label="Total leads" value={leadsQuery.data?.total ?? 0} hint={`${hot} hot right now`} loading={loading} />
        <StatCard label="Visits today" value={todayQuery.data?.total ?? 0} hint={`${visitsQuery.data?.total ?? 0} upcoming`} loading={todayQuery.isLoading} />
        <StatCard label="Booked" value={booked} hint={leads.length ? `${Math.round((booked / leads.length) * 100)}% of loaded leads` : 'No leads yet'} loading={loading} />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-base font-semibold text-text">Leads, last 30 days</h2>
          <p className="mb-3 text-xs text-text-muted">New leads captured per day</p>
          {loading ? <Skeleton className="h-64 w-full" /> : last30 === 0 ? <p className="py-16 text-center text-sm text-text-muted">No leads in the last 30 days yet.</p> : <LeadsLineChart data={series} />}
        </Card>
        <Card className="p-5">
          <h2 className="text-base font-semibold text-text">Leads by source</h2>
          <p className="mb-3 text-xs text-text-muted">Where enquiries come from</p>
          {loading ? <Skeleton className="h-44 w-full" /> : sources.length === 0 ? <p className="py-16 text-center text-sm text-text-muted">Nothing to show yet.</p> : <SourceDonut data={sources} />}
        </Card>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-text">Recent leads</h2>
            <Link to="/leads" className="text-sm font-semibold text-accent hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : leads.length === 0 ? (
            <p className="flex items-center gap-2 py-8 text-sm text-text-muted"><Inbox aria-hidden className="h-4 w-4" /> New leads show up here as they arrive.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {[...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6).map(l => (
                <li key={l.id}>
                  <button type="button" onClick={() => setOpen(l)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                      {l.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text">{l.name}</span>
                      <span className="block truncate text-xs text-text-muted">{timeAgo(l.createdAt)}</span>
                    </span>
                    <StatusBadge status={l.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-text">Upcoming visits</h2>
            <Link to="/appointments" className="text-sm font-semibold text-accent hover:underline">Calendar</Link>
          </div>
          {visitsQuery.isLoading ? (
            <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : visits.length === 0 ? (
            <p className="flex items-center gap-2 py-8 text-sm text-text-muted"><CalendarX2 aria-hidden className="h-4 w-4" /> No visits booked. Your chatbot will add them here.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {visits.map(v => (
                <li key={v.id} className="flex items-center gap-3 py-2.5">
                  <CalendarCheck aria-hidden className="h-5 w-5 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">{v.leadName ?? 'Visitor'}</span>
                    <span className="block truncate text-xs text-text-muted">{v.projectName ?? 'Site visit'} · {formatDateTime(v.scheduledAt)}</span>
                  </span>
                  <span className="text-xs capitalize text-text-muted">{v.status.replace('_', ' ')}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <p className="mt-6 flex items-center gap-2 text-xs text-text-muted">
        <UserPlus aria-hidden className="h-3.5 w-3.5" /> Charts use your most recent 200 leads.
      </p>

      <LeadDetailDrawer lead={open} isOpen={Boolean(open)} onClose={() => setOpen(null)} />
    </div>
  );
};

export default DashboardPage;
