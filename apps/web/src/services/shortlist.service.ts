import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api-client.js';
import type {
  ShortlistRoomResponse,
  ShortlistRoomPublicResponse,
  CreateShortlistRoomInput,
  ShortlistTelemetryInput,
} from '@propbot/shared';

export const shortlistKeys = {
  all: ['shortlist'] as const,
  lead: (leadId: string) => [...shortlistKeys.all, 'lead', leadId] as const,
  publicRoom: (token: string) => [...shortlistKeys.all, 'publicRoom', token] as const,
};

export function useLeadShortlists(leadId: string | undefined) {
  return useQuery<ShortlistRoomResponse[], Error>({
    queryKey: shortlistKeys.lead(leadId || ''),
    queryFn: async () => {
      if (!leadId) return [];
      return apiRequest<ShortlistRoomResponse[]>(`/api/properties/shortlist-rooms/lead/${leadId}`);
    },
    enabled: Boolean(leadId),
  });
}

export function useCreateShortlistRoom() {
  const queryClient = useQueryClient();
  return useMutation<ShortlistRoomResponse, Error, CreateShortlistRoomInput>({
    mutationFn: (input: CreateShortlistRoomInput) =>
      apiRequest<ShortlistRoomResponse>('/api/properties/shortlist-rooms', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: shortlistKeys.lead(leadId) });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function usePublicShortlistRoom(token: string | undefined) {
  return useQuery<ShortlistRoomPublicResponse, Error>({
    queryKey: shortlistKeys.publicRoom(token || ''),
    queryFn: async () => {
      if (!token) throw new Error('Shortlist token required');
      return apiRequest<ShortlistRoomPublicResponse>(`/api/shortlist-room/${token}`);
    },
    enabled: Boolean(token),
    retry: 1,
  });
}

export function useTrackShortlistTelemetry() {
  return useMutation<
    { success: boolean; intentScoreIncreased: boolean },
    Error,
    { token: string; input: ShortlistTelemetryInput }
  >({
    mutationFn: ({ token, input }) =>
      apiRequest<{ success: boolean; intentScoreIncreased: boolean }>(`/api/shortlist-room/${token}/track`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export interface SubmitShortlistRequestInput {
  type: 'visit' | 'callback';
  name: string;
  preferredTime?: string;
  notes?: string;
  projectId?: string;
}

export function useSubmitShortlistRequest() {
  return useMutation<
    { success: boolean; leadId: string; message: string },
    Error,
    { token: string; input: SubmitShortlistRequestInput }
  >({
    mutationFn: ({ token, input }) =>
      apiRequest<{ success: boolean; leadId: string; message: string }>(`/api/shortlist-room/${token}/request`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}
