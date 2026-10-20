import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateFlowInput,
  FlowExecutionDetail,
  FlowExecutionItem,
  FlowItem,
  FlowTemplateItem,
  FlowVersionItem,
  SaveFlowDraftInput,
  TestFlowInput,
  UpdateFlowInput,
} from '@propbot/shared';
import { apiRequest } from './api-client.js';

const hasToken = () => typeof window !== 'undefined' && Boolean(localStorage.getItem('propbot_access_token'));
const json = (b: unknown) => JSON.stringify(b);

export interface FlowDetail {
  flow: FlowItem;
  versions: FlowVersionItem[];
}

export function useFlows() {
  return useQuery({ queryKey: ['flows'], queryFn: () => apiRequest<FlowItem[]>('/api/flows'), enabled: hasToken() });
}
export function useFlow(id: string | undefined) {
  return useQuery({ queryKey: ['flows', id], queryFn: () => apiRequest<FlowDetail>(`/api/flows/${id}`), enabled: hasToken() && Boolean(id) });
}
export function useFlowTemplates() {
  return useQuery({ queryKey: ['flow-templates'], queryFn: () => apiRequest<FlowTemplateItem[]>('/api/flows/templates'), enabled: hasToken(), staleTime: 3_600_000 });
}

function useFlowMutation<V, D>(fn: (v: V) => Promise<D>, flowId?: (v: V) => string | undefined) {
  const qc = useQueryClient();
  return useMutation<D, Error, V>({
    mutationFn: fn,
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['flows'] });
      const id = flowId?.(v);
      if (id) void qc.invalidateQueries({ queryKey: ['flows', id] });
    },
  });
}

export const useCreateFlow = () => useFlowMutation((input: CreateFlowInput) => apiRequest<FlowDetail>('/api/flows', { method: 'POST', body: json(input) }));
export const useUpdateFlow = () =>
  useFlowMutation((v: { id: string; input: UpdateFlowInput }) => apiRequest<FlowItem>(`/api/flows/${v.id}`, { method: 'PATCH', body: json(v.input) }), v => v.id);
export const useDeleteFlow = () => useFlowMutation((id: string) => apiRequest<unknown>(`/api/flows/${id}`, { method: 'DELETE' }), id => id);
export const useSaveFlowDraft = () =>
  useFlowMutation((v: { id: string; input: SaveFlowDraftInput }) => apiRequest<FlowVersionItem>(`/api/flows/${v.id}/draft`, { method: 'PUT', body: json(v.input) }), v => v.id);
export const usePublishFlow = () =>
  useFlowMutation((v: { id: string; versionId: string }) => apiRequest<FlowDetail>(`/api/flows/${v.id}/versions/${v.versionId}/publish`, { method: 'POST', body: '{}' }), v => v.id);
export const useRollbackFlow = () =>
  useFlowMutation((v: { id: string; versionId: string }) => apiRequest<FlowDetail>(`/api/flows/${v.id}/versions/${v.versionId}/rollback`, { method: 'POST', body: '{}' }), v => v.id);
export const useDiscardFlowDraft = () =>
  useFlowMutation((v: { id: string; versionId: string }) => apiRequest<unknown>(`/api/flows/${v.id}/versions/${v.versionId}`, { method: 'DELETE' }), v => v.id);

export function useTestFlow() {
  const qc = useQueryClient();
  return useMutation<FlowExecutionDetail, Error, { id: string; input: Partial<TestFlowInput> }>({
    mutationFn: v => apiRequest<FlowExecutionDetail>(`/api/flows/${v.id}/test`, { method: 'POST', body: json(v.input) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['executions'] }),
  });
}

export function useExecutions(filters: { flowId?: string; status?: string; includeTests?: boolean }) {
  const q = new URLSearchParams();
  if (filters.flowId) q.set('flowId', filters.flowId);
  if (filters.status) q.set('status', filters.status);
  if (filters.includeTests) q.set('includeTests', 'true');
  return useQuery({
    queryKey: ['executions', filters],
    queryFn: () => apiRequest<FlowExecutionItem[]>(`/api/executions?${q.toString()}`),
    enabled: hasToken(),
    refetchInterval: 15_000,
  });
}
export function useExecution(id: string | null) {
  return useQuery({ queryKey: ['executions', id], queryFn: () => apiRequest<FlowExecutionDetail>(`/api/executions/${id}`), enabled: hasToken() && Boolean(id) });
}
export function useCancelExecution() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: id => apiRequest(`/api/executions/${id}/cancel`, { method: 'POST', body: '{}' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['executions'] }),
  });
}
