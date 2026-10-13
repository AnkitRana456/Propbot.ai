import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api-client.js';
import type {
  AnalyticsFilter,
  AnalyticsKpisResponse,
  CtaFunnelResponse,
  RealEstateFunnelResponse,
  PerformanceResponse,
  EngagementResponse,
  TopQueriesResponse,
  RealEstateInsightsResponse,
  AiQualityResponse,
  AttributionResponse,
  ForecastResponse,
  CampaignSpendItem,
  CreateCampaignSpendInput,
} from '@propbot/shared';

function buildQueryString(filter?: AnalyticsFilter): string {
  if (!filter) return '';
  const params = new URLSearchParams();
  if (filter.period) params.append('period', filter.period);
  if (filter.startDate) params.append('startDate', filter.startDate);
  if (filter.endDate) params.append('endDate', filter.endDate);
  if (filter.chatbotId) params.append('chatbotId', filter.chatbotId);
  const str = params.toString();
  return str ? `?${str}` : '';
}

export function useAnalyticsKpis(filter?: AnalyticsFilter) {
  return useQuery({
    queryKey: ['analytics', 'kpis', filter],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: AnalyticsKpisResponse }>(
        `/api/analytics/kpis${buildQueryString(filter)}`,
      );
      return res.data;
    },
    staleTime: 15000,
  });
}

export function useCtaFunnel(filter?: AnalyticsFilter) {
  return useQuery({
    queryKey: ['analytics', 'cta-funnel', filter],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: CtaFunnelResponse }>(
        `/api/analytics/cta-funnel${buildQueryString(filter)}`,
      );
      return res.data;
    },
    staleTime: 15000,
  });
}

export function useRealEstateFunnel(filter?: AnalyticsFilter) {
  return useQuery({
    queryKey: ['analytics', 'real-estate-funnel', filter],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: RealEstateFunnelResponse }>(
        `/api/analytics/real-estate-funnel${buildQueryString(filter)}`,
      );
      return res.data;
    },
    staleTime: 15000,
  });
}

export function usePerformance(filter?: AnalyticsFilter) {
  return useQuery({
    queryKey: ['analytics', 'performance', filter],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: PerformanceResponse }>(
        `/api/analytics/performance${buildQueryString(filter)}`,
      );
      return res.data;
    },
    staleTime: 15000,
  });
}

export function useEngagement(filter?: AnalyticsFilter) {
  return useQuery({
    queryKey: ['analytics', 'engagement', filter],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: EngagementResponse }>(
        `/api/analytics/engagement${buildQueryString(filter)}`,
      );
      return res.data;
    },
    staleTime: 15000,
  });
}

export function useTopQueries(filter?: AnalyticsFilter) {
  return useQuery({
    queryKey: ['analytics', 'top-queries', filter],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: TopQueriesResponse }>(
        `/api/analytics/top-queries${buildQueryString(filter)}`,
      );
      return res.data;
    },
    staleTime: 15000,
  });
}

export function useRealEstateInsights(filter?: AnalyticsFilter) {
  return useQuery({
    queryKey: ['analytics', 'real-estate-insights', filter],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: RealEstateInsightsResponse }>(
        `/api/analytics/real-estate-insights${buildQueryString(filter)}`,
      );
      return res.data;
    },
    staleTime: 15000,
  });
}

export function useAiQuality(filter?: AnalyticsFilter) {
  return useQuery({
    queryKey: ['analytics', 'ai-quality', filter],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: AiQualityResponse }>(
        `/api/analytics/ai-quality${buildQueryString(filter)}`,
      );
      return res.data;
    },
    staleTime: 15000,
  });
}

export function useAttribution(model: 'first_touch' | 'last_touch' | 'linear', filter?: AnalyticsFilter) {
  return useQuery({
    queryKey: ['analytics', 'attribution', model, filter],
    queryFn: async () => {
      const qs = buildQueryString(filter);
      const glue = qs ? '&' : '?';
      const res = await apiRequest<{ success: boolean; data: AttributionResponse }>(
        `/api/analytics/attribution${qs}${glue}model=${model}`,
      );
      return res.data;
    },
    staleTime: 15000,
  });
}

export function useForecast(metric: 'conversations' | 'leads') {
  return useQuery({
    queryKey: ['analytics', 'forecast', metric],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: ForecastResponse }>(
        `/api/analytics/forecast?metric=${metric}`,
      );
      return res.data;
    },
    staleTime: 60000,
  });
}

export function useCampaignSpends() {
  return useQuery({
    queryKey: ['analytics', 'spends'],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: CampaignSpendItem[] }>(
        '/api/analytics/spends',
      );
      return res.data;
    },
  });
}

export function useCreateCampaignSpend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCampaignSpendInput) => {
      const res = await apiRequest<{ success: boolean; data: CampaignSpendItem }>(
        '/api/analytics/spends',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'spends'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'attribution'] });
    },
  });
}
