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
  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('propbot_access_token'));
  return useQuery({
    queryKey: ['approvals', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.page) params.set('page', String(options.page));
      if (options.limit) params.set('limit', String(options.limit));
      if (options.status) params.set('status', options.status);

      const res = await apiRequest<ApprovalsListResponse>(
        `/api/approvals?${params.toString()}`,
      );
      return res;
    },
    enabled: hasToken,
    refetchInterval: hasToken ? 10000 : false,
  });
}

export function usePendingApprovalsCount() {
  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('propbot_access_token'));
  return useQuery({
    queryKey: ['approvals-count'],
    queryFn: async () => {
      try {
        const res = await apiRequest<{ success: boolean; count: number }>(`/api/approvals/count`);
        return (res as { count?: number; data?: { count?: number } })?.count ??
          (res as { data?: { count?: number } })?.data?.count ??
          0;
      } catch {
        return 0;
      }
    },
    enabled: hasToken,
    refetchInterval: hasToken ? 15000 : false,
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

      const res = await apiRequest<ApprovalsListResponse>(
        `/api/approvals/history?${params.toString()}`,
      );
      return res;
    },
  });
}
