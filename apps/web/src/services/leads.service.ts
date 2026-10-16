import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api-client.js';
import type {
  LeadsListResponse,
  LeadItemResponse,
  LeadStatus,
  ScoringConfig,
  CaptureLeadInput,
} from '@propbot/shared';

export interface LeadFilterOptions {
  status?: string;
  priority?: string;
  intentLabel?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useLeads(filters: LeadFilterOptions = {}) {
  const queryParams = new URLSearchParams();
  if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);
  if (filters.priority && filters.priority !== 'all') queryParams.append('priority', filters.priority);
  if (filters.intentLabel && filters.intentLabel !== 'all')
    queryParams.append('intentLabel', filters.intentLabel);
  if (filters.search) queryParams.append('search', filters.search);
  if (filters.page) queryParams.append('page', filters.page.toString());
  if (filters.limit) queryParams.append('limit', filters.limit.toString());

  const queryString = queryParams.toString();
  const endpoint = `/api/leads${queryString ? `?${queryString}` : ''}`;

  return useQuery<LeadsListResponse, Error>({
    queryKey: ['leads', filters],
    queryFn: () => apiRequest<LeadsListResponse>(endpoint),
    staleTime: 10 * 1000,
  });
}

export function useLead(id: string | null) {
  return useQuery<LeadItemResponse, Error>({
    queryKey: ['lead', id],
    queryFn: () => apiRequest<LeadItemResponse>(`/api/leads/${id}`),
    enabled: Boolean(id),
  });
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    LeadItemResponse,
    Error,
    { leadId: string; status: LeadStatus; lostReason?: string }
  >({
    mutationFn: ({ leadId, status, lostReason }) =>
      apiRequest<LeadItemResponse>(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, lostReason }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['recent-leads'] });
    },
  });
}

export function useMergeLead() {
  const queryClient = useQueryClient();

  return useMutation<LeadItemResponse, Error, { targetLeadId: string; sourceLeadId: string }>({
    mutationFn: ({ targetLeadId, sourceLeadId }) =>
      apiRequest<LeadItemResponse>(`/api/leads/${targetLeadId}/merge`, {
        method: 'POST',
        body: JSON.stringify({ sourceLeadId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead'] });
    },
  });
}

export function useCaptureLead() {
  const queryClient = useQueryClient();

  return useMutation<{ data: LeadItemResponse; isDuplicate: boolean }, Error, CaptureLeadInput>({
    mutationFn: input =>
      apiRequest<{ data: LeadItemResponse; isDuplicate: boolean }>('/api/leads/capture', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useScoringConfig() {
  return useQuery<ScoringConfig, Error>({
    queryKey: ['scoring-config'],
    queryFn: () => apiRequest<ScoringConfig>('/api/leads/settings/scoring'),
  });
}

export function useUpdateScoringConfig() {
  const queryClient = useQueryClient();

  return useMutation<ScoringConfig, Error, ScoringConfig>({
    mutationFn: config =>
      apiRequest<ScoringConfig>('/api/leads/settings/scoring', {
        method: 'PUT',
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-config'] });
    },
  });
}

export interface LeadConversationMessage {
  id: string;
  senderType: 'visitor' | 'bot' | 'agent' | 'system';
  content: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface LeadConversationResponse {
  conversationId: string | null;
  status: string | null;
  channel: string | null;
  messages: LeadConversationMessage[];
}

export function useLeadConversation(leadId: string | null) {
  return useQuery<LeadConversationResponse, Error>({
    queryKey: ['lead-conversation', leadId],
    queryFn: () => apiRequest<LeadConversationResponse>(`/api/leads/${leadId}/conversation`),
    enabled: Boolean(leadId),
  });
}
