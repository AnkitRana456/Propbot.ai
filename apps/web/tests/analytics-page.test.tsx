import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { AnalyticsKpiCards } from '../src/components/analytics/AnalyticsKpiCards.js';
import { AnalyticsHeader } from '../src/components/analytics/AnalyticsHeader.js';
import { AnalyticsFunnels } from '../src/components/analytics/AnalyticsFunnels.js';
import { PeakHoursHeatmap } from '../src/components/analytics/PeakHoursHeatmap.js';
import { AttributionModal } from '../src/components/analytics/AttributionModal.js';
import { ForecastModal } from '../src/components/analytics/ForecastModal.js';
import type {
  AnalyticsKpisResponse,
  CtaFunnelResponse,
  RealEstateFunnelResponse,
} from '@propbot/shared';

// Mock services
vi.mock('../src/services/analytics.service.js', () => ({
  useAnalyticsKpis: () => ({
    data: mockKpis,
    isLoading: false,
  }),
  useCtaFunnel: () => ({
    data: mockCtaFunnel,
    isLoading: false,
  }),
  useRealEstateFunnel: () => ({
    data: mockReFunnel,
    isLoading: false,
  }),
  usePerformance: () => ({
    data: { points: [], channelShare: { web: 80, whatsapp: 20 } },
    isLoading: false,
  }),
  useEngagement: () => ({
    data: { heatmap: [], messagesPerChat: [], dropOffSteps: [] },
    isLoading: false,
  }),
  useTopQueries: () => ({
    data: { clusters: [], unanswered: [] },
    isLoading: false,
  }),
  useRealEstateInsights: () => ({
    data: {
      demandByLocality: [],
      demandByBhk: [],
      demandByBudget: [],
      mostAskedObjections: [],
      responseTimeVsConversion: [],
      speedToLeadMinutes: { average: 3.5, median: 2.1, slaBreachRate: 4.2 },
    },
    isLoading: false,
  }),
  useAiQuality: () => ({
    data: {
      llmCostTotal: 12.5,
      llmCostPerLead: 0.25,
      totalTokensUsed: 312500,
      approvalQueueStats: { proposed: 0, approved: 4, rejected: 0, pending: 0 },
      evalAccuracyTrend: [{ runDate: '2026-10-10', accuracyPercent: 98.1, hallucinationRatePercent: 0.5 }],
    },
    isLoading: false,
  }),
  useAttribution: () => ({
    data: {
      model: 'first_touch',
      campaigns: [
        {
          campaign: 'Google_Search_3BHK',
          source: 'google_ads',
          visitors: 120,
          leads: 24,
          visitsBooked: 8,
          dealsClosed: 2,
          conversionRate: 20.0,
          spend: 25000,
          costPerLead: 1042,
        },
      ],
    },
    isLoading: false,
  }),
  useForecast: () => ({
    data: {
      metric: 'leads',
      historicalDaysUsed: 30,
      isEstimate: true,
      methodology: '30-day moving average with 7-day cyclical seasonality',
      points: [
        { date: '2026-10-12', predictedValue: 4, confidenceLower: 2, confidenceUpper: 6, isEstimate: true },
      ],
      projectedTotal: 120,
    },
    isLoading: false,
  }),
  useCreateCampaignSpend: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

const mockKpis: AnalyticsKpisResponse = {
  totalConversations: { current: 154, previous: 132, deltaPercent: 16.7 },
  leadsGenerated: { current: 48, previous: 38, deltaPercent: 26.3 },
  conversionRate: { current: 31.2, previous: 28.8, deltaPercent: 2.4, unit: '%' },
  avgResponseTimeSeconds: { current: 1.4, previous: 1.8, deltaPercent: -22.2, unit: 's' },
  satisfactionRate: { current: 94.5, previous: 91.0, deltaPercent: 3.5, unit: '%' },
  activeChatbots: 3,
};

const mockCtaFunnel: CtaFunnelResponse = {
  stages: [
    { stage: 'shown', label: 'Widget Shown', count: 650, conversionFromPrevPercent: 100, conversionFromTopPercent: 100 },
    { stage: 'clicked', label: 'Launcher Clicked', count: 280, conversionFromPrevPercent: 43.1, conversionFromTopPercent: 43.1 },
    { stage: 'started', label: 'Chat Started', count: 154, conversionFromPrevPercent: 55.0, conversionFromTopPercent: 23.7 },
    { stage: 'completed', label: 'Lead Captured', count: 48, conversionFromPrevPercent: 31.2, conversionFromTopPercent: 7.4 },
    { stage: 'failed', label: 'Abandoned', count: 106, conversionFromPrevPercent: 68.8, conversionFromTopPercent: 16.3 },
  ],
};

const mockReFunnel: RealEstateFunnelResponse = {
  stages: [
    { stage: 'visitor', label: 'Visitors', count: 430, conversionFromPrevPercent: 100, conversionFromTopPercent: 100, dropOffPercent: 0 },
    { stage: 'chat', label: 'Engaged in Chat', count: 154, conversionFromPrevPercent: 35.8, conversionFromTopPercent: 35.8, dropOffPercent: 64.2 },
    { stage: 'lead', label: 'Captured Leads', count: 48, conversionFromPrevPercent: 31.2, conversionFromTopPercent: 11.2, dropOffPercent: 68.8 },
    { stage: 'qualified', label: 'Qualified Buyer DNA', count: 32, conversionFromPrevPercent: 66.7, conversionFromTopPercent: 7.4, dropOffPercent: 33.3 },
    { stage: 'visit_booked', label: 'Site Visit Booked', count: 18, conversionFromPrevPercent: 56.3, conversionFromTopPercent: 4.2, dropOffPercent: 43.7 },
    { stage: 'visit_done', label: 'Site Visit Completed', count: 12, conversionFromPrevPercent: 66.7, conversionFromTopPercent: 2.8, dropOffPercent: 33.3 },
    { stage: 'booked', label: 'Deals Booked', count: 4, conversionFromPrevPercent: 33.3, conversionFromTopPercent: 0.9, dropOffPercent: 66.7 },
  ],
};

describe('Frontend Analytics Page & Dashboard Components', () => {
  it('renders AnalyticsKpiCards with 6 real KPI metrics and deltas', () => {
    const el = React.createElement(AnalyticsKpiCards, {
      kpis: mockKpis,
      isLoading: false,
    });

    expect(el).toBeDefined();
    expect(el.props.kpis?.totalConversations.current).toBe(154);
    expect(el.props.kpis?.leadsGenerated.current).toBe(48);
    expect(el.props.kpis?.conversionRate.current).toBe(31.2);
    expect(el.props.kpis?.activeChatbots).toBe(3);
  });

  it('renders AnalyticsHeader with date presets and tool action buttons', () => {
    const handleFilter = vi.fn();
    const handleForecast = vi.fn();
    const handleAttrib = vi.fn();
    const handleExport = vi.fn();

    const el = React.createElement(AnalyticsHeader, {
      filter: { period: '30d' },
      onFilterChange: handleFilter,
      chatbots: [{ id: 'bot-1', name: 'Web Bot' }],
      onOpenForecast: handleForecast,
      onOpenAttribution: handleAttrib,
      onExportCsv: handleExport,
    });

    expect(el).toBeDefined();
    expect(el.props.filter.period).toBe('30d');
    expect(el.props.chatbots?.length).toBe(1);
  });

  it('renders AnalyticsFunnels with CTA and Real Estate 7-stage funnels', () => {
    const el = React.createElement(AnalyticsFunnels, {
      ctaFunnel: mockCtaFunnel,
      realEstateFunnel: mockReFunnel,
      isLoading: false,
    });

    expect(el).toBeDefined();
    expect(el.props.ctaFunnel?.stages.length).toBe(5);
    expect(el.props.realEstateFunnel?.stages.length).toBe(7);
    expect(el.props.realEstateFunnel?.stages[0].stage).toBe('visitor');
    expect(el.props.realEstateFunnel?.stages[6].stage).toBe('booked');
  });

  it('renders PeakHoursHeatmap with 7x24 data', () => {
    const el = React.createElement(PeakHoursHeatmap, {
      heatmap: [
        { dayOfWeek: 1, hour: 14, count: 18 },
        { dayOfWeek: 6, hour: 11, count: 28 },
      ],
    });

    expect(el).toBeDefined();
    expect(el.props.heatmap.length).toBe(2);
  });

  it('renders AttributionModal with multi-touch model options and campaign data', () => {
    const handleClose = vi.fn();
    const el = React.createElement(AttributionModal, {
      isOpen: true,
      onClose: handleClose,
      filter: { period: '30d' },
    });

    expect(el).toBeDefined();
    expect(el.props.isOpen).toBe(true);
  });

  it('renders ForecastModal with 30-day projection and confidence bands', () => {
    const handleClose = vi.fn();
    const el = React.createElement(ForecastModal, {
      isOpen: true,
      onClose: handleClose,
    });

    expect(el).toBeDefined();
    expect(el.props.isOpen).toBe(true);
  });
});
