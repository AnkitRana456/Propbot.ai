import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import type { LeadItemResponse } from '@propbot/shared';
import { useAuth } from '../contexts/AuthContext.js';
import { fetchDashboardStats, fetchRecentLeads } from '../services/dashboard.service.js';
import { usePendingApprovalsCount } from '../services/approvals.service.js';
import { KpiGrid } from '../components/dashboard/KpiGrid.js';
import { RecentLeads } from '../components/dashboard/RecentLeads.js';
import { QuickActions } from '../components/dashboard/QuickActions.js';
import { TodayChecklist } from '../components/dashboard/TodayChecklist.js';
import { TodaySlaQueue } from '../components/dashboard/TodaySlaQueue.js';
import { LeadDetailDrawer } from '../components/leads/LeadDetailDrawer.js';

export const DashboardPage: React.FC = () => {
  const { user, company } = useAuth();
  const [selectedLead, setSelectedLead] = useState<LeadItemResponse | null>(null);

  const {
    data: stats,
    isLoading: isStatsLoading,
    isError: _isStatsError,
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
    isError: _isLeadsError,
    refetch: refetchLeads,
  } = useQuery({
    queryKey: ['recent-leads'],
    queryFn: fetchRecentLeads,
    staleTime: 60 * 1000,
  });

  const { data: pendingApprovalsCount } = usePendingApprovalsCount();

  const isAiConnected = Boolean(stats?.aiConnected);
  const activeChatbotsCount = stats?.activeChatbots ?? 0;
  const totalLeadsCount = stats?.totalLeads ?? 0;

  return (
    <div className="space-y-6">
      {/* 1. AI Not Connected Alert Banner */}
      {!isStatsLoading && !isAiConnected && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold">AI Assistant Not Connected</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                LLM and embedding API keys are not configured. Chatbot answers and RAG grounding are offline until keys are set.
              </p>
            </div>
          </div>
          <Link
            to="/settings"
            className="flex-shrink-0 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition"
          >
            Configure in Settings &rarr;
          </Link>
        </div>
      )}

      {/* 2. Pending AI Approvals Banner (v5 R2.3 requirement) */}
      {(pendingApprovalsCount ?? 0) > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-900 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <p className="text-sm font-semibold">
                {pendingApprovalsCount} AI Action{pendingApprovalsCount === 1 ? '' : 's'} Awaiting Human Approval
              </p>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Price quotes, discount offers, or possession commitments placed in the Tier 2 safety queue.
              </p>
            </div>
          </div>
          <Link
            to="/approvals"
            className="flex-shrink-0 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition flex items-center gap-1.5"
          >
            <span>Review Queue</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* 3. Top Greeting & Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight font-display text-slate-900 dark:text-white">
              Today Overview &bull; {user?.name?.split(' ')[0] || 'Advisor'}
            </h1>
            {isAiConnected ? (
              <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                <Sparkles className="h-3 w-3 text-blue-500" />
                <span>AI Grounded (RAG)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                <span>AI Offline</span>
              </span>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {company?.name || 'Prestige Realty Group'} &bull; Real-time AI conversion pipeline &
            live SLA monitors
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              refetchStats();
              refetchLeads();
            }}
            disabled={isStatsFetching}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isStatsFetching ? 'animate-spin' : ''}`} />
            <span>Refresh Live Data</span>
          </button>
        </div>
      </div>

      {/* 4. Onboarding Checklist for accounts */}
      <TodayChecklist
        isAiConnected={isAiConnected}
        hasChatbot={activeChatbotsCount > 0}
        hasTrainedKnowledge={activeChatbotsCount > 0}
        hasCapturedLead={totalLeadsCount > 0}
      />

      {/* 5. Hot Leads SLA Queue (v5 R2.3 requirement) */}
      <TodaySlaQueue />

      {/* 6. KPI Metric Cards */}
      <section aria-label="Key Performance Indicators">
        <KpiGrid stats={stats} isLoading={isStatsLoading} />
      </section>

      {/* 7. Quick Launch Workflows */}
      <section aria-label="Quick Actions">
        <QuickActions />
      </section>

      {/* 8. Recent Leads Activity Feed */}
      <section aria-label="Recent Leads Feed">
        <RecentLeads
          leads={recentLeads}
          isLoading={isLeadsLoading}
          onSelectLead={lead => setSelectedLead(lead as unknown as LeadItemResponse)}
        />
      </section>

      {/* Lead Detail Drawer */}
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
