import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApplyTagInput,
  BoardItem,
  BoardTaskItem,
  Contact360,
  ConversationInsightItem,
  CreateBoardInput,
  CreateBoardTaskInput,
  CreateDashboardInput,
  CreateGroupInput,
  CreateSurveyInput,
  CreateTagInput,
  CreateWidgetDefInput,
  DashboardItem,
  GroupItem,
  GroupMemberItem,
  GroupRule,
  KbTestResult,
  MetricData,
  SurveyItem,
  SurveyStats,
  TagItem,
  TaskCommentItem,
} from '@propbot/shared';
import { apiRequest } from './api-client.js';

const hasToken = () => typeof window !== 'undefined' && Boolean(localStorage.getItem('propbot_access_token'));
const json = (b: unknown) => JSON.stringify(b);

function useMut<V, D>(fn: (v: V) => Promise<D>, keys: string[]) {
  const qc = useQueryClient();
  return useMutation<D, Error, V>({ mutationFn: fn, onSuccess: () => keys.forEach(k => void qc.invalidateQueries({ queryKey: [k] })) });
}

// tags
export const useTags = () => useQuery({ queryKey: ['tags'], queryFn: () => apiRequest<TagItem[]>('/api/tags'), enabled: hasToken() });
export const useCreateTag = () => useMut((i: CreateTagInput) => apiRequest<TagItem>('/api/tags', { method: 'POST', body: json(i) }), ['tags']);
export const useDeleteTag = () => useMut((id: string) => apiRequest<unknown>(`/api/tags/${id}`, { method: 'DELETE' }), ['tags']);
export const useApplyTag = () => useMut((v: { id: string; input: ApplyTagInput }) => apiRequest<{ applied: number }>(`/api/tags/${v.id}/apply`, { method: 'POST', body: json(v.input) }), ['tags', 'customer360']);

// groups
export const useGroups = () => useQuery({ queryKey: ['groups'], queryFn: () => apiRequest<GroupItem[]>('/api/groups'), enabled: hasToken() });
export const useGroupMembers = (id: string | null) => useQuery({ queryKey: ['groups', id, 'members'], queryFn: () => apiRequest<GroupMemberItem[]>(`/api/groups/${id}/members`), enabled: hasToken() && Boolean(id) });
export const usePreviewGroup = () => useMutation<{ count: number }, Error, GroupRule[]>({ mutationFn: rules => apiRequest('/api/groups/preview', { method: 'POST', body: json({ rules }) }) });
export const useCreateGroup = () => useMut((i: CreateGroupInput) => apiRequest<GroupItem>('/api/groups', { method: 'POST', body: json(i) }), ['groups']);
export const useRefreshGroup = () => useMut((id: string) => apiRequest<GroupItem>(`/api/groups/${id}/refresh`, { method: 'POST', body: '{}' }), ['groups']);
export const useDeleteGroup = () => useMut((id: string) => apiRequest<unknown>(`/api/groups/${id}`, { method: 'DELETE' }), ['groups']);

// surveys
export const useSurveys = () => useQuery({ queryKey: ['surveys'], queryFn: () => apiRequest<SurveyItem[]>('/api/surveys'), enabled: hasToken() });
export const useSurveyStats = (id: string | null) => useQuery({ queryKey: ['surveys', id, 'stats'], queryFn: () => apiRequest<SurveyStats>(`/api/surveys/${id}/stats`), enabled: hasToken() && Boolean(id) });
export const useCreateSurvey = () => useMut((i: CreateSurveyInput) => apiRequest<SurveyItem>('/api/surveys', { method: 'POST', body: json(i) }), ['surveys']);
export const useDeleteSurvey = () => useMut((id: string) => apiRequest<unknown>(`/api/surveys/${id}`, { method: 'DELETE' }), ['surveys']);

// 360 + insights
export const useContact360 = (id: string | undefined) => useQuery({ queryKey: ['customer360', id], queryFn: () => apiRequest<Contact360>(`/api/customer360/contacts/${id}`), enabled: hasToken() && Boolean(id) });
export const useGenerateInsight = () => useMut((conversationId: string) => apiRequest<ConversationInsightItem>(`/api/customer360/conversations/${conversationId}/insight`, { method: 'POST', body: '{}' }), ['customer360']);

// dashboards
export const useDashboards = () => useQuery({ queryKey: ['dashboards'], queryFn: () => apiRequest<DashboardItem[]>('/api/dashboards'), enabled: hasToken() });
export const useWidgetData = (dashboardId: string, widgetId: string) => useQuery({ queryKey: ['dashboards', dashboardId, widgetId], queryFn: () => apiRequest<MetricData>(`/api/dashboards/${dashboardId}/widgets/${widgetId}/data`), enabled: hasToken(), staleTime: 60_000 });
export const useCreateDashboard = () => useMut((i: CreateDashboardInput) => apiRequest<DashboardItem>('/api/dashboards', { method: 'POST', body: json(i) }), ['dashboards']);
export const useDeleteDashboard = () => useMut((id: string) => apiRequest<unknown>(`/api/dashboards/${id}`, { method: 'DELETE' }), ['dashboards']);
export const useAddWidget = () => useMut((v: { id: string; input: CreateWidgetDefInput }) => apiRequest<unknown>(`/api/dashboards/${v.id}/widgets`, { method: 'POST', body: json(v.input) }), ['dashboards']);
export const useRemoveWidget = () => useMut((v: { id: string; widgetId: string }) => apiRequest<unknown>(`/api/dashboards/${v.id}/widgets/${v.widgetId}`, { method: 'DELETE' }), ['dashboards']);

// boards
export const useBoards = () => useQuery({ queryKey: ['boards'], queryFn: () => apiRequest<BoardItem[]>('/api/boards'), enabled: hasToken() });
export const useBoardTasks = (id: string | null) => useQuery({ queryKey: ['board-tasks', id], queryFn: () => apiRequest<BoardTaskItem[]>(`/api/boards/${id}/tasks`), enabled: hasToken() && Boolean(id) });
export const useCreateBoard = () => useMut((i: CreateBoardInput) => apiRequest<BoardItem>('/api/boards', { method: 'POST', body: json(i) }), ['boards']);
export const useDeleteBoard = () => useMut((id: string) => apiRequest<unknown>(`/api/boards/${id}`, { method: 'DELETE' }), ['boards']);
export const useCreateBoardTask = () => useMut((v: { boardId: string; input: CreateBoardTaskInput }) => apiRequest<BoardTaskItem>(`/api/boards/${v.boardId}/tasks`, { method: 'POST', body: json(v.input) }), ['board-tasks', 'boards']);
export const useMoveBoardTask = () => useMut((v: { boardId: string; taskId: string; columnKey: string; position: number }) => apiRequest<BoardTaskItem[]>(`/api/boards/${v.boardId}/tasks/${v.taskId}/move`, { method: 'POST', body: json({ columnKey: v.columnKey, position: v.position }) }), ['board-tasks']);
export const useDeleteBoardTask = () => useMut((v: { boardId: string; taskId: string }) => apiRequest<unknown>(`/api/boards/${v.boardId}/tasks/${v.taskId}`, { method: 'DELETE' }), ['board-tasks', 'boards']);
export const useTaskComments = (boardId: string | null, taskId: string | null) => useQuery({ queryKey: ['task-comments', taskId], queryFn: () => apiRequest<TaskCommentItem[]>(`/api/boards/${boardId}/tasks/${taskId}/comments`), enabled: hasToken() && Boolean(boardId && taskId) });
export const useAddTaskComment = () => useMut((v: { boardId: string; taskId: string; body: string }) => apiRequest<TaskCommentItem>(`/api/boards/${v.boardId}/tasks/${v.taskId}/comments`, { method: 'POST', body: json({ body: v.body }) }), ['task-comments', 'board-tasks']);

// knowledge tester
export const useKbHistory = () => useQuery({ queryKey: ['kb-tester'], queryFn: () => apiRequest<KbTestResult[]>('/api/kb-tester'), enabled: hasToken() });
export const useRunKbTest = () => useMut((v: { chatbotId: string; question: string }) => apiRequest<KbTestResult>('/api/kb-tester', { method: 'POST', body: json(v) }), ['kb-tester']);
