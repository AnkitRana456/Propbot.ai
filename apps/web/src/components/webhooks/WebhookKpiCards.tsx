import React from 'react';
import { Send, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import type { WebhookKpis } from '@propbot/shared';
import { Card } from '../ui/Card.js';
import { Skeleton } from '../common/Skeleton.js';

interface WebhookKpiCardsProps {
  kpis?: WebhookKpis;
  isLoading?: boolean;
}

export function WebhookKpiCards({ kpis, isLoading }: WebhookKpiCardsProps) {
  const failing = (kpis?.failedCount ?? 0) > 0;
  const cards = [
    { label: 'Total deliveries', value: kpis?.totalWebhooks?.toLocaleString('en-IN') ?? '0', icon: Send, tone: 'text-accent bg-accent-soft' },
    { label: 'Success rate', value: `${kpis?.successRate ?? 100}%`, icon: CheckCircle2, tone: 'text-success bg-success-soft' },
    { label: 'Failed or dead-letter', value: kpis?.failedCount?.toLocaleString('en-IN') ?? '0', icon: AlertTriangle, tone: failing ? 'text-danger bg-danger/10' : 'text-text-muted bg-surface-2' },
    { label: 'Average duration', value: `${kpis?.avgDurationMs ?? 0} ms`, icon: Clock, tone: 'text-text-muted bg-surface-2' },
  ];

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-text-muted">{card.label}</p>
              {isLoading ? <Skeleton className="mt-1 h-8 w-16" /> : <p className="mt-1 text-2xl font-bold tabular-nums text-text">{card.value}</p>}
            </div>
            <span aria-hidden className={`rounded-lg p-3 ${card.tone}`}>
              <Icon className="h-5 w-5" />
            </span>
          </Card>
        );
      })}
    </div>
  );
}
