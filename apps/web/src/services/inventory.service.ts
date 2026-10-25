import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api-client.js';
import type {
  ProjectsListResponse,
  ProjectItem,
  CreateProjectInput,
  UpdateProjectInput,
  UnitsListResponse,
  UnitItem,
  CreateUnitInput,
  UnitStatus,
  BulkImportUnitsInput,
  BulkImportReport,
  PropertyBrochureItem,
  CreateBrochureInput,
  RequestBrochureInput,
  RequestBrochureResponse,
  PropertySearchInput,
  PropertyCardResponse,
} from '@propbot/shared';

export const inventoryKeys = {
  all: ['inventory'] as const,
  projects: (params?: Record<string, unknown>) => [...inventoryKeys.all, 'projects', params] as const,
  project: (id: string) => [...inventoryKeys.all, 'project', id] as const,
  units: (projectId: string, params?: Record<string, unknown>) =>
    [...inventoryKeys.all, 'units', projectId, params] as const,
  brochures: (projectId: string) => [...inventoryKeys.all, 'brochures', projectId] as const,
  search: (params?: Record<string, unknown>) => [...inventoryKeys.all, 'search', params] as const,
};

export function useProjects(params?: {
  status?: string;
  search?: string;
  location?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.status) query.append('status', params.status);
  if (params?.search) query.append('search', params.search);
  if (params?.location) query.append('location', params.location);
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  const qs = query.toString();

  return useQuery<ProjectsListResponse, Error>({
    queryKey: inventoryKeys.projects(params),
    queryFn: () => apiRequest<ProjectsListResponse>(`/api/properties/projects${qs ? `?${qs}` : ''}`),
  });
}

export function useProject(id: string | undefined) {
  return useQuery<ProjectItem | null, Error>({
    queryKey: inventoryKeys.project(id || ''),
    queryFn: async () => {
      if (!id) return null;
      return apiRequest<ProjectItem>(`/api/properties/projects/${id}`);
    },
    enabled: Boolean(id),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation<ProjectItem, Error, CreateProjectInput>({
    mutationFn: (input: CreateProjectInput) =>
      apiRequest<ProjectItem>('/api/properties/projects', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation<ProjectItem, Error, { id: string; input: UpdateProjectInput }>({
    mutationFn: ({ id, input }) =>
      apiRequest<ProjectItem>(`/api/properties/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.project(id) });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (id: string) =>
      apiRequest<{ success: boolean }>(`/api/properties/projects/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useUnits(
  projectId: string | undefined,
  params?: { bhk?: number; status?: string; floor?: number; priceMax?: number; page?: number; limit?: number },
) {
  const query = new URLSearchParams();
  if (params?.bhk) query.append('bhk', String(params.bhk));
  if (params?.status) query.append('status', params.status);
  if (params?.floor !== undefined) query.append('floor', String(params.floor));
  if (params?.priceMax) query.append('priceMax', String(params.priceMax));
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  const qs = query.toString();

  return useQuery<UnitsListResponse, Error>({
    queryKey: inventoryKeys.units(projectId || '', params),
    queryFn: async () => {
      if (!projectId) return { items: [], total: 0, page: 1, limit: 50 };
      return apiRequest<UnitsListResponse>(`/api/properties/projects/${projectId}/units${qs ? `?${qs}` : ''}`);
    },
    enabled: Boolean(projectId),
  });
}

export function useCreateUnit() {
  const queryClient = useQueryClient();
  return useMutation<UnitItem, Error, { projectId: string; input: CreateUnitInput }>({
    mutationFn: ({ projectId, input }) =>
      apiRequest<UnitItem>(`/api/properties/projects/${projectId}/units`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.units(projectId) });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.project(projectId) });
    },
  });
}

export function useUpdateUnitStatus() {
  const queryClient = useQueryClient();
  return useMutation<UnitItem, Error, { unitId: string; projectId: string; status: UnitStatus }>({
    mutationFn: ({ unitId, status }) =>
      apiRequest<UnitItem>(`/api/properties/units/${unitId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.units(projectId) });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.project(projectId) });
    },
  });
}

export function useBulkImportUnits() {
  const queryClient = useQueryClient();
  return useMutation<BulkImportReport, Error, { projectId: string; input: BulkImportUnitsInput }>({
    mutationFn: ({ projectId, input }) =>
      apiRequest<BulkImportReport>(`/api/properties/projects/${projectId}/units/import`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.units(projectId) });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.project(projectId) });
    },
  });
}

export function useBrochures(projectId: string | undefined) {
  return useQuery<PropertyBrochureItem[], Error>({
    queryKey: inventoryKeys.brochures(projectId || ''),
    queryFn: async () => {
      if (!projectId) return [];
      return apiRequest<PropertyBrochureItem[]>(`/api/properties/projects/${projectId}/brochures`);
    },
    enabled: Boolean(projectId),
  });
}

export function useCreateBrochure() {
  const queryClient = useQueryClient();
  return useMutation<PropertyBrochureItem, Error, CreateBrochureInput>({
    mutationFn: (input: CreateBrochureInput) =>
      apiRequest<PropertyBrochureItem>(`/api/properties/projects/${input.projectId}/brochures`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.brochures(data.projectId) });
    },
  });
}

export function useRequestBrochure() {
  return useMutation<RequestBrochureResponse, Error, { brochureId: string; input: RequestBrochureInput }>({
    mutationFn: ({ brochureId, input }) =>
      apiRequest<RequestBrochureResponse>(`/api/properties/brochures/${brochureId}/request`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function usePropertySearch() {
  return useMutation<PropertyCardResponse[], Error, PropertySearchInput>({
    mutationFn: (filters: PropertySearchInput) =>
      apiRequest<PropertyCardResponse[]>('/api/properties/search', {
        method: 'POST',
        body: JSON.stringify(filters),
      }),
  });
}

// ── Cost sheets ──────────────────────────────────────────────────────────
export interface CostSheetConfig {
  floorRisePerFloor?: number;
  plcCharges?: { label: string; amountPerSqft: number }[];
  parkingCharge?: number;
  clubhouseCharge?: number;
  maintenanceDeposit?: number;
  gstPercent?: number;
  stampDutyPercent?: number;
  registrationPercent?: number;
}

export interface CostSheetRecord {
  id: string;
  unitId: string;
  leadId: string | null;
  token: string;
  lines: { label: string; amount: number; note?: string }[];
  totals: Record<string, number>;
  discount: string;
  notes: string | null;
  validUntil: string | null;
  viewCount: number;
  createdAt: string;
}

export function useCostSheetConfig(projectId: string | null) {
  return useQuery<CostSheetConfig, Error>({
    queryKey: ['cost-sheet-config', projectId],
    queryFn: () => apiRequest<CostSheetConfig>(`/api/properties/projects/${projectId}/cost-sheet-config`),
    enabled: Boolean(projectId),
  });
}

export function useSaveCostSheetConfig(projectId: string) {
  const qc = useQueryClient();
  return useMutation<CostSheetConfig, Error, CostSheetConfig>({
    mutationFn: (config) =>
      apiRequest<CostSheetConfig>(`/api/properties/projects/${projectId}/cost-sheet-config`, { method: 'PUT', body: JSON.stringify(config) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cost-sheet-config', projectId] }),
  });
}

export function useCreateCostSheet(projectId: string) {
  const qc = useQueryClient();
  return useMutation<CostSheetRecord, Error, { unitId: string; leadId?: string; discount?: number; parkingSlots?: number; notes?: string; validDays?: number }>({
    mutationFn: (input) =>
      apiRequest<CostSheetRecord>(`/api/properties/projects/${projectId}/cost-sheets`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cost-sheets', projectId] }),
  });
}

export function useCostSheets(projectId: string | null, unitId?: string) {
  return useQuery<CostSheetRecord[], Error>({
    queryKey: ['cost-sheets', projectId, unitId],
    queryFn: () => apiRequest<CostSheetRecord[]>(`/api/properties/projects/${projectId}/cost-sheets${unitId ? `?unitId=${unitId}` : ''}`),
    enabled: Boolean(projectId),
  });
}
