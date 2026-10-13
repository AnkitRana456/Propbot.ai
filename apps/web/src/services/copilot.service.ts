import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api-client.js';
import type {
  CopilotSuggestReplyInput,
  CopilotSuggestReplyResponse,
  CopilotSummaryResponse,
  CopilotCallScriptResponse,
  CopilotObjectionRebuttalInput,
  CopilotObjectionRebuttalResponse,
  ObjectionPlaybook,
  CreateObjectionPlaybookInput,
  UpdateObjectionPlaybookInput,
  PlaybooksListResponse,
  ReEngagementSweepResult,
  ReEngagementLogItem,
} from '@propbot/shared';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export function useCopilotSuggestReply(leadId: string) {
  return useMutation<CopilotSuggestReplyResponse, Error, CopilotSuggestReplyInput | undefined>({
    mutationFn: async (input = { tone: 'warm' }) => {
      const res = await apiRequest<ApiResponse<CopilotSuggestReplyResponse>>(
        `/api/crm/leads/${leadId}/copilot/suggest-reply`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return res.data;
    },
  });
}

export function useCopilotSummary(leadId: string) {
  return useMutation<CopilotSummaryResponse, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest<ApiResponse<CopilotSummaryResponse>>(
        `/api/crm/leads/${leadId}/copilot/summary`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
      return res.data;
    },
  });
}

export function useCopilotCallScript(leadId: string) {
  return useMutation<CopilotCallScriptResponse, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest<ApiResponse<CopilotCallScriptResponse>>(
        `/api/crm/leads/${leadId}/copilot/call-script`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
      return res.data;
    },
  });
}

export function useCopilotObjectionRebuttal() {
  return useMutation<CopilotObjectionRebuttalResponse, Error, CopilotObjectionRebuttalInput>({
    mutationFn: async input => {
      const res = await apiRequest<ApiResponse<CopilotObjectionRebuttalResponse>>(
        '/api/crm/leads/dummy/copilot/rebuttal',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return res.data;
    },
  });
}

export function useTranslateText() {
  return useMutation<
    { originalText: string; translatedText: string; detectedLanguage: string; detectedLanguageName: string },
    Error,
    { text: string; targetLanguage?: string }
  >({
    mutationFn: async input => {
      const res = await apiRequest<
        ApiResponse<{ originalText: string; translatedText: string; detectedLanguage: string; detectedLanguageName: string }>
      >('/api/chatbots/translate', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res.data;
    },
  });
}

export function usePlaybooks(chatbotId?: string) {
  return useQuery<PlaybooksListResponse>({
    queryKey: ['playbooks', chatbotId],
    queryFn: async () => {
      const endpoint = chatbotId
        ? `/api/chatbots/${chatbotId}/playbooks`
        : '/api/chatbots/playbooks';
      const res = await apiRequest<ApiResponse<PlaybooksListResponse>>(endpoint);
      return res.data;
    },
  });
}

export function useCreatePlaybook() {
  const queryClient = useQueryClient();
  return useMutation<ObjectionPlaybook, Error, CreateObjectionPlaybookInput>({
    mutationFn: async input => {
      const endpoint = input.chatbotId
        ? `/api/chatbots/${input.chatbotId}/playbooks`
        : '/api/chatbots/playbooks';
      const res = await apiRequest<ApiResponse<ObjectionPlaybook>>(endpoint, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
    },
  });
}

export function useUpdatePlaybook() {
  const queryClient = useQueryClient();
  return useMutation<ObjectionPlaybook, Error, { id: string; chatbotId?: string; input: UpdateObjectionPlaybookInput }>({
    mutationFn: async ({ id, chatbotId, input }) => {
      const endpoint = chatbotId
        ? `/api/chatbots/${chatbotId}/playbooks/${id}`
        : `/api/chatbots/playbooks/${id}`;
      const res = await apiRequest<ApiResponse<ObjectionPlaybook>>(endpoint, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
    },
  });
}

export function useDeletePlaybook() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string; chatbotId?: string }>({
    mutationFn: async ({ id, chatbotId }) => {
      const endpoint = chatbotId
        ? `/api/chatbots/${chatbotId}/playbooks/${id}`
        : `/api/chatbots/playbooks/${id}`;
      await apiRequest<ApiResponse<void>>(endpoint, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
    },
  });
}

export function useReEngagementSweep() {
  return useMutation<ReEngagementSweepResult, Error, { forceAll?: boolean } | undefined>({
    mutationFn: async (options = {}) => {
      const res = await apiRequest<ApiResponse<ReEngagementSweepResult>>(
        '/api/crm/re-engagement/sweep',
        {
          method: 'POST',
          body: JSON.stringify(options),
        },
      );
      return res.data;
    },
  });
}

export function useLeadReEngagementHistory(leadId: string) {
  return useQuery<ReEngagementLogItem[]>({
    queryKey: ['re-engagement-history', leadId],
    queryFn: async () => {
      const res = await apiRequest<ApiResponse<ReEngagementLogItem[]>>(
        `/api/crm/leads/${leadId}/re-engagement-history`,
      );
      return res.data;
    },
    enabled: Boolean(leadId),
  });
}
