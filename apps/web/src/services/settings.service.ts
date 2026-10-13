import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api-client.js';
import type {
  UpdateCompanyProfileInput,
  OperationsSettings,
  AiControlsSettings,
  CreateApiKeyInput,
  CompanySettingsResponse,
  ApiKeyRecord,
} from '@propbot/shared';

export function useCompanySettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: CompanySettingsResponse }>(`/api/settings`);
      return res.data;
    },
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateCompanyProfileInput) => {
      return await apiRequest(`/api/settings/profile`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useUpdateOperationsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: OperationsSettings) => {
      return await apiRequest(`/api/settings/operations`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useUpdateAiControlsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AiControlsSettings) => {
      return await apiRequest(`/api/settings/ai-controls`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useApiKeys() {
  return useQuery({
    queryKey: ['settings', 'api-keys'],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; data: ApiKeyRecord[] }>(`/api/settings/api-keys`);
      return res.data;
    },
  });
}

export function useCreateApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateApiKeyInput) => {
      return await apiRequest<{ success: boolean; data: { apiKey: string; key: ApiKeyRecord } }>(`/api/settings/api-keys`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'api-keys'] });
    },
  });
}

export function useRevokeApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/settings/api-keys/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'api-keys'] });
    },
  });
}

export function useSetupTwoFactorMutation() {
  return useMutation({
    mutationFn: async () => {
      return await apiRequest<{ success: boolean; data: { secret: string; otpauthUrl: string } }>(
        `/api/settings/security/2fa/setup`,
        { method: 'POST' },
      );
    },
  });
}

export function useVerifyTwoFactorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      return await apiRequest(`/api/settings/security/2fa/verify`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useDisableTwoFactorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/settings/security/2fa/disable`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useUpdateIpAllowlistMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ips: string[]) => {
      return await apiRequest(`/api/settings/security/ip-allowlist`, {
        method: 'PUT',
        body: JSON.stringify({ ips }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
