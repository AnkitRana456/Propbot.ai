import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, apiRequestEnvelope } from './api-client.js';
import type {
  UserFilter,
  UserKpiMetrics,
  UpdateUserInput,
  InviteUserInput,
  AuditLogFilter,
  UserItem,
  UserInvitationItem,
  AuditLogRecord,
  UserSessionRecord,
} from '@propbot/shared';

function buildUserQuery(filter?: UserFilter): string {
  if (!filter) return '';
  const params = new URLSearchParams();
  if (filter.q) params.append('q', filter.q);
  if (filter.role) params.append('role', filter.role);
  if (filter.status) params.append('status', filter.status);
  if (filter.team) params.append('team', filter.team);
  if (filter.page) params.append('page', String(filter.page));
  if (filter.limit) params.append('limit', String(filter.limit));
  const str = params.toString();
  return str ? `?${str}` : '';
}

export function useUsersList(filter?: UserFilter) {
  return useQuery({
    queryKey: ['users', 'list', filter],
    queryFn: async () => {
      const res = await apiRequestEnvelope<{
        success: boolean;
        data: UserItem[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      }>(`/api/users${buildUserQuery(filter)}`);
      return res;
    },
    staleTime: 10000,
  });
}

export function useUsersKpis() {
  return useQuery({
    queryKey: ['users', 'kpis'],
    queryFn: async () => {
      const res = await apiRequest<UserKpiMetrics>(`/api/users/kpis`);
      return res;
    },
    staleTime: 10000,
  });
}

export function useUserInvitations() {
  return useQuery({
    queryKey: ['users', 'invitations'],
    queryFn: async () => {
      const res = await apiRequest<UserInvitationItem[]>(`/api/users/invitations`);
      return res;
    },
  });
}

export function usePendingUsers() {
  return useQuery({
    queryKey: ['users', 'pending'],
    queryFn: async () => {
      const res = await apiRequest<UserItem[]>(`/api/auth/users/pending`);
      return res;
    },
  });
}

export function useApproveUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest(`/api/auth/users/${userId}/approve`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useRejectUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest(`/api/auth/users/${userId}/reject`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useInviteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteUserInput) => {
      return await apiRequest<{ email: string; inviteUrl: string }>(
        `/api/users/invite`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useRevokeInviteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      return await apiRequest(`/api/users/invitations/${invitationId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserInput }) => {
      return await apiRequest(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/users/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useReset2FaMutation() {
  return useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/users/${id}/reset-2fa`, { method: 'POST' });
    },
  });
}

export function useAuditLogs(filter?: AuditLogFilter) {
  return useQuery({
    queryKey: ['users', 'audit-logs', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter?.action) params.append('action', filter.action);
      if (filter?.resourceType) params.append('resourceType', filter.resourceType);
      if (filter?.page) params.append('page', String(filter.page));
      if (filter?.limit) params.append('limit', String(filter.limit));
      const str = params.toString();
      const res = await apiRequestEnvelope<{
        success: boolean;
        data: AuditLogRecord[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      }>(`/api/users/audit-logs${str ? `?${str}` : ''}`);
      return res;
    },
  });
}

export function useUserSessions() {
  return useQuery({
    queryKey: ['users', 'sessions'],
    queryFn: async () => {
      const res = await apiRequest<UserSessionRecord[]>(`/api/users/sessions`);
      return res;
    },
  });
}

export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (familyId: string) => {
      return await apiRequest(`/api/users/sessions/${familyId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'sessions'] });
    },
  });
}

/** Active people a lead can be assigned to (real team members, never placeholders). */
export function useAssignableAgents(enabled = true) {
  return useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: () => apiRequest<UserItem[]>('/api/users?status=active&limit=100'),
    enabled,
    staleTime: 60_000,
  });
}
