import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api-client.js';
import type {
  ContactsListResponse,
  ContactItem,
  CreateContactInput,
  OrganizationsListResponse,
  OrganizationItem,
  CreateOrganizationInput,
  LeadItemResponse,
} from '@propbot/shared';

export const contactKeys = {
  all: ['contacts'] as const,
  list: (params?: Record<string, unknown>) => [...contactKeys.all, 'list', params] as const,
  detail: (id: string) => [...contactKeys.all, 'detail', id] as const,
  orgs: () => ['organizations'] as const,
};

export function useContacts(params?: {
  search?: string;
  organizationId?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.organizationId) query.append('organizationId', params.organizationId);
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  const qs = query.toString();

  return useQuery<ContactsListResponse, Error>({
    queryKey: contactKeys.list(params),
    queryFn: () => apiRequest<ContactsListResponse>(`/api/crm/contacts${qs ? `?${qs}` : ''}`),
  });
}

export function useContact(id: string | undefined) {
  return useQuery<{ contact: ContactItem; leads: LeadItemResponse[] } | null, Error>({
    queryKey: contactKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      return apiRequest<{ contact: ContactItem; leads: LeadItemResponse[] }>(`/api/crm/contacts/${id}`);
    },
    enabled: Boolean(id),
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation<ContactItem, Error, CreateContactInput>({
    mutationFn: async (input: CreateContactInput) =>
      apiRequest<ContactItem>('/api/crm/contacts', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

export function useMergeContacts() {
  const queryClient = useQueryClient();
  return useMutation<{ contact: ContactItem; leads: LeadItemResponse[] }, Error, { sourceContactId: string; targetContactId: string }>({
    mutationFn: async (params: { sourceContactId: string; targetContactId: string }) =>
      apiRequest<{ contact: ContactItem; leads: LeadItemResponse[] }>('/api/crm/contacts/merge', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useOrganizations() {
  return useQuery<OrganizationsListResponse, Error>({
    queryKey: contactKeys.orgs(),
    queryFn: () => apiRequest<OrganizationsListResponse>('/api/crm/organizations'),
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation<OrganizationItem, Error, CreateOrganizationInput>({
    mutationFn: async (input: CreateOrganizationInput) =>
      apiRequest<OrganizationItem>('/api/crm/organizations', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.orgs() });
    },
  });
}
