import React from 'react';
import {
  MessageSquare,
  Users,
  Percent,
  Clock,
  Smile,
  Bot,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { AnalyticsKpisResponse } from '@propbot/shared';

interface AnalyticsKpiCardsProps {
  kpis?: AnalyticsKpisResponse;
  isLoading?: boolean;
}

export const AnalyticsKpiCards: React.FC<AnalyticsKpiCardsProps> = ({ kpis, isLoading }) => {
  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 my-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200/60 dark:border-slate-800"
          />
        ))}
      </div>
    );
  }

  const renderDelta = (delta: number, unit = '%', isPositiveGood = true) => {
    const isUp = delta > 0;
    const isZero = delta === 0;
    const isGood = isPositiveGood ? isUp : !isUp;

    if (isZero) {
      return (
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          0.0{unit} vs prior
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center text-xs font-semibold ${
          isGood
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-rose-600 dark:text-rose-400'
        }`}
      >
        {isUp ? (
          <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
        ) : (
          <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
        )}
        {Math.abs(delta)}
        {unit} vs prior
      </span>
    );
  };

  const cards = [
    {
      title: 'Total Conversations',
      value: kpis.totalConversations.current.toLocaleString(),
      icon: MessageSquare,
      delta: kpis.totalConversations.deltaPercent,
      color: 'blue',
      isPositiveGood: true,
    },
    {
      title: 'Leads Generated',
      value: kpis.leadsGenerated.current.toLocaleString(),
      icon: Users,
      delta: kpis.leadsGenerated.deltaPercent,
      color: 'emerald',
      isPositiveGood: true,
    },
    {
      title: 'Conversion Rate',
      value: `${kpis.conversionRate.current}%`,
      icon: Percent,
      delta: kpis.conversionRate.deltaPercent,
      color: 'purple',
      unit: '%',
      isPositiveGood: true,
    },
    {
      title: 'Avg Response Time',
      value: `${kpis.avgResponseTimeSeconds.current}s`,
      icon: Clock,
      delta: kpis.avgResponseTimeSeconds.deltaPercent,
      color: 'amber',
      isPositiveGood: false, // Lower response time is better
    },
    {
      title: 'Satisfaction Rate',
      value: kpis.satisfactionRate.current > 0 ? `${kpis.satisfactionRate.current}%` : '—',
      icon: Smile,
      delta: kpis.satisfactionRate.deltaPercent,
      color: 'rose',
      unit: '%',
      isPositiveGood: true,
    },
    {
      title: 'Active Chatbots',
      value: kpis.activeChatbots.toString(),
      icon: Bot,
      color: 'indigo',
      subtitle: 'Online 24/7',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 my-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-medium truncate">{card.title}</span>
              <Icon className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {card.value}
            </div>
            <div className="mt-1.5 flex items-center">
              {card.delta !== undefined ? (
                renderDelta(card.delta, card.unit || '%', card.isPositiveGood)
              ) : (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {card.subtitle}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
