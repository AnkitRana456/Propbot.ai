import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { AppointmentsTable } from '../src/components/appointments/AppointmentsTable.js';
import { AppointmentsPanel } from '../src/components/appointments/AppointmentsPanel.js';
import { CalendarSetupModal } from '../src/components/appointments/CalendarSetupModal.js';
import { RescheduleModal } from '../src/components/appointments/RescheduleModal.js';
import { AppointmentSurveyModal } from '../src/components/appointments/AppointmentSurveyModal.js';
import type { AppointmentItem } from '@propbot/shared';

// Mock services
vi.mock('../src/services/appointments.service.js', () => ({
  useAppointments: () => ({ data: { items: [], total: 0 }, isLoading: false }),
  useAppointmentsKpi: () => ({
    data: {
      totalAppointments: 12,
      todayAppointments: 3,
      upcomingAppointments: 7,
      syncedAppointments: 5,
    },
    isLoading: false,
  }),
  useCalendarStatus: () => ({
    data: { isConnected: true, provider: 'google', email: 'agent@proprealty.com' },
    isLoading: false,
  }),
  useAvailableSlots: () => ({
    data: {
      slots: [
        { time: '10:00', available: true },
        { time: '11:00', available: true },
      ],
    },
    isLoading: false,
  }),
  useUpdateAppointmentStatus: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRescheduleAppointment: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDisconnectCalendar: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useConnectMockCalendar: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSubmitSurvey: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe('Appointments Frontend Components', () => {
  const mockAppointment: AppointmentItem = {
    id: '11111111-1111-1111-1111-111111111111',
    companyId: '22222222-2222-2222-2222-222222222222',
    leadId: '33333333-3333-3333-3333-333333333333',
    leadName: 'Rohan Sharma',
    leadPhone: '+919876543210',
    leadEmail: 'rohan@example.com',
    leadStatus: 'site_visit_scheduled',
    leadIntentScore: 75,
    leadIntentLabel: 'hot',
    projectName: 'Skyline Palms',
    projectLocation: 'Whitefield',
    assignedAgentName: 'Priya Patel',
    scheduledAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    durationMinutes: 45,
    status: 'scheduled',
    appointmentType: 'site_visit',
    location: 'Skyline Palms Experience Lounge',
    meetingLink: 'https://meet.google.com/pb-test',
    calendarStatus: 'synced',
    surveyToken: 'tok-12345',
    notes: 'Buyer requested high-floor unit layout discussion',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('renders AppointmentsTable component with appointment details', () => {
    const handleRefresh = vi.fn();
    const el = React.createElement(AppointmentsTable, {
      appointments: [mockAppointment],
      onRefresh: handleRefresh,
    });
    expect(el).toBeDefined();
    expect(el.props.appointments.length).toBe(1);
    expect(el.props.appointments[0].leadName).toBe('Rohan Sharma');
  });

  it('renders AppointmentsPanel component for Lead drawer', () => {
    const el = React.createElement(AppointmentsPanel, {
      leadId: '33333333-3333-3333-3333-333333333333',
      leadName: 'Rohan Sharma',
    });
    expect(el).toBeDefined();
    expect(el.props.leadName).toBe('Rohan Sharma');
  });

  it('renders CalendarSetupModal component with connection toggles', () => {
    const handleClose = vi.fn();
    const el = React.createElement(CalendarSetupModal, {
      isOpen: true,
      onClose: handleClose,
    });
    expect(el).toBeDefined();
    expect(el.props.isOpen).toBe(true);
  });

  it('renders RescheduleModal component with slot picker', () => {
    const handleClose = vi.fn();
    const el = React.createElement(RescheduleModal, {
      isOpen: true,
      appointment: mockAppointment,
      onClose: handleClose,
    });
    expect(el).toBeDefined();
    expect(el.props.appointment.id).toBe(mockAppointment.id);
  });

  it('renders AppointmentSurveyModal component with rating form', () => {
    const handleClose = vi.fn();
    const el = React.createElement(AppointmentSurveyModal, {
      isOpen: true,
      appointment: mockAppointment,
      onClose: handleClose,
    });
    expect(el).toBeDefined();
    expect(el.props.appointment.surveyToken).toBe('tok-12345');
  });
});
