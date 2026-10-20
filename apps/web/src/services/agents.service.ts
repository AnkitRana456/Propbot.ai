import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AgentItem,
  AgentVersionItem,
  CompareAgentInput,
  CreateAgentInput,
  CreateFormInput,
  FormItem,
  ModelDefinition,
  SaveDraftInput,
  TestAgentInput,
  TestCaseInput,
  UpdateAgentInput,
  UpdateFormInput,
} from '@propbot/shared';
import { apiRequest } from './api-client.js';

const hasToken = () => typeof window !== 'undefined' && Boolean(localStorage.getItem('propbot_access_token'));

export interface AgentDetail {
  agent: AgentItem;
  versions: AgentVersionItem[];
}
export interface AgentTemplateItem {
  id: string;
  name: string;
  description: string;
  tags: string[];
}
export interface AgentTestResult {
  version: number;
  versionId: string;
  model: string;
  reply: string;
  citations: Array<{ sourceTitle: string; snippet: string; similarityScore: number }>;
  isGrounded: boolean;
  tokens: number;
  latencyMs: number;
  instructions: string;
}
export interface CompareResult {
  a: { version: number; versionId: string; model: string };
  b: { version: number; versionId: string; model: string };
  rows: Array<{ message: string; a: AgentTestResult; b: AgentTestResult }>;
}
export interface TestCaseItem {
  id: string;
  name: string;
  messages: string[];
  notes: string | null;
}
export interface KnowledgeReferenceItem {
  id: string;
  name: string;
  description: string | null;
  sourceIds: string[];
}

export const agentKeys = {
  all: ['agents'] as const,
  detail: (id: string) => ['agents', id] as const,
  forms: ['forms'] as const,
};

const json = (body: unknown) => JSON.stringify(body);

// ------------------------------------------------------------------ agents
export function useAgents() {
  return useQuery({ queryKey: agentKeys.all, queryFn: () => apiRequest<AgentItem[]>('/api/agents'), enabled: hasToken() });
}
export function useAgent(id: string | undefined) {
  return useQuery({
    queryKey: agentKeys.detail(id ?? ''),
    queryFn: () => apiRequest<AgentDetail>(`/api/agents/${id}`),
    enabled: hasToken() && Boolean(id),
  });
}
export function useAgentTemplates() {
  return useQuery({ queryKey: ['agent-templates'], queryFn: () => apiRequest<AgentTemplateItem[]>('/api/agents/templates'), enabled: hasToken(), staleTime: 3_600_000 });
}
export function useModelRegistry() {
  return useQuery({
    queryKey: ['agent-models'],
    queryFn: () => apiRequest<{ default: string; models: ModelDefinition[] }>('/api/agents/models'),
    enabled: hasToken(),
    staleTime: 3_600_000,
  });
}

function useAgentMutation<TVars, TData>(fn: (v: TVars) => Promise<TData>, agentId?: (v: TVars) => string | undefined) {
  const qc = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn: fn,
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: agentKeys.all });
      const id = agentId?.(v);
      if (id) void qc.invalidateQueries({ queryKey: agentKeys.detail(id) });
    },
  });
}

export const useCreateAgent = () =>
  useAgentMutation((input: CreateAgentInput) => apiRequest<AgentDetail>('/api/agents', { method: 'POST', body: json(input) }));
export const useUpdateAgent = () =>
  useAgentMutation(
    (v: { id: string; input: UpdateAgentInput }) => apiRequest<AgentItem>(`/api/agents/${v.id}`, { method: 'PATCH', body: json(v.input) }),
    v => v.id,
  );
export const useDeleteAgent = () =>
  useAgentMutation((id: string) => apiRequest<{ deleted: boolean }>(`/api/agents/${id}`, { method: 'DELETE' }), id => id);
export const useSaveDraft = () =>
  useAgentMutation(
    (v: { id: string; patch: SaveDraftInput }) => apiRequest<AgentVersionItem>(`/api/agents/${v.id}/draft`, { method: 'PUT', body: json(v.patch) }),
    v => v.id,
  );
export const usePublishVersion = () =>
  useAgentMutation(
    (v: { id: string; versionId: string; changeNote?: string }) =>
      apiRequest<AgentDetail>(`/api/agents/${v.id}/versions/${v.versionId}/publish`, { method: 'POST', body: json({ changeNote: v.changeNote }) }),
    v => v.id,
  );
export const useRollbackVersion = () =>
  useAgentMutation(
    (v: { id: string; versionId: string }) => apiRequest<AgentDetail>(`/api/agents/${v.id}/versions/${v.versionId}/rollback`, { method: 'POST', body: '{}' }),
    v => v.id,
  );
export const useDiscardDraft = () =>
  useAgentMutation(
    (v: { id: string; versionId: string }) => apiRequest<{ deleted: boolean }>(`/api/agents/${v.id}/versions/${v.versionId}`, { method: 'DELETE' }),
    v => v.id,
  );
export const useAssignAgent = () => {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { chatbotId: string; agentId: string | null }>({
    mutationFn: v => apiRequest('/api/agents/assign', { method: 'POST', body: json(v) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: agentKeys.all });
      void qc.invalidateQueries({ queryKey: ['chatbots'] });
    },
  });
};

export const useTestAgent = () =>
  useMutation<AgentTestResult, Error, { id: string; input: TestAgentInput }>({
    mutationFn: v => apiRequest<AgentTestResult>(`/api/agents/${v.id}/test`, { method: 'POST', body: json(v.input) }),
  });
export const useCompareVersions = () =>
  useMutation<CompareResult, Error, { id: string; input: CompareAgentInput }>({
    mutationFn: v => apiRequest<CompareResult>(`/api/agents/${v.id}/compare`, { method: 'POST', body: json(v.input) }),
  });

export function useTestCases(agentId: string | undefined) {
  return useQuery({
    queryKey: ['agent-test-cases', agentId],
    queryFn: () => apiRequest<TestCaseItem[]>(`/api/agents/${agentId}/test-cases`),
    enabled: hasToken() && Boolean(agentId),
  });
}
export function useSaveTestCase() {
  const qc = useQueryClient();
  return useMutation<TestCaseItem, Error, { agentId: string; input: TestCaseInput; id?: string }>({
    mutationFn: v =>
      apiRequest<TestCaseItem>(`/api/agents/${v.agentId}/test-cases${v.id ? `/${v.id}` : ''}`, {
        method: v.id ? 'PUT' : 'POST',
        body: json(v.input),
      }),
    onSuccess: (_d, v) => void qc.invalidateQueries({ queryKey: ['agent-test-cases', v.agentId] }),
  });
}
export function useDeleteTestCase() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { agentId: string; id: string }>({
    mutationFn: v => apiRequest(`/api/agents/${v.agentId}/test-cases/${v.id}`, { method: 'DELETE' }),
    onSuccess: (_d, v) => void qc.invalidateQueries({ queryKey: ['agent-test-cases', v.agentId] }),
  });
}

// ------------------------------------------------------------------ knowledge references
export function useKnowledgeReferences() {
  return useQuery({ queryKey: ['knowledge-references'], queryFn: () => apiRequest<KnowledgeReferenceItem[]>('/api/knowledge-references'), enabled: hasToken() });
}
export function useSaveKnowledgeReference() {
  const qc = useQueryClient();
  return useMutation<KnowledgeReferenceItem, Error, { id?: string; name: string; description?: string | null; sourceIds: string[] }>({
    mutationFn: ({ id, ...input }) =>
      apiRequest<KnowledgeReferenceItem>(`/api/knowledge-references${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: json(input) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['knowledge-references'] }),
  });
}

// ------------------------------------------------------------------ forms
export function useForms() {
  return useQuery({ queryKey: agentKeys.forms, queryFn: () => apiRequest<FormItem[]>('/api/forms'), enabled: hasToken() });
}
export function useSaveForm() {
  const qc = useQueryClient();
  return useMutation<FormItem, Error, { id?: string; create?: CreateFormInput; update?: UpdateFormInput }>({
    mutationFn: v =>
      v.id
        ? apiRequest<FormItem>(`/api/forms/${v.id}`, { method: 'PUT', body: json(v.update) })
        : apiRequest<FormItem>('/api/forms', { method: 'POST', body: json(v.create) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: agentKeys.forms }),
  });
}
export function useDeleteForm() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: id => apiRequest(`/api/forms/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: agentKeys.forms }),
  });
}
