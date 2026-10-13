import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api-client.js';
import type {
  WebhookKpis,
  WebhookEndpointItem,
  WebhookLogItem,
  WebhookLogsFilter,
  CreateWebhookEndpointInput,
  UpdateWebhookEndpointInput,
  IntegrationItem,
  IntegrationProvider,
  UpdateIntegrationInput,
} from '@propbot/shared';

export function useWebhookKpis() {
  return useQuery({
    queryKey: ['webhooks', 'kpis'],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: WebhookKpis }>('/api/webhooks/logs/kpis');
      return res.data;
    },
    staleTime: 10000,
  });
}

export function useWebhookEndpoints() {
  return useQuery({
    queryKey: ['webhooks', 'endpoints'],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: WebhookEndpointItem[] }>('/api/webhooks/endpoints');
      return res.data;
    },
  });
}

export function useWebhookLogs(filter: Partial<WebhookLogsFilter>) {
  return useQuery({
    queryKey: ['webhooks', 'logs', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.leadId) params.append('leadId', filter.leadId);
      if (filter.endpointId) params.append('endpointId', filter.endpointId);
      if (filter.status && filter.status !== 'all') params.append('status', filter.status);
      if (filter.eventType) params.append('eventType', filter.eventType);
      if (filter.startDate) params.append('startDate', filter.startDate);
      if (filter.endDate) params.append('endDate', filter.endDate);
      if (filter.page) params.append('page', String(filter.page));
      if (filter.limit) params.append('limit', String(filter.limit));

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await apiRequest<{
        success: boolean;
        data: { items: WebhookLogItem[]; total: number; page: number; limit: number };
      }>(`/api/webhooks/logs${queryStr}`);
      return res.data;
    },
  });
}

export function useCreateWebhookEndpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWebhookEndpointInput) => {
      const res = await apiRequest<{ success: boolean; data: WebhookEndpointItem }>('/api/webhooks/endpoints', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', 'endpoints'] });
    },
  });
}

export function useUpdateWebhookEndpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateWebhookEndpointInput }) => {
      const res = await apiRequest<{ success: boolean; data: WebhookEndpointItem }>(`/api/webhooks/endpoints/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', 'endpoints'] });
    },
  });
}

export function useDeleteWebhookEndpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest<{ success: boolean }>(`/api/webhooks/endpoints/${id}`, {
        method: 'DELETE',
      });
      return res.success;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', 'endpoints'] });
    },
  });
}

export function useSendTestEvent() {
  return useMutation({
    mutationFn: async (endpointId: string) => {
      const res = await apiRequest<{
        success: boolean;
        data: { success: boolean; statusCode: number | null; durationMs: number; status: string };
      }>(`/api/webhooks/endpoints/${endpointId}/test`, {
        method: 'POST',
      });
      return res.data;
    },
  });
}

export function useReplayWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (logId: string) => {
      const res = await apiRequest<{ success: boolean; data: WebhookLogItem }>(`/api/webhooks/logs/${logId}/replay`, {
        method: 'POST',
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', 'logs'] });
      queryClient.invalidateQueries({ queryKey: ['webhooks', 'kpis'] });
    },
  });
}

export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: IntegrationItem[] }>('/api/integrations');
      return res.data;
    },
  });
}

export function useUpdateIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ provider, input }: { provider: IntegrationProvider; input: UpdateIntegrationInput }) => {
      const res = await apiRequest<{ success: boolean; data: IntegrationItem }>(`/api/integrations/${provider}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useTestIntegration() {
  return useMutation({
    mutationFn: async (provider: IntegrationProvider) => {
      const res = await apiRequest<{ success: boolean; message: string }>(`/api/integrations/${provider}/test`, {
        method: 'POST',
      });
      return res;
    },
  });
}
