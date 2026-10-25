import React from 'react';
import { Download, TrendingUp, Compass, Bot } from 'lucide-react';
import type { AnalyticsFilter } from '@propbot/shared';
import { PageHeader } from '../layout/PageHeader.js';
import { Button } from '../ui/Button.js';

interface AnalyticsHeaderProps {
  filter: AnalyticsFilter;
  onFilterChange: (updated: Partial<AnalyticsFilter>) => void;
  chatbots?: Array<{ id: string; name: string }>;
  onOpenForecast: () => void;
  onOpenAttribution: () => void;
  onExportCsv: () => void;
  isExporting?: boolean;
}

const PERIODS: Array<{ label: string; value: 'today' | '7d' | '30d' | '90d' }> = [
  { label: 'Today', value: 'today' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

export const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({ filter, onFilterChange, chatbots = [], onOpenForecast, onOpenAttribution, onExportCsv, isExporting }) => (
  <div>
    <PageHeader
      title="Analytics"
      description="Where your enquiries come from, how they move through the funnel, and what buyers ask for."
      action={
        <>
          <Button variant="outline" size="sm" onClick={onOpenForecast} leftIcon={<TrendingUp className="h-4 w-4" />}>
            30-day forecast
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenAttribution} leftIcon={<Compass className="h-4 w-4" />}>
            Attribution
          </Button>
          <Button variant="outline" size="sm" onClick={onExportCsv} isLoading={isExporting} leftIcon={<Download className="h-4 w-4" />}>
            Export CSV
          </Button>
        </>
      }
      className="!mb-4"
    />
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div role="group" aria-label="Time period" className="inline-flex rounded-lg border border-border bg-surface p-0.5">
        {PERIODS.map(p => (
          <button
            key={p.value}
            type="button"
            aria-pressed={filter.period === p.value}
            onClick={() => onFilterChange({ period: p.value, startDate: undefined, endDate: undefined })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${filter.period === p.value ? 'bg-accent-soft text-accent' : 'text-text-muted hover:text-text'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {chatbots.length > 0 && (
        <div className="relative">
          <Bot aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <select
            aria-label="Filter by chatbot"
            value={filter.chatbotId ?? ''}
            onChange={e => onFilterChange({ chatbotId: e.target.value || undefined })}
            className="h-9 rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="">All chatbots</option>
            {chatbots.map(bot => (
              <option key={bot.id} value={bot.id}>
                {bot.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  </div>
);
