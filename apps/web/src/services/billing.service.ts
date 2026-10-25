import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, apiRequestEnvelope } from './api-client.js';
import type {
  SubscriptionOverview,
  CheckoutSessionInput,
  PurchaseLeadCreditsInput,
  SubscriptionInvoiceFilter,
  InvoiceRecord,
  LeadCreditTransactionRecord,
} from '@propbot/shared';

export function useSubscriptionOverview() {
  return useQuery({
    queryKey: ['billing', 'overview'],
    queryFn: async () => {
      const res = await apiRequest<SubscriptionOverview>(
        `/api/subscription`,
      );
      return res;
    },
    staleTime: 10000,
  });
}

export function useInvoices(filter?: SubscriptionInvoiceFilter) {
  return useQuery({
    queryKey: ['billing', 'invoices', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter?.status) params.append('status', filter.status);
      if (filter?.page) params.append('page', String(filter.page));
      if (filter?.limit) params.append('limit', String(filter.limit));
      const str = params.toString();
      const res = await apiRequestEnvelope<{
        success: boolean;
        data: InvoiceRecord[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      }>(`/api/subscription/invoices${str ? `?${str}` : ''}`);
      return res;
    },
  });
}

export function useCreateCheckoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CheckoutSessionInput) => {
      return await apiRequest<{ checkoutUrl: string; sessionId: string }>(
        `/api/subscription/checkout`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

export function useCancelSubscriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/subscription/cancel`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

export function usePurchaseCreditsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PurchaseLeadCreditsInput) => {
      return await apiRequest<{ success: boolean; creditsAdded: number; newBalance: number }>(
        `/api/subscription/lead-credits`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

export function useLeadCreditTransactions() {
  return useQuery({
    queryKey: ['billing', 'credit-transactions'],
    queryFn: async () => {
      const res = await apiRequest<LeadCreditTransactionRecord[]>(
        `/api/subscription/lead-credits/transactions`,
      );
      return res;
    },
  });
}
