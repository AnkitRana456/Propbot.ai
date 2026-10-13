import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api-client.js';
import type {
  KanbanBoardResponse,
  LeadStatus,
  LeadItemResponse,
  NoteItem,
  TaskItem,
  TasksListResponse,
  CreateTaskInput,
  UpdateTaskInput,
  VisitorTimelineResponse,
  ExportLeadsInput,
  CrmReportsResponse,
} from '@propbot/shared';

export const crmKeys = {
  all: ['crm'] as const,
  pipeline: () => [...crmKeys.all, 'pipeline'] as const,
  notes: (leadId: string) => [...crmKeys.all, 'notes', leadId] as const,
  tasks: (filters?: Record<string, unknown>) => [...crmKeys.all, 'tasks', filters] as const,
  timeline: (leadId: string) => [...crmKeys.all, 'timeline', leadId] as const,
  reports: () => [...crmKeys.all, 'reports'] as const,
};

export function useKanbanBoard() {
  return useQuery<KanbanBoardResponse, Error>({
    queryKey: crmKeys.pipeline(),
    queryFn: () => apiRequest<KanbanBoardResponse>('/api/crm/pipeline'),
  });
}

export function useUpdateStage() {
  const queryClient = useQueryClient();
  return useMutation<
    LeadItemResponse,
    Error,
    { leadId: string; status: LeadStatus; lostReason?: string }
  >({
    mutationFn: params =>
      apiRequest<LeadItemResponse>(`/api/crm/pipeline/${params.leadId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: params.status,
          lostReason: params.lostReason,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.pipeline() });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useBulkUpdateStatus() {
  const queryClient = useQueryClient();
  return useMutation<
    { updatedCount: number },
    Error,
    { leadIds: string[]; status: LeadStatus; lostReason?: string }
  >({
    mutationFn: params =>
      apiRequest<{ updatedCount: number }>('/api/crm/pipeline/bulk-status', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.pipeline() });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useAssignLead() {
  const queryClient = useQueryClient();
  return useMutation<
    LeadItemResponse,
    Error,
    { leadId: string; agentId: string; reason?: string }
  >({
    mutationFn: params =>
      apiRequest<LeadItemResponse>(`/api/crm/leads/${params.leadId}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          agentId: params.agentId,
          reason: params.reason,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.pipeline() });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useRoundRobinAssign() {
  const queryClient = useQueryClient();
  return useMutation<LeadItemResponse, Error, string>({
    mutationFn: leadId =>
      apiRequest<LeadItemResponse>(`/api/crm/leads/${leadId}/round-robin`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.pipeline() });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useBulkAssign() {
  const queryClient = useQueryClient();
  return useMutation<
    { updatedCount: number },
    Error,
    { leadIds: string[]; agentId: string }
  >({
    mutationFn: params =>
      apiRequest<{ updatedCount: number }>('/api/crm/leads/bulk-assign', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.pipeline() });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useLeadNotes(leadId: string | undefined) {
  return useQuery<NoteItem[], Error>({
    queryKey: crmKeys.notes(leadId || ''),
    queryFn: () => (leadId ? apiRequest<NoteItem[]>(`/api/crm/leads/${leadId}/notes`) : Promise.resolve([])),
    enabled: Boolean(leadId),
  });
}

export function useCreateLeadNote() {
  const queryClient = useQueryClient();
  return useMutation<NoteItem, Error, { leadId: string; content: string }>({
    mutationFn: params =>
      apiRequest<NoteItem>(`/api/crm/leads/${params.leadId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: params.content }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: crmKeys.notes(variables.leadId) });
      queryClient.invalidateQueries({ queryKey: crmKeys.timeline(variables.leadId) });
    },
  });
}

export function useDeleteLeadNote() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { noteId: string; leadId: string }>({
    mutationFn: params =>
      apiRequest<{ success: boolean }>(`/api/crm/notes/${params.noteId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: crmKeys.notes(variables.leadId) });
    },
  });
}

export function useTasks(filters?: {
  leadId?: string;
  assignedUserId?: string;
  status?: string;
  myDay?: boolean;
  overdue?: boolean;
}) {
  const queryParams = new URLSearchParams();
  if (filters?.leadId) queryParams.append('leadId', filters.leadId);
  if (filters?.assignedUserId) queryParams.append('assignedUserId', filters.assignedUserId);
  if (filters?.status) queryParams.append('status', filters.status);
  if (filters?.myDay) queryParams.append('myDay', 'true');
  if (filters?.overdue) queryParams.append('overdue', 'true');

  const queryString = queryParams.toString();
  const endpoint = `/api/crm/tasks${queryString ? `?${queryString}` : ''}`;

  return useQuery<TasksListResponse, Error>({
    queryKey: crmKeys.tasks(filters),
    queryFn: () => apiRequest<TasksListResponse>(endpoint),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation<TaskItem, Error, CreateTaskInput>({
    mutationFn: input =>
      apiRequest<TaskItem>('/api/crm/tasks', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: crmKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: crmKeys.timeline(variables.leadId) });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: crmKeys.pipeline() });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation<
    TaskItem,
    Error,
    { taskId: string; input: UpdateTaskInput; leadId?: string }
  >({
    mutationFn: params =>
      apiRequest<TaskItem>(`/api/crm/tasks/${params.taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(params.input),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: crmKeys.tasks() });
      if (variables.leadId) {
        queryClient.invalidateQueries({ queryKey: crmKeys.timeline(variables.leadId) });
      }
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: crmKeys.pipeline() });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { taskId: string; leadId?: string }>({
    mutationFn: params =>
      apiRequest<{ success: boolean }>(`/api/crm/tasks/${params.taskId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useVisitorTimeline(leadId: string | undefined) {
  return useQuery<VisitorTimelineResponse, Error>({
    queryKey: crmKeys.timeline(leadId || ''),
    queryFn: () =>
      leadId
        ? apiRequest<VisitorTimelineResponse>(`/api/crm/leads/${leadId}/timeline`)
        : Promise.resolve({ items: [], total: 0 }),
    enabled: Boolean(leadId),
  });
}

export function useExportLeads() {
  return useMutation<boolean, Error, ExportLeadsInput>({
    mutationFn: async input => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('propbot_access_token') : null;
      const baseUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${baseUrl}/api/crm/export`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        throw new Error('Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads-export-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return true;
    },
  });
}

export function useCrmReports() {
  return useQuery<CrmReportsResponse, Error>({
    queryKey: crmKeys.reports(),
    queryFn: () => apiRequest<CrmReportsResponse>('/api/crm/reports'),
  });
}
