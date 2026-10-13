import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api-client.js';

export interface PendingApprovalItem {
  id: string;
  companyId: string;
  leadId?: string | null;
  agentName: string;
  actionType: string;
  tier: 'T0' | 'T1' | 'T2' | 'T3';
  status: 'proposed' | 'approved' | 'rejected' | 'executed' | 'failed' | 'expired';
  args: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  approvedBy?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  leadName?: string;
  leadPhone?: string;
  leadEmail?: string;
  leadIntentScore?: number;
  leadIntentLabel?: string;
  leadBuyerDna?: Record<string, unknown>;
}

export interface ApprovalsListResponse {
  items: PendingApprovalItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function usePendingApprovals(options: { page?: number; limit?: number; status?: string } = {}) {
  return useQuery({
    queryKey: ['approvals', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.page) params.set('page', String(options.page));
      if (options.limit) params.set('limit', String(options.limit));
      if (options.status) params.set('status', options.status);

      const res = await apiRequest<{ success: boolean; data: ApprovalsListResponse }>(
        `/api/approvals?${params.toString()}`,
      );
      return res.data;
    },
    refetchInterval: 10000, // Poll every 10s for new approval items
  });
}

export function usePendingApprovalsCount() {
  return useQuery({
    queryKey: ['approvals-count'],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; count: number }>(`/api/approvals/count`);
      return res.count;
    },
    refetchInterval: 15000,
  });
}

export function useApproveActionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, editedArgs }: { id: string; editedArgs?: Record<string, unknown> }) => {
      return await apiRequest(`/api/approvals/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ editedArgs }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approvals-count'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useRejectActionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return await apiRequest(`/api/approvals/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approvals-count'] });
    },
  });
}

export function useApprovalHistory(options: { page?: number; limit?: number; tier?: string } = {}) {
  return useQuery({
    queryKey: ['approvals-history', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.page) params.set('page', String(options.page));
      if (options.limit) params.set('limit', String(options.limit));
      if (options.tier) params.set('tier', options.tier);

      const res = await apiRequest<{ success: boolean; data: ApprovalsListResponse }>(
        `/api/approvals/history?${params.toString()}`,
      );
      return res.data;
    },
  });
}
