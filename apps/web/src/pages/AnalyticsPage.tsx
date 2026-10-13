import React, { useState } from 'react';
import type { AnalyticsFilter } from '@propbot/shared';
import {
  useAnalyticsKpis,
  useCtaFunnel,
  useRealEstateFunnel,
  usePerformance,
  useEngagement,
  useTopQueries,
  useRealEstateInsights,
  useAiQuality,
} from '../services/analytics.service.js';
import { AnalyticsHeader } from '../components/analytics/AnalyticsHeader.js';
import { AnalyticsKpiCards } from '../components/analytics/AnalyticsKpiCards.js';
import { AnalyticsFunnels } from '../components/analytics/AnalyticsFunnels.js';
import { PerformanceTab } from '../components/analytics/PerformanceTab.js';
import { EngagementTab } from '../components/analytics/EngagementTab.js';
import { TopQueriesTab } from '../components/analytics/TopQueriesTab.js';
import { RealEstateInsightsTab } from '../components/analytics/RealEstateInsightsTab.js';
import { AttributionModal } from '../components/analytics/AttributionModal.js';
import { ForecastModal } from '../components/analytics/ForecastModal.js';
import { BarChart3, Users, Clock, Sparkles } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [filter, setFilter] = useState<AnalyticsFilter>({ period: '30d' });
  const [activeTab, setActiveTab] = useState<'performance' | 'engagement' | 'queries' | 'insights'>('performance');
  const [isForecastOpen, setIsForecastOpen] = useState(false);
  const [isAttributionOpen, setIsAttributionOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Queries
  const { data: kpis, isLoading: isKpisLoading } = useAnalyticsKpis(filter);
  const { data: ctaFunnel, isLoading: isCtaLoading } = useCtaFunnel(filter);
  const { data: reFunnel, isLoading: isReLoading } = useRealEstateFunnel(filter);
  const { data: performance, isLoading: isPerfLoading } = usePerformance(filter);
  const { data: engagement, isLoading: isEngageLoading } = useEngagement(filter);
  const { data: topQueries, isLoading: isQueriesLoading } = useTopQueries(filter);
  const { data: insights, isLoading: isInsightsLoading } = useRealEstateInsights(filter);
  const { data: aiQuality, isLoading: isAiQualityLoading } = useAiQuality(filter);

  const handleFilterChange = (updated: Partial<AnalyticsFilter>) => {
    setFilter(prev => ({ ...prev, ...updated }));
  };

  const handleExportCsv = () => {
    setIsExporting(true);
    const qs = new URLSearchParams();
    if (filter.period) qs.append('period', filter.period);
    if (filter.startDate) qs.append('startDate', filter.startDate);
    if (filter.endDate) qs.append('endDate', filter.endDate);
    if (filter.chatbotId) qs.append('chatbotId', filter.chatbotId);

    window.open(`/api/analytics/export/csv?${qs.toString()}`, '_blank');
    setIsExporting(false);
  };

  const tabs = [
    { id: 'performance' as const, label: 'Performance', icon: BarChart3 },
    { id: 'engagement' as const, label: 'Engagement & Heatmap', icon: Clock },
    { id: 'queries' as const, label: 'Top Inquiries', icon: Users },
    { id: 'insights' as const, label: 'Real Estate & AI Quality', icon: Sparkles },
  ];

  const isEmptyAccount = kpis?.totalConversations.current === 0 && kpis?.leadsGenerated.current === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header with period controls and action buttons */}
      <AnalyticsHeader
        filter={filter}
        onFilterChange={handleFilterChange}
        onOpenForecast={() => setIsForecastOpen(true)}
        onOpenAttribution={() => setIsAttributionOpen(true)}
        onExportCsv={handleExportCsv}
        isExporting={isExporting}
      />

      {/* Empty State Banner (not fake numbers) */}
      {isEmptyAccount && !isKpisLoading && (
        <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 flex items-center justify-between text-xs text-blue-800 dark:text-blue-300">
          <div>
            <span className="font-bold">No conversation traffic recorded for this period.</span>
            <p className="mt-0.5 text-blue-600 dark:text-blue-400">
              Embed your chatbot on your website or connect WhatsApp to start generating real-time analytics.
            </p>
          </div>
          <a
            href="/chatbots"
            className="px-3 py-1.5 font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Deploy Chatbot
          </a>
        </div>
      )}

      {/* 6 Top-level KPI Cards */}
      <AnalyticsKpiCards kpis={kpis} isLoading={isKpisLoading} />

      {/* 2 Funnels: Real Estate 7-stage & Widget CTA Funnel */}
      <AnalyticsFunnels
        ctaFunnel={ctaFunnel}
        realEstateFunnel={reFunnel}
        isLoading={isCtaLoading || isReLoading}
      />

      {/* Tab Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-1 inline-flex items-center gap-2 border-b-2 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active Tab Content */}
      <div>
        {activeTab === 'performance' && (
          <PerformanceTab performance={performance} isLoading={isPerfLoading} />
        )}
        {activeTab === 'engagement' && (
          <EngagementTab engagement={engagement} isLoading={isEngageLoading} />
        )}
        {activeTab === 'queries' && (
          <TopQueriesTab topQueries={topQueries} isLoading={isQueriesLoading} />
        )}
        {activeTab === 'insights' && (
          <RealEstateInsightsTab
            insights={insights}
            aiQuality={aiQuality}
            isLoading={isInsightsLoading || isAiQualityLoading}
          />
        )}
      </div>

      {/* Modals */}
      <AttributionModal
        isOpen={isAttributionOpen}
        onClose={() => setIsAttributionOpen(false)}
        filter={filter}
      />

      <ForecastModal
        isOpen={isForecastOpen}
        onClose={() => setIsForecastOpen(false)}
      />
    </div>
  );
};
