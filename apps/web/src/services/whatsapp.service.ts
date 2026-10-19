import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api-client.js';
import type {
  WhatsappConfigResponse,
  UpdateWhatsappConfigInput,
  WhatsappOverviewKpi,
  WhatsappConversationFilter,
  WhatsAppConversationItem,
  WhatsAppConversationDetail,
  SendInboxMessageInput,
  BroadcastCampaignInput,
} from '@propbot/shared';

function unpack<T>(res: unknown, fallback?: T): T {
  if (res === null || res === undefined) return fallback !== undefined ? fallback : ({} as T);
  const wrapped = res as { data?: unknown };
  if (wrapped.data !== undefined) return wrapped.data as T;
  return res as T;
}

export function useWhatsappConfig() {
  return useQuery<WhatsappConfigResponse>({
    queryKey: ['whatsapp', 'config'],
    queryFn: async () => {
      const res = await apiRequest<unknown>('/api/whatsapp/config');
      return unpack<WhatsappConfigResponse>(res);
    },
  });
}

export function useUpdateWhatsappConfig() {
  const queryClient = useQueryClient();
  return useMutation<WhatsappConfigResponse, Error, UpdateWhatsappConfigInput>({
    mutationFn: async (input: UpdateWhatsappConfigInput) => {
      const res = await apiRequest<unknown>('/api/whatsapp/config', {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      return unpack<WhatsappConfigResponse>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'config'] });
    },
  });
}

export function useGenerateVerifyToken() {
  const queryClient = useQueryClient();
  return useMutation<{ verifyToken: string }, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest<unknown>('/api/whatsapp/config/generate-token', { method: 'POST' });
      return unpack<{ verifyToken: string }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'config'] });
    },
  });
}

export function useWhatsappOverview() {
  return useQuery<WhatsappOverviewKpi>({
    queryKey: ['whatsapp', 'overview'],
    queryFn: async () => {
      const res = await apiRequest<unknown>('/api/whatsapp/overview');
      return unpack<WhatsappOverviewKpi>(res);
    },
  });
}

export function useWhatsappConversations(filters: Partial<WhatsappConversationFilter> = {}) {
  return useQuery<{ items: WhatsAppConversationItem[]; total: number }>({
    queryKey: ['whatsapp', 'conversations', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.tab && filters.tab !== 'all') params.set('tab', filters.tab);
      if (filters.search) params.set('search', filters.search);
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));

      const res = await apiRequest<unknown>(`/api/whatsapp/conversations?${params.toString()}`);
      return unpack<{ items: WhatsAppConversationItem[]; total: number }>(res, { items: [], total: 0 });
    },
    refetchInterval: 5000,
  });
}

export function useWhatsappConversationDetail(id: string | null) {
  return useQuery<WhatsAppConversationDetail>({
    queryKey: ['whatsapp', 'conversation', id],
    queryFn: async () => {
      const res = await apiRequest<unknown>(`/api/whatsapp/conversations/${id}`);
      return unpack<WhatsAppConversationDetail>(res);
    },
    enabled: Boolean(id),
    refetchInterval: 3000,
  });
}

export function useSendInboxMessage() {
  const queryClient = useQueryClient();
  return useMutation<
    WhatsAppConversationDetail,
    Error,
    { conversationId: string; input: SendInboxMessageInput }
  >({
    mutationFn: async ({ conversationId, input }) => {
      const res = await apiRequest<unknown>(
        `/api/whatsapp/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return unpack<WhatsAppConversationDetail>(res);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversation', vars.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversations'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'overview'] });
    },
  });
}

export function useTakeoverConversation() {
  const queryClient = useQueryClient();
  return useMutation<WhatsAppConversationDetail, Error, string>({
    mutationFn: async (conversationId: string) => {
      const res = await apiRequest<unknown>(
        `/api/whatsapp/conversations/${conversationId}/takeover`,
        { method: 'POST' },
      );
      return unpack<WhatsAppConversationDetail>(res);
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversations'] });
    },
  });
}

export function useResumeAi() {
  const queryClient = useQueryClient();
  return useMutation<WhatsAppConversationDetail, Error, string>({
    mutationFn: async (conversationId: string) => {
      const res = await apiRequest<unknown>(
        `/api/whatsapp/conversations/${conversationId}/resume-ai`,
        { method: 'POST' },
      );
      return unpack<WhatsAppConversationDetail>(res);
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversations'] });
    },
  });
}

export function useAssignConversation() {
  const queryClient = useQueryClient();
  return useMutation<
    WhatsAppConversationDetail,
    Error,
    { conversationId: string; agentId: string }
  >({
    mutationFn: async ({ conversationId, agentId }) => {
      const res = await apiRequest<unknown>(
        `/api/whatsapp/conversations/${conversationId}/assign`,
        {
          method: 'POST',
          body: JSON.stringify({ agentId }),
        },
      );
      return unpack<WhatsAppConversationDetail>(res);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversation', vars.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversations'] });
    },
  });
}

export function useCloseConversation() {
  const queryClient = useQueryClient();
  return useMutation<WhatsAppConversationDetail, Error, string>({
    mutationFn: async (conversationId: string) => {
      const res = await apiRequest<unknown>(
        `/api/whatsapp/conversations/${conversationId}/close`,
        { method: 'POST' },
      );
      return unpack<WhatsAppConversationDetail>(res);
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversations'] });
    },
  });
}

export function useBroadcastCampaign() {
  const queryClient = useQueryClient();
  return useMutation<
    { campaignId: string; totalRecipients: number; sentCount: number },
    Error,
    BroadcastCampaignInput
  >({
    mutationFn: async (input: BroadcastCampaignInput) => {
      const res = await apiRequest<unknown>('/api/whatsapp/campaigns/broadcast', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return unpack<{ campaignId: string; totalRecipients: number; sentCount: number }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'overview'] });
    },
  });
}

export function useQuickConnectSandbox() {
  const queryClient = useQueryClient();
  return useMutation<WhatsappConfigResponse, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest<unknown>('/api/whatsapp/config/quick-connect', { method: 'POST' });
      return unpack<WhatsappConfigResponse>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'config'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversations'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'overview'] });
    },
  });
}

export function useSimulateInboundMessage() {
  const queryClient = useQueryClient();
  return useMutation<
    { success: boolean; conversationId: string; responseSnippet?: string },
    Error,
    { phone: string; name?: string; text: string; isVoiceNote?: boolean }
  >({
    mutationFn: async input => {
      const res = await apiRequest<unknown>('/api/whatsapp/simulate-inbound', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return unpack<{ success: boolean; conversationId: string; responseSnippet?: string }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversations'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'overview'] });
    },
  });
}
