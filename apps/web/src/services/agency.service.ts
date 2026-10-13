import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api-client.js';
import type {
  CreateClientCompanyInput,
  UpdateClientDeliveryRulesInput,
  AssignChatbotClientInput,
  AgencyClientItem,
  ClientPortalData,
} from '@propbot/shared';

export function useAgencyClients() {
  return useQuery({
    queryKey: ['agency', 'clients'],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: AgencyClientItem[] }>(`/api/agency/clients`);
      return res.data;
    },
  });
}

export function useCreateClientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateClientCompanyInput) => {
      return await apiRequest(`/api/agency/clients`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency', 'clients'] });
    },
  });
}

export function useUpdateDeliveryRulesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateClientDeliveryRulesInput }) => {
      return await apiRequest(`/api/agency/clients/${id}/delivery-rules`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency', 'clients'] });
    },
  });
}

export function useAssignChatbotMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AssignChatbotClientInput }) => {
      return await apiRequest(`/api/agency/chatbots/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency', 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['chatbots'] });
    },
  });
}

export function useClientPortalData() {
  return useQuery({
    queryKey: ['agency', 'portal'],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: ClientPortalData }>(`/api/agency/portal`);
      return res.data;
    },
  });
}
