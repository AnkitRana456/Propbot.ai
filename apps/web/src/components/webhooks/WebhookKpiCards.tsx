import React from 'react';
import { Send, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import type { WebhookKpis } from '@propbot/shared';

interface WebhookKpiCardsProps {
  kpis?: WebhookKpis;
  isLoading?: boolean;
}

export function WebhookKpiCards({ kpis, isLoading }: WebhookKpiCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Webhooks',
      value: kpis?.totalWebhooks?.toLocaleString() ?? '0',
      icon: Send,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      label: 'Success Rate',
      value: `${kpis?.successRate ?? 100}%`,
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
      label: 'Failed / Dead-Letter',
      value: kpis?.failedCount?.toLocaleString() ?? '0',
      icon: AlertTriangle,
      color: kpis && kpis.failedCount > 0
        ? 'text-rose-600 bg-rose-50 border-rose-200'
        : 'text-gray-600 bg-gray-50 border-gray-200',
    },
    {
      label: 'Avg Duration',
      value: `${kpis?.avgDurationMs ?? 0} ms`,
      icon: Clock,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                {card.label}
              </p>
              <h3 className="text-2xl font-bold text-gray-900">{card.value}</h3>
            </div>
            <div className={`p-3 rounded-lg border ${card.color}`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
