import React from 'react';
import { Download, TrendingUp, Compass, Bot } from 'lucide-react';
import type { AnalyticsFilter } from '@propbot/shared';

interface AnalyticsHeaderProps {
  filter: AnalyticsFilter;
  onFilterChange: (updated: Partial<AnalyticsFilter>) => void;
  chatbots?: Array<{ id: string; name: string }>;
  onOpenForecast: () => void;
  onOpenAttribution: () => void;
  onExportCsv: () => void;
  isExporting?: boolean;
}

export const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({
  filter,
  onFilterChange,
  chatbots = [],
  onOpenForecast,
  onOpenAttribution,
  onExportCsv,
  isExporting,
}) => {
  const periods: Array<{ label: string; value: 'today' | '7d' | '30d' | '90d' }> = [
    { label: 'Today', value: 'today' },
    { label: 'Last 7 Days', value: '7d' },
    { label: 'Last 30 Days', value: '30d' },
    { label: 'Last 90 Days', value: '90d' },
  ];

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Analytics & ROI
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Real-estate conversion funnels, buyer demand breakdown, multi-touch attribution, and 30-day forecast
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {/* Chatbot Selector */}
        {chatbots.length > 0 && (
          <div className="relative">
            <select
              aria-label="Filter by Chatbot"
              value={filter.chatbotId ?? ''}
              onChange={e => onFilterChange({ chatbotId: e.target.value || undefined })}
              className="pl-8 pr-4 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="">All Chatbots</option>
              {chatbots.map(bot => (
                <option key={bot.id} value={bot.id}>
                  {bot.name}
                </option>
              ))}
            </select>
            <Bot className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}

        {/* Date Preset Pills */}
        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
          {periods.map(p => (
            <button
              key={p.value}
              onClick={() => onFilterChange({ period: p.value, startDate: undefined, endDate: undefined })}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                filter.period === p.value
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <button
          onClick={onOpenForecast}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors shadow-xs"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          30-Day Forecast
        </button>

        <button
          onClick={onOpenAttribution}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-colors shadow-xs"
        >
          <Compass className="w-3.5 h-3.5" />
          Attribution Models
        </button>

        <button
          onClick={onExportCsv}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>
    </div>
  );
};
