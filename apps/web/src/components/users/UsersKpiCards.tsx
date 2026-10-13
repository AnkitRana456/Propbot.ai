import React from 'react';
import { Users, UserCheck, Clock, Building2 } from 'lucide-react';
import type { UserKpiMetrics } from '@propbot/shared';

interface UsersKpiCardsProps {
  metrics?: UserKpiMetrics;
  isLoading?: boolean;
}

export const UsersKpiCards: React.FC<UsersKpiCardsProps> = ({ metrics, isLoading }) => {
  const cards = [
    {
      title: 'Total Users',
      value: metrics?.totalUsers ?? 0,
      icon: Users,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400',
    },
    {
      title: 'Active Users',
      value: metrics?.activeUsers ?? 0,
      icon: UserCheck,
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400',
    },
    {
      title: 'Pending Approval',
      value: metrics?.pendingApproval ?? 0,
      icon: Clock,
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400',
    },
    {
      title: 'Companies',
      value: metrics?.companiesCount ?? 1,
      icon: Building2,
      color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="flex items-center justify-between p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {card.title}
              </p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {isLoading ? '...' : card.value}
              </h3>
            </div>
            <div className={`p-3 rounded-xl ${card.color}`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
