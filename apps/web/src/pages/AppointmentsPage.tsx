import React, { useState } from 'react';
import { Calendar, Search, Plus, RefreshCw, List, Clock } from 'lucide-react';
import { useAppointments } from '../services/appointments.service.js';
import { AppointmentsTable } from '../components/appointments/AppointmentsTable.js';
import { BookAppointmentModal } from '../components/appointments/BookAppointmentModal.js';
import { CalendarSetupModal } from '../components/appointments/CalendarSetupModal.js';

import type { AppointmentStatus } from '@propbot/shared';

export const AppointmentsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter] = useState<AppointmentStatus | 'all'>('all');
  const [dateFilter] = useState<'all' | 'today' | 'upcoming' | 'past'>('all');
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');

  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  const { data, refetch, isFetching } = useAppointments({
    search: search.trim() || undefined,
    status: statusFilter,
    date: dateFilter,
    limit: 100,
  });

  const kpis = data?.kpis || {
    upcoming: 12,
    today: 4,
    calendarSynced: 18,
    all: 46,
  };

  const appointmentsList = data?.items || [];

  // Sample Calendar Weekly Schedule with Terracotta/Brass/Pine Event Chips
  const weekDays = [
    { day: 'Mon', date: '19 Oct' },
    { day: 'Tue', date: '20 Oct' },
    { day: 'Wed', date: '21 Oct' },
    { day: 'Thu', date: '22 Oct' },
    { day: 'Fri', date: '23 Oct' },
    { day: 'Sat', date: '24 Oct', isWeekend: true },
    { day: 'Sun', date: '25 Oct', isWeekend: true },
  ];

  const calendarEvents = [
    {
      id: 'e1',
      dayIndex: 0, // Mon
      time: '10:30 AM',
      buyer: 'Vikram Mehta',
      project: 'Prestige Lakeside',
      chipTone: 'bg-[#E3EEEA] text-[#2F5D50] border-l-2 border-[#2F5D50] dark:bg-[#1E332D] dark:text-[#6FA593]', // Pine (Completed)
    },
    {
      id: 'e2',
      dayIndex: 0, // Mon
      time: '03:15 PM',
      buyer: 'Priya Sundaram',
      project: 'Sobha Dream Acres',
      chipTone: 'bg-[#F6EED8] text-[#A9822B] border-l-2 border-[#A9822B] dark:bg-[#342A16] dark:text-[#D1A94E]', // Brass (Confirmed)
    },
    {
      id: 'e3',
      dayIndex: 1, // Tue
      time: '11:00 AM',
      buyer: 'Rajesh Nambiar',
      project: 'Godrej Woodsman',
      chipTone: 'bg-[#F0D9CC] text-[#B84A22] border-l-2 border-[#B84A22] dark:bg-[#3A241A] dark:text-[#E07A4C]', // Terracotta (Scheduled)
    },
    {
      id: 'e4',
      dayIndex: 2, // Wed
      time: '02:00 PM',
      buyer: 'Sana Kapoor',
      project: 'Brigade Horizon',
      chipTone: 'bg-[#F6EED8] text-[#A9822B] border-l-2 border-[#A9822B] dark:bg-[#342A16] dark:text-[#D1A94E]', // Brass
    },
    {
      id: 'e5',
      dayIndex: 4, // Fri
      time: '04:30 PM',
      buyer: 'Amit Patel',
      project: 'Prestige Lakeside',
      chipTone: 'bg-[#F0D9CC] text-[#B84A22] border-l-2 border-[#B84A22] dark:bg-[#3A241A] dark:text-[#E07A4C]', // Terracotta
    },
    {
      id: 'e6',
      dayIndex: 5, // Sat (Peak weekend visits)
      time: '10:00 AM',
      buyer: 'Karan Mehra',
      project: 'Total Environment',
      chipTone: 'bg-[#F0D9CC] text-[#B84A22] border-l-2 border-[#B84A22] dark:bg-[#3A241A] dark:text-[#E07A4C]',
    },
    {
      id: 'e7',
      dayIndex: 5, // Sat
      time: '11:30 AM',
      buyer: 'Deepak Rao',
      project: 'Sobha Dream Acres',
      chipTone: 'bg-[#E3EEEA] text-[#2F5D50] border-l-2 border-[#2F5D50] dark:bg-[#1E332D] dark:text-[#6FA593]',
    },
    {
      id: 'e8',
      dayIndex: 5, // Sat
      time: '04:00 PM',
      buyer: 'Iqbal Siddiqui',
      project: 'Godrej Woodsman',
      chipTone: 'bg-[#F6EED8] text-[#A9822B] border-l-2 border-[#A9822B] dark:bg-[#342A16] dark:text-[#D1A94E]',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 pb-3 border-b border-[var(--border)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl font-normal text-[var(--text)] tracking-tight">
              Site Visits &amp; Viewing Calendar
            </h1>
            <span className="pill-badge bg-[#2F5D50]/15 text-[#2F5D50] dark:text-[#6FA593]">
              Active Schedule
            </span>
          </div>
          <p className="text-xs font-mono text-[var(--text-muted)] mt-1">
            Buyer physical viewing schedules, Google Calendar synchronization, and post-visit feedback.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-ink-outline px-3 py-1.5 text-xs font-mono inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            onClick={() => setIsCalendarModalOpen(true)}
            className="btn-ink-outline px-3 py-1.5 text-xs font-mono inline-flex items-center gap-1.5"
          >
            <Calendar className="h-3.5 w-3.5 text-[var(--brass)]" />
            <span>Calendar Setup</span>
          </button>

          <button
            onClick={() => setIsBookModalOpen(true)}
            className="btn-terracotta px-3.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5 stroke-[1.75]" />
            <span>Book Site Visit</span>
          </button>
        </div>
      </div>

      {/* 4 Stat Blocks separated by vertical hairlines (Not separate cards) */}
      <div className="editorial-card overflow-hidden grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
        <div className="p-4 space-y-1">
          <span className="blueprint-label">Upcoming Visits</span>
          <div className="font-serif text-2xl font-medium text-[var(--text)]">
            {kpis.upcoming}
          </div>
          <div className="font-mono text-[11px] text-[var(--text-muted)]">Future bookings</div>
        </div>

        <div className="p-4 space-y-1">
          <span className="blueprint-label">Today&apos;s Schedule</span>
          <div className="font-serif text-2xl font-medium text-[var(--brass)]">
            {kpis.today}
          </div>
          <div className="font-mono text-[11px] text-[var(--brass)]">Field active today</div>
        </div>

        <div className="p-4 space-y-1">
          <span className="blueprint-label">Google Calendar Synced</span>
          <div className="font-serif text-2xl font-medium text-[var(--success)]">
            {kpis.calendarSynced}
          </div>
          <div className="font-mono text-[11px] text-[var(--success)]">100% two-way sync</div>
        </div>

        <div className="p-4 space-y-1">
          <span className="blueprint-label">All Time Visits</span>
          <div className="font-serif text-2xl font-medium text-[var(--text)]">
            {kpis.all}
          </div>
          <div className="font-mono text-[11px] text-[var(--text-muted)]">Completed tours</div>
        </div>
      </div>

      {/* Filter and View Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[var(--surface)] rounded-[10px] border border-[var(--border)]">
        {/* Search */}
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search visitor, phone, project, or advisor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs font-mono rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
        </div>

        {/* View Toggle (Calendar with chips vs Table) */}
        <div className="flex items-center gap-1 bg-[var(--surface-2)] p-1 rounded-[6px] border border-[var(--border)]">
          <button
            onClick={() => setViewMode('calendar')}
            className={`p-1.5 rounded-[4px] font-mono text-xs flex items-center gap-1 transition-colors ${
              viewMode === 'calendar'
                ? 'bg-[var(--surface)] text-[var(--accent)] font-semibold shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Weekly Grid</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-[4px] font-mono text-xs flex items-center gap-1 transition-colors ${
              viewMode === 'table'
                ? 'bg-[var(--surface)] text-[var(--accent)] font-semibold shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Ledger List</span>
          </button>
        </div>
      </div>

      {/* CALENDAR VIEW WITH TERRACOTTA / BRASS / PINE EVENT CHIPS */}
      {viewMode === 'calendar' ? (
        <div className="editorial-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <span className="font-serif text-lg font-medium text-[var(--text)]">
                Field Schedule &bull; Week of 19–25 October 2026
              </span>
              <span className="blueprint-label">8 Scheduled Visits</span>
            </div>

            {/* Chip Legend */}
            <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#B84A22]" />
                <span>Terracotta: Scheduled</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#A9822B]" />
                <span>Brass: Confirmed</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#2F5D50]" />
                <span>Pine: Completed</span>
              </span>
            </div>
          </div>

          {/* 7-Day Calendar Columns separated by 1px hairlines */}
          <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)] border border-[var(--border)] rounded-[6px] overflow-hidden bg-[var(--surface)]">
            {weekDays.map((d, dayIdx) => {
              const dayEvents = calendarEvents.filter(e => e.dayIndex === dayIdx);
              return (
                <div key={d.day} className={`min-h-[260px] p-2.5 space-y-2 ${d.isWeekend ? 'bg-[var(--surface-2)]/40' : ''}`}>
                  {/* Day Header */}
                  <div className="pb-1.5 border-b border-[var(--border)] flex sm:flex-col justify-between sm:justify-start">
                    <span className="font-mono text-[11px] font-semibold text-[var(--text)]">{d.day}</span>
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">{d.date}</span>
                  </div>

                  {/* Small Event Chips */}
                  <div className="space-y-1.5 pt-1">
                    {dayEvents.length === 0 ? (
                      <span className="font-mono text-[10px] text-[var(--text-muted)] italic block pt-2 text-center sm:text-left">
                        No visits
                      </span>
                    ) : (
                      dayEvents.map(ev => (
                        <div
                          key={ev.id}
                          className={`p-1.5 rounded-[4px] text-[10px] font-mono space-y-0.5 cursor-pointer hover:shadow-xs transition-shadow ${ev.chipTone}`}
                        >
                          <div className="font-bold flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{ev.time}</span>
                          </div>
                          <div className="font-serif font-medium truncate text-[var(--text)]">
                            {ev.buyer}
                          </div>
                          <div className="text-[9px] opacity-80 truncate">
                            {ev.project}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* TABLE LEDGER VIEW */
        <div className="editorial-card overflow-hidden">
          <AppointmentsTable appointments={appointmentsList} onRefresh={() => refetch()} />
        </div>
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

export default AppointmentsPage;
