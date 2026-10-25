import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api-client.js';
import type {
  AppointmentItem,
  CreateAppointmentInput,
  RescheduleAppointmentInput,
  UpdateAppointmentStatusInput,
  AppointmentsListResponse,
  AvailableSlotsResponse,
  CalendarIntegrationStatus,
  AppointmentSurveyInput,
  AppointmentStatus,
} from '@propbot/shared';

export interface AppointmentsQueryParams {
  status?: AppointmentStatus | 'all';
  search?: string;
  date?: 'today' | 'upcoming' | 'past' | string;
  agentId?: string;
  projectId?: string;
  leadId?: string;
  page?: number;
  limit?: number;
}

export function useAppointments(params: AppointmentsQueryParams = {}) {
  return useQuery<AppointmentsListResponse>({
    queryKey: ['appointments', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.status && params.status !== 'all') searchParams.set('status', params.status);
      if (params.search) searchParams.set('search', params.search);
      if (params.date && params.date !== 'all') searchParams.set('date', params.date);
      if (params.agentId) searchParams.set('agentId', params.agentId);
      if (params.projectId) searchParams.set('projectId', params.projectId);
      if (params.leadId) searchParams.set('leadId', params.leadId);
      if (params.page) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));

      const res = await apiRequest<AppointmentsListResponse>(
        `/api/appointments?${searchParams.toString()}`,
      );
      return res;
    },
  });
}

export function useAppointment(id: string | undefined) {
  return useQuery<AppointmentItem>({
    queryKey: ['appointment', id],
    queryFn: async () => {
      const res = await apiRequest<AppointmentItem>(
        `/api/appointments/${id}`,
      );
      return res;
    },
    enabled: Boolean(id),
  });
}

export function useAvailableSlots(date: string | undefined, projectId?: string, agentId?: string) {
  return useQuery<AvailableSlotsResponse>({
    queryKey: ['available-slots', date, projectId, agentId],
    queryFn: async () => {
      const searchParams = new URLSearchParams({ date: date! });
      if (projectId) searchParams.set('projectId', projectId);
      if (agentId) searchParams.set('agentId', agentId);

      const res = await apiRequest<AvailableSlotsResponse>(
        `/api/appointments/available-slots?${searchParams.toString()}`,
      );
      return res;
    },
    enabled: Boolean(date),
  });
}

export function useCalendarStatus() {
  return useQuery<CalendarIntegrationStatus>({
    queryKey: ['calendar-status'],
    queryFn: async () => {
      const res = await apiRequest<CalendarIntegrationStatus>(
        '/api/appointments/calendar/status',
      );
      return res;
    },
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAppointmentInput) => {
      const res = await apiRequest<AppointmentItem>(
        '/api/appointments',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useRescheduleAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: RescheduleAppointmentInput }) => {
      const res = await apiRequest<AppointmentItem>(
        `/api/appointments/${id}/reschedule`,
        {
          method: 'PATCH',
          body: JSON.stringify(input),
        },
      );
      return res;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateAppointmentStatusInput }) => {
      const res = await apiRequest<AppointmentItem>(
        `/api/appointments/${id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify(input),
        },
      );
      return res;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useDisconnectCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest<{ success: boolean }>('/api/appointments/calendar/disconnect', {
        method: 'POST',
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-status'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useSubmitSurvey() {
  return useMutation({
    mutationFn: async ({ token, input }: { token: string; input: AppointmentSurveyInput }) => {
      const res = await apiRequest<{ success: boolean; leadId: string }>(
        `/api/appointments/survey/${token}`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return res;
    },
  });
}
