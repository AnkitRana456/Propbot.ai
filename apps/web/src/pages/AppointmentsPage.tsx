import React, { useState } from 'react';
import {
  Calendar,
  CalendarCheck,
  CalendarClock,
  Layers,
  Search,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
} from 'lucide-react';
import { useAppointments } from '../services/appointments.service.js';
import { AppointmentsTable } from '../components/appointments/AppointmentsTable.js';
import { BookAppointmentModal } from '../components/appointments/BookAppointmentModal.js';
import { CalendarSetupModal } from '../components/appointments/CalendarSetupModal.js';
import { EmptyState } from '../components/common/EmptyState.js';
import type { AppointmentStatus } from '@propbot/shared';

export const AppointmentsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'upcoming' | 'past'>('all');

  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  const { data, isLoading, refetch, isFetching } = useAppointments({
    search: search.trim() || undefined,
    status: statusFilter,
    date: dateFilter,
    limit: 100,
  });

  const kpis = data?.kpis || {
    upcoming: 0,
    today: 0,
    calendarSynced: 0,
    all: 0,
  };

  const appointmentsList = data?.items || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Site Visit Appointments
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage buyer viewing schedules, Google Calendar synchronization, and post-visit surveys.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh appointments"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition-all active:scale-95"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setIsCalendarModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 dark:border-slate-800 dark:bg-slate-900 dark:text-purple-300 dark:hover:bg-purple-950/30 transition-all active:scale-95 shadow-sm"
          >
            <Calendar className="h-4 w-4" />
            Calendar Setup
          </button>

          <button
            type="button"
            onClick={() => setIsBookModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            Book Appointment
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Upcoming */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Upcoming Visits
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <CalendarClock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {kpis.upcoming}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Scheduled for future dates</span>
        </div>

        {/* Today */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Today's Schedule
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <CalendarCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {kpis.today}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Due for viewing today</span>
        </div>

        {/* Calendar Synced */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Calendar Synced
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {kpis.calendarSynced}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Mirrored to Google Calendar</span>
        </div>

        {/* All */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              All Appointments
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {kpis.all}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Total lifetime bookings</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by visitor, phone, project, or agent..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-800/60 dark:text-white"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-slate-400 flex items-center gap-1 mr-1 shrink-0">
            <SlidersHorizontal className="h-3 w-3" />
            Status:
          </span>
          {(['all', 'scheduled', 'confirmed', 'completed', 'no_show', 'cancelled'] as const).map(st => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5 shrink-0">
          {(['all', 'today', 'upcoming', 'past'] as const).map(df => (
            <button
              key={df}
              type="button"
              onClick={() => setDateFilter(df)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                dateFilter === df
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {df}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table / States */}
      {isLoading ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-blue-500 mb-2" />
          Loading appointments...
        </div>
      ) : appointmentsList.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-7 w-7" />}
          title="No site visits found"
          description={
            search || statusFilter !== 'all' || dateFilter !== 'all'
              ? 'Try modifying your search query or status filter to see other appointments.'
              : 'Start scheduling prospective buyer site visits or connect your Google Calendar.'
          }
          actionLabel="Book Appointment"
          onAction={() => setIsBookModalOpen(true)}
        />
      ) : (
        <AppointmentsTable appointments={appointmentsList} onRefresh={() => refetch()} />
      )}

      {/* Book Appointment Modal */}
      {isBookModalOpen && (
        <BookAppointmentModal
          isOpen={isBookModalOpen}
          onClose={() => setIsBookModalOpen(false)}
          onSuccess={() => refetch()}
        />
      )}

      {/* Google Calendar Setup Modal */}
      {isCalendarModalOpen && (
        <CalendarSetupModal
          isOpen={isCalendarModalOpen}
          onClose={() => setIsCalendarModalOpen(false)}
        />
      )}
    </div>
  );
};
