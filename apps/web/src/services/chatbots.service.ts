import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ChatbotResponse,
  ChatbotsListResponse,
  CreateChatbotInput,
  UpdateChatbotInput,
  ChatbotStatus,
} from '@propbot/shared';
import { apiRequest } from './api-client.js';

export const CHATBOTS_QUERY_KEYS = {
  all: ['chatbots'] as const,
  lists: () => [...CHATBOTS_QUERY_KEYS.all, 'list'] as const,
  list: (filters?: { status?: string; type?: string; search?: string }) =>
    [...CHATBOTS_QUERY_KEYS.lists(), filters] as const,
  details: () => [...CHATBOTS_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...CHATBOTS_QUERY_KEYS.details(), id] as const,
};

export function useChatbots(filters?: { status?: string; type?: string; search?: string }) {
  const queryParams = new URLSearchParams();
  if (filters?.status && filters.status !== 'all') queryParams.append('status', filters.status);
  if (filters?.type && filters.type !== 'all') queryParams.append('type', filters.type);
  if (filters?.search) queryParams.append('search', filters.search);

  const queryString = queryParams.toString();
  const endpoint = `/api/chatbots${queryString ? `?${queryString}` : ''}`;

  return useQuery<ChatbotsListResponse, Error>({
    queryKey: CHATBOTS_QUERY_KEYS.list(filters),
    queryFn: () => apiRequest<ChatbotsListResponse>(endpoint),
  });
}

export function useChatbot(id: string | undefined) {
  return useQuery<ChatbotResponse, Error>({
    queryKey: CHATBOTS_QUERY_KEYS.detail(id || ''),
    queryFn: () => apiRequest<ChatbotResponse>(`/api/chatbots/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateChatbot() {
  const queryClient = useQueryClient();

  return useMutation<ChatbotResponse, Error, CreateChatbotInput>({
    mutationFn: (input: CreateChatbotInput) =>
      apiRequest<ChatbotResponse>('/api/chatbots', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHATBOTS_QUERY_KEYS.lists() });
    },
  });
}

export function useUpdateChatbot() {
  const queryClient = useQueryClient();

  return useMutation<ChatbotResponse, Error, { id: string; input: UpdateChatbotInput }>({
    mutationFn: ({ id, input }) =>
      apiRequest<ChatbotResponse>(`/api/chatbots/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: CHATBOTS_QUERY_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: CHATBOTS_QUERY_KEYS.detail(data.id) });
    },
  });
}

export function useUpdateChatbotStatus() {
  const queryClient = useQueryClient();

  return useMutation<ChatbotResponse, Error, { id: string; status: ChatbotStatus }>({
    mutationFn: ({ id, status }) =>
      apiRequest<ChatbotResponse>(`/api/chatbots/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: CHATBOTS_QUERY_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: CHATBOTS_QUERY_KEYS.detail(data.id) });
    },
  });
}

export function useDuplicateChatbot() {
  const queryClient = useQueryClient();

  return useMutation<ChatbotResponse, Error, string>({
    mutationFn: (id: string) =>
      apiRequest<ChatbotResponse>(`/api/chatbots/${id}/duplicate`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHATBOTS_QUERY_KEYS.lists() });
    },
  });
}

export function useRotateKey() {
  const queryClient = useQueryClient();

  return useMutation<{ publicKey: string }, Error, string>({
    mutationFn: (id: string) =>
      apiRequest<{ publicKey: string }>(`/api/chatbots/${id}/rotate-key`, {
        method: 'POST',
      }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: CHATBOTS_QUERY_KEYS.detail(id) });
    },
  });
}

export function useDeleteChatbot() {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, string>({
    mutationFn: (id: string) =>
      apiRequest<{ message: string }>(`/api/chatbots/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHATBOTS_QUERY_KEYS.lists() });
    },
  });
}
