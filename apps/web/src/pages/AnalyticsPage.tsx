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
import { useChatbots } from '../services/chatbots.service.js';
import { Button } from '../components/ui/Button.js';
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
  const [exportError, setExportError] = useState<string | null>(null);

  // Queries
  const kpisQ = useAnalyticsKpis(filter);
  const ctaQ = useCtaFunnel(filter);
  const reQ = useRealEstateFunnel(filter);
  const perfQ = usePerformance(filter);
  const { data: kpis, isLoading: isKpisLoading } = kpisQ;
  const { data: ctaFunnel, isLoading: isCtaLoading } = ctaQ;
  const { data: reFunnel, isLoading: isReLoading } = reQ;
  const { data: performance, isLoading: isPerfLoading } = perfQ;
  const { data: engagement, isLoading: isEngageLoading } = useEngagement(filter);
  const { data: topQueries, isLoading: isQueriesLoading } = useTopQueries(filter);
  const { data: insights, isLoading: isInsightsLoading } = useRealEstateInsights(filter);
  const { data: aiQuality, isLoading: isAiQualityLoading } = useAiQuality(filter);

  const { data: chatbotsData } = useChatbots();
  const queryError = [kpisQ, ctaQ, reQ, perfQ].find(q => q.isError)?.error as Error | undefined;

  const handleFilterChange = (updated: Partial<AnalyticsFilter>) => {
    setFilter(prev => ({ ...prev, ...updated }));
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const qs = new URLSearchParams();
      if (filter.period) qs.append('period', filter.period);
      if (filter.startDate) qs.append('startDate', filter.startDate);
      if (filter.endDate) qs.append('endDate', filter.endDate);
      if (filter.chatbotId) qs.append('chatbotId', filter.chatbotId);
      const base = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';
      const res = await fetch(`${base}/api/analytics/export/csv?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('propbot_access_token') ?? ''}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const tabs = [
    { id: 'performance' as const, label: 'Performance', icon: BarChart3 },
    { id: 'engagement' as const, label: 'Engagement & Heatmap', icon: Clock },
    { id: 'queries' as const, label: 'Top Inquiries', icon: Users },
    { id: 'insights' as const, label: 'Real Estate & AI Quality', icon: Sparkles },
  ];

  const isEmptyAccount = kpis?.totalConversations.current === 0 && kpis?.leadsGenerated.current === 0;

  return (
    <div className="space-y-6">
      {/* Header with period controls and action buttons */}
      <AnalyticsHeader
        filter={filter}
        onFilterChange={handleFilterChange}
        onOpenForecast={() => setIsForecastOpen(true)}
        onOpenAttribution={() => setIsAttributionOpen(true)}
        onExportCsv={() => void handleExportCsv()}
        chatbots={chatbotsData?.chatbots?.map(b => ({ id: b.id, name: b.name })) ?? []}
        isExporting={isExporting}
      />

      {queryError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-text">
          <span>Could not load analytics. {queryError.message}</span>
          <Button size="sm" variant="outline" onClick={() => void Promise.all([kpisQ.refetch(), ctaQ.refetch(), reQ.refetch(), perfQ.refetch()])}>Retry</Button>
        </div>
      )}
      {exportError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{exportError}</p>}

      {isEmptyAccount && !isKpisLoading && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-soft p-4 text-sm">
          <div>
            <p className="font-semibold text-text">No conversations in this period yet</p>
            <p className="mt-0.5 text-text-muted">Put your chatbot on your website or connect WhatsApp and the numbers will appear here.</p>
          </div>
          <a href="/chatbots" className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover">Set up a chatbot</a>
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
      <div className="border-b border-border">
        <nav className="flex gap-6 overflow-x-auto" role="tablist" aria-label="Analytics sections">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  isActive ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text'
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
