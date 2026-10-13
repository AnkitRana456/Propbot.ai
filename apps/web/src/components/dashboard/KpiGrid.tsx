import React from 'react';
import { Users, UserPlus, CheckCircle2, TrendingUp, Bot, CalendarCheck } from 'lucide-react';
import type { DashboardStats } from '@propbot/shared';
import { KpiCard } from './KpiCard.js';
import { Skeleton } from '../common/Skeleton.js';

interface KpiGridProps {
  stats?: DashboardStats;
  isLoading: boolean;
}

export const KpiGrid: React.FC<KpiGridProps> = ({ stats, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <Skeleton className="h-8 w-16 rounded" />
              <Skeleton className="h-3 w-10 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const data = stats || {
    totalLeads: 0,
    newLeads: 0,
    qualifiedLeads: 0,
    convertedLeads: 0,
    activeChatbots: 0,
    todayVisits: 0,
  };

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        title="Total Leads"
        value={data.totalLeads}
        icon={Users}
        trendText="+14% wk"
        trendType="positive"
        accentColor="blue"
      />
      <KpiCard
        title="New Leads"
        value={data.newLeads}
        icon={UserPlus}
        trendText="+4 today"
        trendType="positive"
        accentColor="indigo"
      />
      <KpiCard
        title="Qualified"
        value={data.qualifiedLeads}
        icon={CheckCircle2}
        trendText="68% rate"
        trendType="positive"
        accentColor="emerald"
      />
      <KpiCard
        title="Converted"
        value={data.convertedLeads}
        icon={TrendingUp}
        trendText="12.4% conv"
        trendType="positive"
        accentColor="purple"
      />
      <KpiCard
        title="Active Bots"
        value={data.activeChatbots}
        icon={Bot}
        trendText="24/7 Live"
        trendType="positive"
        accentColor="rose"
      />
      <KpiCard
        title="Site Visits"
        value={data.todayVisits}
        icon={CalendarCheck}
        trendText="Booked"
        trendType="neutral"
        accentColor="amber"
      />
    </div>
  );
};
