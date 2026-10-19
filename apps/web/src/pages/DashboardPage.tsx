import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ShieldAlert, ArrowRight, Clock, Building, TrendingUp, Target, Eye, Zap } from 'lucide-react';
import type { LeadItemResponse } from '@propbot/shared';
import { useAuth } from '../contexts/AuthContext.js';
import { fetchDashboardStats, fetchRecentLeads } from '../services/dashboard.service.js';
import { usePendingApprovalsCount } from '../services/approvals.service.js';
import { RecentLeads } from '../components/dashboard/RecentLeads.js';
import { TodaySlaQueue } from '../components/dashboard/TodaySlaQueue.js';
import { LeadDetailDrawer } from '../components/leads/LeadDetailDrawer.js';

/* ──── Animated Counter ──── */
const AnimatedNumber: React.FC<{ target: number; prefix?: string; suffix?: string; duration?: number }> = ({
  target, prefix = '', suffix = '', duration = 1200,
}) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);

  return <span ref={ref}>{prefix}{typeof target === 'number' && target % 1 !== 0 ? count.toFixed(1) : count}{suffix}</span>;
};

export const DashboardPage: React.FC = () => {
  const { user, company } = useAuth();
  const [selectedLead, setSelectedLead] = useState<LeadItemResponse | null>(null);

  const {
    data: stats,
    refetch: refetchStats,
    isFetching: isStatsFetching,
  } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 60 * 1000,
  });

  const {
    data: recentLeads,
    isLoading: isLeadsLoading,
    refetch: refetchLeads,
  } = useQuery({
    queryKey: ['recent-leads'],
    queryFn: fetchRecentLeads,
    staleTime: 60 * 1000,
  });

  const { data: pendingApprovalsCount } = usePendingApprovalsCount();

  // Dynamic greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'Rahul';

  const statCards = [
    {
      label: 'Active Qualified Leads',
      value: stats?.totalLeads || 48,
      suffix: '',
      change: '+14.2%',
      changeTone: 'text-[var(--success)]',
      sub: 'vs prev month',
      icon: Target,
      iconBg: 'from-[var(--accent)] to-[var(--accent-hover)]',
    },
    {
      label: "Today's Site Visits",
      value: stats?.todayVisits !== undefined ? stats.todayVisits : 4,
      suffix: '',
      change: '3 completed',
      changeTone: 'text-[var(--brass)]',
      sub: '• 1 upcoming',
      icon: Eye,
      iconBg: 'from-[var(--brass)] to-[#8B6914]',
    },
    {
      label: 'Pipeline Value',
      value: 84.5,
      prefix: '₹',
      suffix: ' Cr',
      change: '+₹12.4 Cr',
      changeTone: 'text-[var(--success)]',
      sub: 'in negotiation',
      icon: TrendingUp,
      iconBg: 'from-[var(--success)] to-[#1E4038]',
    },
    {
      label: 'Visit to Booking',
      value: 27.8,
      suffix: '%',
      change: '+3.5%',
      changeTone: 'text-[var(--success)]',
      sub: 'top quartile',
      icon: Zap,
      iconBg: 'from-[#6B5B2B] to-[var(--brass)]',
    },
  ];

  const funnelStages = [
    { name: 'New Inbound', count: 48, value: '₹112 Cr', pct: 100, color: 'from-[var(--accent)] to-[var(--accent-hover)]' },
    { name: 'DNA Qualified', count: 32, value: '₹76 Cr', pct: 67, color: 'from-[var(--brass)] to-[#8B6914]' },
    { name: 'Site Visit Scheduled', count: 18, value: '₹44 Cr', pct: 38, color: 'from-[var(--success)] to-[#1E4038]' },
    { name: 'In Negotiation', count: 8, value: '₹21 Cr', pct: 17, color: 'from-[#A9822B] to-[#6B5B2B]' },
    { name: 'Booking Confirmed', count: 5, value: '₹14 Cr', pct: 10, color: 'from-[var(--success)] to-[#2F5D50]' },
  ];

  const todayVisits = [
    {
      id: 'v1', time: '10:30 AM', buyer: 'Vikram Mehta',
      project: 'Prestige Lakeside Habitat', unit: 'Tower B &bull; 3BHK (1,850 sq.ft)',
      agent: 'Anand Kumar', status: 'Completed',
      statusTone: 'bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success)]/20',
    },
    {
      id: 'v2', time: '01:15 PM', buyer: 'Priya Sundaram',
      project: 'Sobha Dream Acres', unit: 'Wing C &bull; 2BHK (1,220 sq.ft)',
      agent: 'Neha Gupta', status: 'In Progress',
      statusTone: 'bg-[var(--brass-glow)] text-[var(--brass)] border border-[var(--brass)]/20',
    },
    {
      id: 'v3', time: '03:45 PM', buyer: 'Rajesh & Suman Nambiar',
      project: 'Godrej Woodsman Estate', unit: 'Villa 14 &bull; 4BHK Duplex',
      agent: 'Rahul Verma', status: 'Confirmed',
      statusTone: 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/20',
    },
    {
      id: 'v4', time: '05:30 PM', buyer: 'Arjun Singhania',
      project: 'Brigade Horizon', unit: 'Penthouse 1202 &bull; 4BHK',
      agent: 'Neha Gupta', status: 'Scheduled',
      statusTone: 'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Pending Safety Approvals Banner */}
      {(pendingApprovalsCount ?? 0) > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-[10px] border border-[var(--danger)]/40 bg-gradient-to-r from-[var(--surface)] to-[var(--surface-2)] p-4 text-[var(--text)] shadow-[var(--shadow-sm)] animate-fade-in-down">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--danger)]/10 border border-[var(--danger)]/20">
              <ShieldAlert className="h-4.5 w-4.5 text-[var(--danger)]" />
            </div>
            <div>
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--danger)]">
                {pendingApprovalsCount} AI Action{pendingApprovalsCount === 1 ? '' : 's'} Awaiting Safety Approval
              </p>
              <p className="text-[11px] text-[var(--text-muted)] font-sans mt-0.5">
                Price concessions or possession commitments placed in the Tier-2 human verification queue.
              </p>
            </div>
          </div>
          <Link
            to="/approvals"
            className="btn-terracotta px-4 py-2 text-xs font-semibold shrink-0 inline-flex items-center gap-1.5"
          >
            <span>Review Queue</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* 1. Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 page-header-gradient animate-fade-in-up">
        <div>
          <h1 className="font-serif text-3xl sm:text-[40px] text-[var(--text)] font-normal tracking-tight leading-tight">
            {greeting}, <span className="text-[var(--accent)]">{firstName}</span>
          </h1>
          <p className="text-[11px] font-mono text-[var(--text-faint)] mt-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] shadow-[0_0_6px_var(--success)]" />
            {company?.name || 'Prestige Realty'} &bull; Architectural Ledger &bull;{' '}
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <button
          onClick={() => { refetchStats(); refetchLeads(); }}
          disabled={isStatsFetching}
          className="btn-ink-outline px-4 py-2 text-xs font-mono inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isStatsFetching ? 'animate-spin' : ''}`} />
          <span>Sync Ledger</span>
        </button>
      </div>

      {/* 2. Stat Cards — 3D Elevated with Icons */}
      <section aria-label="Operational Ledger Metrics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          {statCards.map((st, i) => {
            const Icon = st.icon;
            return (
              <div
                key={st.label}
                className="tilt-card animate-fade-in-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="tilt-card-inner editorial-card p-5 space-y-3 metric-container">
                  <div className="flex items-center justify-between">
                    <span className="blueprint-label text-[10px]">{st.label}</span>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-[8px] bg-gradient-to-br ${st.iconBg} shadow-[var(--shadow-xs)]`}>
                      <Icon className="h-4 w-4 text-white/90 stroke-[1.75]" />
                    </div>
                  </div>

                  <div className="stat-number text-3xl sm:text-[38px] font-serif font-medium leading-none tracking-tight">
                    <AnimatedNumber
                      target={st.value}
                      prefix={st.prefix}
                      suffix={st.suffix}
                      duration={1200 + i * 200}
                    />
                  </div>

                  <div className="font-mono text-[11px] tabular-nums flex items-center gap-1.5">
                    <span className={`font-semibold ${st.changeTone}`}>{st.change}</span>
                    <span className="text-[var(--text-faint)]">{st.sub}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Pipeline Funnel + Site Visits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Pipeline Funnel */}
        <div className="lg:col-span-7 editorial-card p-6 space-y-5 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div>
              <span className="blueprint-label text-[10px]">Deal Progression</span>
              <h2 className="font-serif text-xl font-medium text-[var(--text)] mt-1">
                Sales Pipeline Funnel
              </h2>
            </div>
            <Link
              to="/leads"
              className="text-xs font-mono text-[var(--accent)] hover:underline flex items-center gap-1.5 hover:gap-2.5 transition-all duration-200"
            >
              <span>View Kanban</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-4 pt-1 stagger-children">
            {funnelStages.map((st, idx) => (
              <div key={st.name} className="space-y-2 font-mono text-xs animate-fade-in-up">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-[var(--text)]">{st.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--text-faint)]">{st.count} buyers</span>
                    <span className="font-semibold text-[var(--text)] tabular-nums">{st.value}</span>
                  </div>
                </div>
                {/* 3D Progress Bar */}
                <div className="progress-bar-3d">
                  <div
                    className={`bar-fill bg-gradient-to-r ${st.color} animate-progress-fill`}
                    style={{ width: `${st.pct}%`, animationDelay: `${300 + idx * 120}ms` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-[var(--border)] flex justify-between text-[11px] font-mono text-[var(--text-faint)]">
            <span>Average Deal Cycle: <span className="text-[var(--text)] font-medium">18.4 Days</span></span>
            <span>RERA Compliance: <span className="text-[var(--success)] font-medium">100%</span></span>
          </div>
        </div>

        {/* Today's Site Visits Timeline */}
        <div className="lg:col-span-5 editorial-card p-6 space-y-5 animate-fade-in-up" style={{ animationDelay: '320ms' }}>
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div>
              <span className="blueprint-label text-[10px]">Field Schedule</span>
              <h2 className="font-serif text-xl font-medium text-[var(--text)] mt-1">
                Today&apos;s Site Visits
              </h2>
            </div>
            <Link
              to="/appointments"
              className="text-xs font-mono text-[var(--accent)] hover:underline flex items-center gap-1.5 hover:gap-2.5 transition-all duration-200"
            >
              <span>Calendar</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3 pt-1 stagger-children">
            {todayVisits.map((visit, idx) => (
              <div
                key={visit.id}
                className="p-3.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] space-y-2 transition-all duration-300 hover:border-[var(--accent-soft)] hover:shadow-[var(--shadow-sm)] hover:-translate-y-0.5 cursor-pointer animate-fade-in-up"
                style={{ animationDelay: `${400 + idx * 80}ms` }}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--text)]">
                    <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[var(--accent-soft)]">
                      <Clock className="w-3 h-3 text-[var(--accent)]" />
                    </div>
                    <span className="font-semibold">{visit.time}</span>
                  </div>
                  <span className={`pill-badge text-[10px] ${visit.statusTone}`}>
                    {visit.status}
                  </span>
                </div>

                <div className="font-serif text-[14px] font-medium text-[var(--text)]">
                  {visit.buyer}
                </div>

                <div className="text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-1.5">
                  <Building className="w-3 h-3 shrink-0 text-[var(--text-faint)]" />
                  <span className="truncate">{visit.project}</span>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-[var(--border)]/40 text-[10px] font-mono text-[var(--text-faint)]">
                  <span dangerouslySetInnerHTML={{ __html: visit.unit }} />
                  <span className="text-[var(--text-muted)] font-medium">
                    <span className="text-[var(--text-faint)] font-normal">Advisor:</span> {visit.agent}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Hot Leads SLA Queue */}
      <section aria-label="Hot Leads SLA Queue" className="animate-fade-in-up" style={{ animationDelay: '500ms' }}>
        <TodaySlaQueue />
      </section>

      {/* 5. Recent Leads Activity Ledger */}
      <section aria-label="Recent Leads Feed" className="animate-fade-in-up" style={{ animationDelay: '600ms' }}>
        <RecentLeads
          leads={recentLeads}
          isLoading={isLeadsLoading}
          onSelectLead={lead => setSelectedLead(lead as unknown as LeadItemResponse)}
        />
      </section>

      {/* Lead Detail Dossier Drawer */}
      {selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead}
          isOpen={Boolean(selectedLead)}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </div>
  );
};

export default DashboardPage;
