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
      const res = await apiRequest<AnalyticsKpisResponse>(
        `/api/analytics/kpis${buildQueryString(filter)}`,
      );
      return res;
    },
    staleTime: 15000,
  });
}

export function useCtaFunnel(filter?: AnalyticsFilter) {
  return useQuery({
    queryKey: ['analytics', 'cta-funnel', filter],
    queryFn: async () => {
      const res = await apiRequest<CtaFunnelResponse>(
        `/api/analytics/cta-funnel${buildQueryString(filter)}`,
      );
      return res;
    },
    staleTime: 15000,
  });
}

export function useRealEstateFunnel(filter?: AnalyticsFilter) {
  return useQuery({
    queryKey: ['analytics', 'real-estate-funnel', filter],
    queryFn: async () => {
      const res = await apiRequest<RealEstateFunnelResponse>(
        `/api/analytics/real-estate-funnel${buildQueryString(filter)}`,
      );
      return res;
    },
    staleTime: 15000,
  });
}

export function usePerformance(filter?: AnalyticsFilter) {
  return useQuery({
    queryKey: ['analytics', 'performance', filter],
    queryFn: async () => {
      const res = await apiRequest<PerformanceResponse>(
        `/api/analytics/performance${buildQueryString(filter)}`,
      );
      return res;
    },
    staleTime: 15000,
  });
}

export function useEngagement(filter?: AnalyticsFilter) {
  return useQuery({
    queryKey: ['analytics', 'engagement', filter],
    queryFn: async () => {
      const res = await apiRequest<EngagementResponse>(
        `/api/analytics/engagement${buildQueryString(filter)}`,
      );
      return res;
    },
    staleTime: 15000,
  });
}

export function useTopQueries(filter?: AnalyticsFilter) {
  return useQuery({
    queryKey: ['analytics', 'top-queries', filter],
    queryFn: async () => {
      const res = await apiRequest<TopQueriesResponse>(
        `/api/analytics/top-queries${buildQueryString(filter)}`,
      );
      return res;
    },
    staleTime: 15000,
  });
}

export function useRealEstateInsights(filter?: AnalyticsFilter) {
  return useQuery({
    queryKey: ['analytics', 'real-estate-insights', filter],
    queryFn: async () => {
      const res = await apiRequest<RealEstateInsightsResponse>(
        `/api/analytics/real-estate-insights${buildQueryString(filter)}`,
      );
      return res;
    },
    staleTime: 15000,
  });
}

export function useAiQuality(filter?: AnalyticsFilter) {
  return useQuery({
    queryKey: ['analytics', 'ai-quality', filter],
    queryFn: async () => {
      const res = await apiRequest<AiQualityResponse>(
        `/api/analytics/ai-quality${buildQueryString(filter)}`,
      );
      return res;
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
      const res = await apiRequest<AttributionResponse>(
        `/api/analytics/attribution${qs}${glue}model=${model}`,
      );
      return res;
    },
    staleTime: 15000,
  });
}

export function useForecast(metric: 'conversations' | 'leads') {
  return useQuery({
    queryKey: ['analytics', 'forecast', metric],
    queryFn: async () => {
      const res = await apiRequest<ForecastResponse>(
        `/api/analytics/forecast?metric=${metric}`,
      );
      return res;
    },
    staleTime: 60000,
  });
}

export function useCampaignSpends() {
  return useQuery({
    queryKey: ['analytics', 'spends'],
    queryFn: async () => {
      const res = await apiRequest<CampaignSpendItem[]>(
        '/api/analytics/spends',
      );
      return res;
    },
  });
}

export interface AdSourcesResponse {
  bySource: { label: string; count: number }[];
  byDevice: { label: string; count: number }[];
  byCity: { label: string; count: number }[];
}

export function useAdSources(filter?: AnalyticsFilter) {
  const qs = buildQueryString(filter);
  return useQuery<AdSourcesResponse, Error>({
    queryKey: ['analytics', 'ad-sources', filter],
    queryFn: () => apiRequest<AdSourcesResponse>(`/api/analytics/ad-sources${qs}`),
  });
}

export function useCreateCampaignSpend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCampaignSpendInput) => {
      const res = await apiRequest<CampaignSpendItem>(
        '/api/analytics/spends',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'spends'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'attribution'] });
    },
  });
}
