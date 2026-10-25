import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChannelConnectionItem,
  CreateChannelConnectionInput,
  CreateLeadSourceInput,
  CreateTemplateInput,
  CreateWidgetInput,
  InboxConversationDetail,
  InboxConversationItem,
  InboxNoteInput,
  InboxNoteItem,
  InboxReplyInput,
  InboxUpdateInput,
  LeadSourceEventItem,
  LeadSourceItem,
  MessageTemplateItem,
  UpdateLeadSourceInput,
  UpdateWidgetInput,
  WidgetItem,
} from '@propbot/shared';
import { apiRequest } from './api-client.js';

const hasToken = () => typeof window !== 'undefined' && Boolean(localStorage.getItem('propbot_access_token'));
const json = (b: unknown) => JSON.stringify(b);

// ------------------------------------------------------------------ inbox
export interface InboxFilters {
  status?: string;
  channel?: string;
  assignee?: string;
  search?: string;
}
export function useInbox(filters: InboxFilters) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
  return useQuery({
    queryKey: ['inbox', filters],
    queryFn: () => apiRequest<{ items: InboxConversationItem[]; total: number }>(`/api/inbox?${q.toString()}`),
    enabled: hasToken(),
    refetchInterval: 10_000,
  });
}
export function useInboxCounts() {
  return useQuery({ queryKey: ['inbox-counts'], queryFn: () => apiRequest<Record<string, number>>('/api/inbox/counts'), enabled: hasToken(), refetchInterval: 20_000 });
}
export function useConversation(id: string | null) {
  return useQuery({ queryKey: ['inbox', 'detail', id], queryFn: () => apiRequest<InboxConversationDetail>(`/api/inbox/${id}`), enabled: hasToken() && Boolean(id), refetchInterval: 8_000 });
}

function useInboxMutation<V, D>(fn: (v: V) => Promise<D>) {
  const qc = useQueryClient();
  return useMutation<D, Error, V>({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      void qc.invalidateQueries({ queryKey: ['inbox-counts'] });
    },
  });
}
export const useReply = () => useInboxMutation((v: { id: string; input: InboxReplyInput }) => apiRequest<InboxConversationDetail>(`/api/inbox/${v.id}/reply`, { method: 'POST', body: json(v.input) }));
export const useTakeControl = () => useInboxMutation((id: string) => apiRequest<InboxConversationDetail>(`/api/inbox/${id}/take-control`, { method: 'POST', body: '{}' }));
export const useHandBack = () => useInboxMutation((id: string) => apiRequest<InboxConversationDetail>(`/api/inbox/${id}/hand-back`, { method: 'POST', body: '{}' }));
export const useUpdateConversation = () => useInboxMutation((v: { id: string; input: InboxUpdateInput }) => apiRequest<InboxConversationDetail>(`/api/inbox/${v.id}`, { method: 'PATCH', body: json(v.input) }));
export const useAddNote = () => useInboxMutation((v: { id: string; input: InboxNoteInput }) => apiRequest<InboxNoteItem>(`/api/inbox/${v.id}/notes`, { method: 'POST', body: json(v.input) }));

// ------------------------------------------------------------------ lead sources
export function useLeadSources() {
  return useQuery({ queryKey: ['lead-sources'], queryFn: () => apiRequest<LeadSourceItem[]>('/api/lead-sources'), enabled: hasToken() });
}
export function useLeadSourceEvents(id: string | null) {
  return useQuery({ queryKey: ['lead-sources', id, 'events'], queryFn: () => apiRequest<LeadSourceEventItem[]>(`/api/lead-sources/${id}/events`), enabled: hasToken() && Boolean(id) });
}
function useSourceMutation<V, D>(fn: (v: V) => Promise<D>) {
  const qc = useQueryClient();
  return useMutation<D, Error, V>({ mutationFn: fn, onSuccess: () => void qc.invalidateQueries({ queryKey: ['lead-sources'] }) });
}
export const useCreateLeadSource = () => useSourceMutation((input: CreateLeadSourceInput) => apiRequest<{ source: LeadSourceItem; apiKey: string }>('/api/lead-sources', { method: 'POST', body: json(input) }));
export const useUpdateLeadSource = () => useSourceMutation((v: { id: string; input: UpdateLeadSourceInput }) => apiRequest<LeadSourceItem>(`/api/lead-sources/${v.id}`, { method: 'PUT', body: json(v.input) }));
export const useRotateLeadSourceKey = () => useSourceMutation((id: string) => apiRequest<{ source: LeadSourceItem; apiKey: string }>(`/api/lead-sources/${id}/rotate-key`, { method: 'POST', body: '{}' }));
export const useDeleteLeadSource = () => useSourceMutation((id: string) => apiRequest<unknown>(`/api/lead-sources/${id}`, { method: 'DELETE' }));
export const useImportCsv = () =>
  useSourceMutation((v: { id: string; csv: string }) =>
    apiRequest<{ total: number; processed: number; duplicate: number; rejected: number; failed: number; errors: Array<{ row: number; error: string }> }>(`/api/lead-sources/${v.id}/import-csv`, { method: 'POST', body: json({ csv: v.csv }) }),
  );

// ------------------------------------------------------------------ channels / templates / widgets
export function useConnections() {
  return useQuery({ queryKey: ['channels', 'connections'], queryFn: () => apiRequest<ChannelConnectionItem[]>('/api/channels/connections'), enabled: hasToken() });
}
export function useTemplates() {
  return useQuery({ queryKey: ['channels', 'templates'], queryFn: () => apiRequest<MessageTemplateItem[]>('/api/channels/templates'), enabled: hasToken() });
}
export function useWidgets() {
  return useQuery({ queryKey: ['channels', 'widgets'], queryFn: () => apiRequest<WidgetItem[]>('/api/channels/widgets'), enabled: hasToken() });
}
function useChannelMutation<V, D>(fn: (v: V) => Promise<D>) {
  const qc = useQueryClient();
  return useMutation<D, Error, V>({ mutationFn: fn, onSuccess: () => void qc.invalidateQueries({ queryKey: ['channels'] }) });
}
export const useCreateConnection = () => useChannelMutation((input: CreateChannelConnectionInput) => apiRequest<ChannelConnectionItem>('/api/channels/connections', { method: 'POST', body: json(input) }));
export const useTestConnection = () => useChannelMutation((id: string) => apiRequest<ChannelConnectionItem>(`/api/channels/connections/${id}/test`, { method: 'POST', body: '{}' }));
export const useDeleteConnection = () => useChannelMutation((id: string) => apiRequest<unknown>(`/api/channels/connections/${id}`, { method: 'DELETE' }));
export const useCreateTemplate = () => useChannelMutation((input: CreateTemplateInput) => apiRequest<MessageTemplateItem>('/api/channels/templates', { method: 'POST', body: json(input) }));
export const useSubmitTemplate = () => useChannelMutation((id: string) => apiRequest<MessageTemplateItem>(`/api/channels/templates/${id}/submit`, { method: 'POST', body: '{}' }));
export const useSyncTemplate = () => useChannelMutation((id: string) => apiRequest<MessageTemplateItem>(`/api/channels/templates/${id}/sync`, { method: 'POST', body: '{}' }));
export const useDeleteTemplate = () => useChannelMutation((id: string) => apiRequest<unknown>(`/api/channels/templates/${id}`, { method: 'DELETE' }));
export const useCreateWidget = () => useChannelMutation((input: CreateWidgetInput) => apiRequest<WidgetItem>('/api/channels/widgets', { method: 'POST', body: json(input) }));
export const useUpdateWidget = () => useChannelMutation((v: { id: string; input: UpdateWidgetInput }) => apiRequest<WidgetItem>(`/api/channels/widgets/${v.id}`, { method: 'PUT', body: json(v.input) }));
export const useDeleteWidget = () => useChannelMutation((id: string) => apiRequest<unknown>(`/api/channels/widgets/${id}`, { method: 'DELETE' }));
