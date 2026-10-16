import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, AlertCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { fetchDashboardStats, fetchRecentLeads } from '../services/dashboard.service.js';
import { KpiGrid } from '../components/dashboard/KpiGrid.js';
import { RecentLeads } from '../components/dashboard/RecentLeads.js';
import { QuickActions } from '../components/dashboard/QuickActions.js';

export const DashboardPage: React.FC = () => {
  const { user, company } = useAuth();

  const {
    data: stats,
    isLoading: isStatsLoading,
    isError: isStatsError,
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
    isError: isLeadsError,
    refetch: refetchLeads,
  } = useQuery({
    queryKey: ['recent-leads'],
    queryFn: fetchRecentLeads,
    staleTime: 60 * 1000,
  });

  const hasError = isStatsError || isLeadsError;
  const isAiConnected = Boolean(stats?.aiConnected);

  return (
    <div className="space-y-6">
      {/* AI Not Connected Alert Banner */}
      {!isStatsLoading && !isAiConnected && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
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
            className="flex-shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition"
          >
            Configure in Settings &rarr;
          </Link>
        </div>
      )}

      {/* Top Greeting & Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Welcome back, {user?.name?.split(' ')[0] || 'Advisor'}
            </h1>
            {isAiConnected ? (
              <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                <Sparkles className="h-3 w-3 text-blue-500" />
                <span>AI Engine Active</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                <span>AI Offline (Keys Missing)</span>
              </span>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {company?.name || 'Prestige Realty Group'} &bull; Real-time AI conversion pipeline &
            live handoff brief
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
            <span>Refresh Feed</span>
          </button>
        </div>
      </div>

      {/* Error Alert if queries fail */}
      {hasError && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="text-xs sm:text-sm">
              <span className="font-semibold">Unable to refresh live stats.</span> Showing fallback
              data.
            </div>
          </div>
          <button
            onClick={() => {
              refetchStats();
              refetchLeads();
            }}
            className="text-xs font-bold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <section aria-label="Key Performance Indicators">
        <KpiGrid stats={stats} isLoading={isStatsLoading} />
      </section>

      {/* Quick Launch Workflows */}
      <section aria-label="Quick Actions">
        <QuickActions />
      </section>

      {/* Recent Leads Activity Feed */}
      <section aria-label="Recent Leads Feed">
        <RecentLeads leads={recentLeads} isLoading={isLeadsLoading} />
      </section>
    </div>
  );
};
