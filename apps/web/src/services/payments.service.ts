import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AutoTopupInput,
  BillingProfileInput,
  BillingProfileItem,
  CreatePaymentLinkInput,
  CreditAccountItem,
  CreditTransactionItem,
  PaymentOrderItem,
  RefundOrderInput,
} from '@propbot/shared';
import { apiRequest } from './api-client.js';

const hasToken = () => typeof window !== 'undefined' && Boolean(localStorage.getItem('propbot_access_token'));
const json = (b: unknown) => JSON.stringify(b);
const base = '/api/payments';

function useMut<V, D>(fn: (v: V) => Promise<D>, keys: string[]) {
  const qc = useQueryClient();
  return useMutation<D, Error, V>({ mutationFn: fn, onSuccess: () => keys.forEach(k => void qc.invalidateQueries({ queryKey: ['payments', k] })) });
}

export const usePaymentOrders = (kind?: string) =>
  useQuery({ queryKey: ['payments', 'orders', kind], queryFn: () => apiRequest<PaymentOrderItem[]>(`${base}/orders${kind ? `?kind=${kind}` : ''}`), enabled: hasToken(), refetchInterval: 20_000 });
export const useCreatePaymentLink = () => useMut((i: CreatePaymentLinkInput) => apiRequest<PaymentOrderItem>(`${base}/orders`, { method: 'POST', body: json(i) }), ['orders']);
export const useCancelPayment = () => useMut((id: string) => apiRequest<PaymentOrderItem>(`${base}/orders/${id}/cancel`, { method: 'POST', body: '{}' }), ['orders']);
export const useRefundPayment = () => useMut((v: { id: string; input: RefundOrderInput }) => apiRequest<PaymentOrderItem>(`${base}/orders/${v.id}/refund`, { method: 'POST', body: json(v.input) }), ['orders']);
export const useSimulatePaid = () => useMut((id: string) => apiRequest<PaymentOrderItem>(`${base}/orders/${id}/simulate-paid`, { method: 'POST', body: '{}' }), ['orders', 'credits']);

export type CreditsView = CreditAccountItem & { packs: ReadonlyArray<{ id: string; priceInr: number; credits: number; label: string }> };
export const useCredits = () => useQuery({ queryKey: ['payments', 'credits'], queryFn: () => apiRequest<CreditsView>(`${base}/credits`), enabled: hasToken() });
export const useCreditHistory = () => useQuery({ queryKey: ['payments', 'credits-history'], queryFn: () => apiRequest<CreditTransactionItem[]>(`${base}/credits/history`), enabled: hasToken() });
export const useTopup = () => useMut((packId: string) => apiRequest<PaymentOrderItem>(`${base}/credits/topup`, { method: 'POST', body: json({ packId }) }), ['orders', 'credits']);
export const useAutoTopup = () => useMut((i: AutoTopupInput) => apiRequest<CreditAccountItem>(`${base}/credits/auto-topup`, { method: 'PUT', body: json(i) }), ['credits']);

export const useBillingProfile = () => useQuery({ queryKey: ['payments', 'profile'], queryFn: () => apiRequest<BillingProfileItem>(`${base}/profile`), enabled: hasToken() });
export const useSaveBillingProfile = () => useMut((i: BillingProfileInput) => apiRequest<BillingProfileItem>(`${base}/profile`, { method: 'PUT', body: json(i) }), ['profile']);
