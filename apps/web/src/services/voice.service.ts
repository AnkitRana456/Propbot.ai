import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CallCampaignItem,
  CreateCallCampaignInput,
  CreatePhoneNumberInput,
  CreateVoiceAgentInput,
  DndInput,
  PhoneNumberItem,
  TestCallTurnResult,
  UpdateVoiceAgentInput,
  VoiceAgentItem,
  VoiceAnalytics,
  VoiceCallDetail,
  VoiceCallListItem,
} from '@propbot/shared';
import { apiRequest } from './api-client.js';

const hasToken = () => typeof window !== 'undefined' && Boolean(localStorage.getItem('propbot_access_token'));
const json = (b: unknown) => JSON.stringify(b);
const base = '/api/voice/studio';

export const useVoiceAgents = () => useQuery({ queryKey: ['voice', 'agents'], queryFn: () => apiRequest<VoiceAgentItem[]>(`${base}/agents`), enabled: hasToken() });
export const useVoiceNumbers = () => useQuery({ queryKey: ['voice', 'numbers'], queryFn: () => apiRequest<PhoneNumberItem[]>(`${base}/numbers`), enabled: hasToken() });
export const useDndList = () => useQuery({ queryKey: ['voice', 'dnd'], queryFn: () => apiRequest<Array<{ id: string; phone: string; reason: string; createdAt: string }>>(`${base}/dnd`), enabled: hasToken() });
export const useCampaigns = () => useQuery({ queryKey: ['voice', 'campaigns'], queryFn: () => apiRequest<CallCampaignItem[]>(`${base}/campaigns`), enabled: hasToken(), refetchInterval: 15_000 });
export const useVoiceCalls = (outcome?: string) =>
  useQuery({ queryKey: ['voice', 'calls', outcome], queryFn: () => apiRequest<VoiceCallListItem[]>(`${base}/call-log${outcome ? `?outcome=${outcome}` : ''}`), enabled: hasToken(), refetchInterval: 20_000 });
export const useVoiceCall = (id: string | null) => useQuery({ queryKey: ['voice', 'call', id], queryFn: () => apiRequest<VoiceCallDetail>(`${base}/call-log/${id}`), enabled: hasToken() && Boolean(id) });
export const useVoiceAnalytics = () => useQuery({ queryKey: ['voice', 'analytics'], queryFn: () => apiRequest<VoiceAnalytics>(`${base}/analytics`), enabled: hasToken() });

function useVoiceMutation<V, D>(fn: (v: V) => Promise<D>) {
  const qc = useQueryClient();
  return useMutation<D, Error, V>({ mutationFn: fn, onSuccess: () => void qc.invalidateQueries({ queryKey: ['voice'] }) });
}
export const useCreateVoiceAgent = () => useVoiceMutation((input: CreateVoiceAgentInput) => apiRequest<VoiceAgentItem>(`${base}/agents`, { method: 'POST', body: json(input) }));
export const useUpdateVoiceAgent = () => useVoiceMutation((v: { id: string; input: UpdateVoiceAgentInput }) => apiRequest<VoiceAgentItem>(`${base}/agents/${v.id}`, { method: 'PUT', body: json(v.input) }));
export const useDeleteVoiceAgent = () => useVoiceMutation((id: string) => apiRequest<unknown>(`${base}/agents/${id}`, { method: 'DELETE' }));
export const useStartTestCall = () => useMutation<{ callId: string; greeting: string }, Error, string>({ mutationFn: id => apiRequest(`${base}/agents/${id}/test-call`, { method: 'POST', body: '{}' }) });
export const useCallTurn = () => useMutation<TestCallTurnResult, Error, { callId: string; utterance: string }>({ mutationFn: v => apiRequest(`${base}/calls/${v.callId}/turn`, { method: 'POST', body: json({ utterance: v.utterance }) }) });
export const useEndCall = () => useVoiceMutation((callId: string) => apiRequest<{ outcome: string }>(`${base}/calls/${callId}/end`, { method: 'POST', body: '{}' }));
export const useAddNumber = () => useVoiceMutation((input: CreatePhoneNumberInput) => apiRequest<PhoneNumberItem>(`${base}/numbers`, { method: 'POST', body: json(input) }));
export const useAssignNumber = () => useVoiceMutation((v: { id: string; voiceAgentId: string | null }) => apiRequest<unknown>(`${base}/numbers/${v.id}`, { method: 'PUT', body: json({ voiceAgentId: v.voiceAgentId }) }));
export const useDeleteNumber = () => useVoiceMutation((id: string) => apiRequest<unknown>(`${base}/numbers/${id}`, { method: 'DELETE' }));
export const useAddDnd = () => useVoiceMutation((input: DndInput) => apiRequest<{ added: number }>(`${base}/dnd`, { method: 'POST', body: json(input) }));
export const useRemoveDnd = () => useVoiceMutation((id: string) => apiRequest<unknown>(`${base}/dnd/${id}`, { method: 'DELETE' }));
export const useCreateCampaign = () => useVoiceMutation((input: CreateCallCampaignInput) => apiRequest<CallCampaignItem>(`${base}/campaigns`, { method: 'POST', body: json(input) }));
export const useCampaignStatus = () => useVoiceMutation((v: { id: string; status: 'running' | 'paused' | 'cancelled' }) => apiRequest<CallCampaignItem>(`${base}/campaigns/${v.id}/status`, { method: 'POST', body: json({ status: v.status }) }));
