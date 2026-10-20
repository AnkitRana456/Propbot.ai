import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AccessLogItem,
  AssignPolicyInput,
  ChangelogItem,
  CreateDataRequestInput,
  CreateNotificationRuleInput,
  CreatePolicyInput,
  CreateTeamInput,
  DataRequestItem,
  NotificationEntry,
  NotificationRuleItem,
  PolicyChangeItem,
  PolicyItem,
  PrivacySettings,
  TeamItem,
  UsageSummary,
} from '@propbot/shared';
import { apiRequest } from './api-client.js';

const hasToken = () => typeof window !== 'undefined' && Boolean(localStorage.getItem('propbot_access_token'));
const json = (b: unknown) => JSON.stringify(b);
const base = '/api/controls';

function useMut<V, D>(fn: (v: V) => Promise<D>, keys: string[]) {
  const qc = useQueryClient();
  return useMutation<D, Error, V>({ mutationFn: fn, onSuccess: () => keys.forEach(k => void qc.invalidateQueries({ queryKey: ['controls', k] })) });
}
const q = <T,>(key: string, path: string, extra: unknown[] = []) => ({ queryKey: ['controls', key, ...extra], queryFn: () => apiRequest<T>(`${base}${path}`), enabled: hasToken() });

export const usePolicies = () => useQuery(q<PolicyItem[]>('policies', '/policies'));
export const usePolicyChanges = () => useQuery(q<PolicyChangeItem[]>('policy-changes', '/policy-changes'));
export const useCreatePolicy = () => useMut((i: CreatePolicyInput) => apiRequest<PolicyItem>(`${base}/policies`, { method: 'POST', body: json(i) }), ['policies', 'policy-changes']);
export const useDeletePolicy = () => useMut((id: string) => apiRequest<unknown>(`${base}/policies/${id}`, { method: 'DELETE' }), ['policies', 'policy-changes']);
export const useAssignPolicy = () => useMut((v: { id: string; input: AssignPolicyInput }) => apiRequest<PolicyItem>(`${base}/policies/${v.id}/assignments`, { method: 'POST', body: json(v.input) }), ['policies', 'policy-changes']);
export const useUnassignPolicy = () => useMut((v: { id: string; assignmentId: string }) => apiRequest<PolicyItem>(`${base}/policies/${v.id}/assignments/${v.assignmentId}`, { method: 'DELETE' }), ['policies', 'policy-changes']);

export const useTeams = () => useQuery(q<TeamItem[]>('teams', '/teams'));
export const useCreateTeam = () => useMut((i: CreateTeamInput) => apiRequest<TeamItem>(`${base}/teams`, { method: 'POST', body: json(i) }), ['teams']);
export const useDeleteTeam = () => useMut((id: string) => apiRequest<unknown>(`${base}/teams/${id}`, { method: 'DELETE' }), ['teams', 'policies']);

export const useAccessLogs = (f: { action?: string; days: number }) => useQuery(q<AccessLogItem[]>('access-logs', `/access-logs?days=${f.days}${f.action ? `&action=${f.action}` : ''}`, [f]));

export const usePrivacy = () => useQuery(q<PrivacySettings>('privacy', '/privacy'));
export const useSetPrivacy = () => useMut((i: PrivacySettings) => apiRequest<PrivacySettings>(`${base}/privacy`, { method: 'PUT', body: json(i) }), ['privacy']);
export const useDataRequests = () => useQuery(q<DataRequestItem[]>('data-requests', '/data-requests'));
export const useCreateDataRequest = () => useMut((i: CreateDataRequestInput) => apiRequest<DataRequestItem>(`${base}/data-requests`, { method: 'POST', body: json(i) }), ['data-requests']);
export const useDecideDataRequest = () => useMut((v: { id: string; decision: 'approve' | 'reject' }) => apiRequest<DataRequestItem>(`${base}/data-requests/${v.id}/decision`, { method: 'POST', body: json({ decision: v.decision }) }), ['data-requests']);

export const useNotificationRules = () => useQuery(q<NotificationRuleItem[]>('notification-rules', '/notification-rules'));
export const useSaveNotificationRule = () => useMut((i: CreateNotificationRuleInput) => apiRequest<NotificationRuleItem>(`${base}/notification-rules`, { method: 'POST', body: json(i) }), ['notification-rules']);
export const useDeleteNotificationRule = () => useMut((id: string) => apiRequest<unknown>(`${base}/notification-rules/${id}`, { method: 'DELETE' }), ['notification-rules']);
export const useNotificationCentre = () => useQuery({ ...q<{ unreadCount: number; items: NotificationEntry[] }>('notifications', '/notifications'), refetchInterval: 30_000 });
export const useMarkNotificationsRead = () => useMut(() => apiRequest<{ updated: number }>(`${base}/notifications/read`, { method: 'POST', body: '{}' }), ['notifications']);

export const useUsage = (days: number) => useQuery(q<UsageSummary>('usage', `/usage?days=${days}`, [days]));

export interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  usageCount: number;
}
export const useApiKeyList = () => useQuery({ queryKey: ['controls', 'api-keys'], queryFn: () => apiRequest<ApiKeyRow[]>('/api/settings/api-keys'), enabled: hasToken() });
export const useCreateKey = () => useMut((i: { name: string; permissions: string[]; expiresInDays?: number }) => apiRequest<{ id: string; apiKey: string; expiresAt: string | null }>('/api/settings/api-keys', { method: 'POST', body: json(i) }), ['api-keys']);
export const useRevokeKey = () => useMut((id: string) => apiRequest<unknown>(`/api/settings/api-keys/${id}`, { method: 'DELETE' }), ['api-keys']);

export const useChangelog = () => useQuery({ queryKey: ['changelog'], queryFn: () => apiRequest<ChangelogItem[]>('/api/public/controls/changelog') });
