import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, CalendarX2, Inbox, RefreshCw, ShieldAlert, UserPlus, Users } from 'lucide-react';
import type { LeadItemResponse } from '@propbot/shared';
import { useAuth } from '../contexts/AuthContext.js';
import { useLeads } from '../services/leads.service.js';
import { useAppointments } from '../services/appointments.service.js';
import { usePendingApprovalsCount } from '../services/approvals.service.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Skeleton } from '../components/common/Skeleton.js';
import { AgentLeaderboard, KpiCard, LeadsByStatus, LeadsOverTime, NewestLeads, RangeSwitch, type Range } from '../components/dashboard/DeskDashboard.js';
import { LeadDetailDrawer } from '../components/leads/LeadDetailDrawer.js';
import { leadsPerDay } from '../lib/lead-stats.js';
import { formatDateTime } from '../lib/format.js';

/** Change of this range against the one before it, as a delta pill; null when there is no baseline. */
const delta = (cur: number, prev: number, range: number) => {
  if (prev === 0) return cur === 0 ? null : { text: `New in last ${range}d`, good: true };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { text: `${pct >= 0 ? '+' : ''}${pct}% vs prev ${range}d`, good: pct >= 0 };
};

export const DashboardPage: React.FC = () => {
  const { user, company } = useAuth();
  const [open, setOpen] = useState<LeadItemResponse | null>(null);
  const [range, setRange] = useState<Range>(30);
  const leadsQuery = useLeads({ limit: 200 });
  const visitsQuery = useAppointments({ date: 'upcoming', limit: 6 });
  const todayQuery = useAppointments({ date: 'today', limit: 50 });
  const { data: pendingApprovals } = usePendingApprovalsCount();

  const leads = useMemo(() => leadsQuery.data?.items ?? [], [leadsQuery.data]);
  // two ranges back to back, so each KPI can compare against the period before
  const series = useMemo(() => leadsPerDay(leads, range * 2), [leads, range]);
  const hotSeries = useMemo(() => leadsPerDay(leads.filter(l => l.intentLabel === 'hot'), range * 2), [leads, range]);
  const sum = (a: Array<{ count: number }>) => a.reduce((s, p) => s + p.count, 0);
  const newNow = sum(series.slice(-range)), newPrev = sum(series.slice(0, range));
  const hotNow = sum(hotSeries.slice(-range)), hotPrev = sum(hotSeries.slice(0, range));
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
      <header className="hero-band mb-6 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
        <div className="relative min-w-0">
          <p className="text-sm font-medium opacity-80">{company?.name ?? 'Your agency'} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
          <p className="mt-2 text-sm opacity-90">{loading ? 'Loading your pipeline' : `${hot} hot ${hot === 1 ? 'lead' : 'leads'} and ${todayQuery.data?.total ?? 0} ${todayQuery.data?.total === 1 ? 'visit' : 'visits'} today.`}</p>
        </div>
        <div className="relative flex shrink-0 flex-wrap items-center gap-2">
          <Link to="/inbox" className="hero-chip"><Inbox aria-hidden className="h-4 w-4" /> Open inbox</Link>
          <Link to="/leads" className="hero-chip"><Users aria-hidden className="h-4 w-4" /> View leads</Link>
          <button type="button" onClick={refresh} disabled={leadsQuery.isFetching} className="hero-chip disabled:opacity-60"><RefreshCw aria-hidden className={`h-4 w-4 ${leadsQuery.isFetching ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>
      </header>

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

      <div className="mb-3 flex items-center gap-3">
        <p className="flex-1 text-[12.5px] text-text-muted">Showing the last {range} days</p>
        <RangeSwitch value={range} onChange={setRange} />
      </div>

      <section aria-label="Key numbers" className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="New leads" value={newNow} delta={delta(newNow, newPrev, range)} spark={series.slice(-Math.min(range, 14)).map(p => p.count)} colour="var(--accent)" loading={loading} />
        <KpiCard label="Hot leads" value={hotNow} delta={delta(hotNow, hotPrev, range)} spark={hotSeries.slice(-Math.min(range, 14)).map(p => p.count)} colour="var(--success)" loading={loading} />
        <KpiCard label="Visits today" value={todayQuery.data?.total ?? 0} hint={`${visitsQuery.data?.total ?? 0} upcoming`} loading={todayQuery.isLoading} colour="var(--warning)" />
        <KpiCard label="Booked" value={booked} hint={leads.length ? `${Math.round((booked / leads.length) * 100)}% of loaded leads` : 'No leads yet'} loading={loading} colour="var(--brass)" />
      </section>

      <section className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <Card className="p-4 lg:col-span-8">
          <h2 className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] font-semibold text-text">
            <span className="flex-1">Leads over time</span>
            <span className="flex gap-3 text-[11.5px] font-normal text-text-muted">
              <span className="inline-flex items-center gap-1.5"><i aria-hidden className="h-2 w-2 rounded-sm bg-accent/40" />New</span>
              <span className="inline-flex items-center gap-1.5"><i aria-hidden className="h-2 w-2 rounded-sm bg-success" />Hot</span>
            </span>
          </h2>
          {loading ? <Skeleton className="h-52 w-full" /> : <LeadsOverTime leads={leads} range={range} />}
        </Card>
        <Card className="p-4 lg:col-span-4">
          <h2 className="flex items-center text-[13.5px] font-semibold text-text"><span className="flex-1">Leads by status</span><small className="text-xs font-normal text-text-muted">{leads.length} total</small></h2>
          {loading ? <Skeleton className="mt-3 h-52 w-full" /> : <LeadsByStatus leads={leads} />}
        </Card>
      </section>

      <section className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <Card className="p-4 lg:col-span-4">
          <h2 className="mb-3 flex items-center text-[13.5px] font-semibold text-text"><span className="flex-1">Agent leaderboard</span><small className="text-xs font-normal text-text-muted">by booked</small></h2>
          {loading ? <Skeleton className="h-40 w-full" /> : <AgentLeaderboard leads={leads} />}
        </Card>

        <Card className="p-4 lg:col-span-4">
          <h2 className="mb-2 flex items-center text-[13.5px] font-semibold text-text">
            <span className="flex-1">Newest leads</span>
            <Link to="/leads" className="text-xs font-semibold text-accent hover:underline">View all</Link>
          </h2>
          {loading ? <div className="space-y-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div> : <NewestLeads leads={leads} onOpen={setOpen} />}
        </Card>

        <Card className="p-4 lg:col-span-4">
          <h2 className="mb-2 flex items-center text-[13.5px] font-semibold text-text">
            <span className="flex-1">Upcoming visits</span>
            <Link to="/appointments" className="text-xs font-semibold text-accent hover:underline">Calendar</Link>
          </h2>
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
                    <span className="block truncate text-[12.5px] font-medium text-text">{v.leadName ?? 'Visitor'}</span>
                    <span className="block truncate text-[11.5px] text-text-muted">{v.projectName ?? 'Site visit'} · {formatDateTime(v.scheduledAt)}</span>
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
