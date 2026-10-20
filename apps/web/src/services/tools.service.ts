import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActionDefinitionItem, CreateToolInput, ToolItem, ToolRunItem, UpdateToolInput } from '@propbot/shared';
import { apiRequest } from './api-client.js';

const hasToken = () => typeof window !== 'undefined' && Boolean(localStorage.getItem('propbot_access_token'));
const json = (b: unknown) => JSON.stringify(b);

export function useTools() {
  return useQuery({ queryKey: ['tools'], queryFn: () => apiRequest<ToolItem[]>('/api/tools'), enabled: hasToken() });
}
export function useToolRuns(id: string | undefined) {
  return useQuery({ queryKey: ['tool-runs', id], queryFn: () => apiRequest<ToolRunItem[]>(`/api/tools/${id}/runs`), enabled: hasToken() && Boolean(id) });
}
export function useActions() {
  return useQuery({ queryKey: ['actions'], queryFn: () => apiRequest<ActionDefinitionItem[]>('/api/actions'), enabled: hasToken(), staleTime: 3_600_000 });
}

export function useSaveTool() {
  const qc = useQueryClient();
  return useMutation<ToolItem, Error, { id?: string; create?: CreateToolInput; update?: UpdateToolInput }>({
    mutationFn: v =>
      v.id
        ? apiRequest<ToolItem>(`/api/tools/${v.id}`, { method: 'PUT', body: json(v.update) })
        : apiRequest<ToolItem>('/api/tools', { method: 'POST', body: json(v.create) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tools'] }),
  });
}
export function useDeleteTool() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: id => apiRequest(`/api/tools/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tools'] }),
  });
}
export function useRunTool() {
  const qc = useQueryClient();
  return useMutation<ToolRunItem, Error, { id: string; input: Record<string, unknown> }>({
    mutationFn: v => apiRequest<ToolRunItem>(`/api/tools/${v.id}/run`, { method: 'POST', body: json({ input: v.input }) }),
    onSuccess: (_d, v) => void qc.invalidateQueries({ queryKey: ['tool-runs', v.id] }),
  });
}
export function useRunAction() {
  return useMutation<Record<string, unknown>, Error, { id: string; input: Record<string, unknown> }>({
    mutationFn: v => apiRequest<Record<string, unknown>>(`/api/actions/${v.id}/run`, { method: 'POST', body: json({ input: v.input }) }),
  });
}
