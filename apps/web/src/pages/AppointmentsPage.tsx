import React, { useState } from 'react';
import { Calendar, List, Plus, RefreshCw, Search } from 'lucide-react';
import { useAppointments } from '../services/appointments.service.js';
import { AppointmentsTable } from '../components/appointments/AppointmentsTable.js';
import { BookAppointmentModal } from '../components/appointments/BookAppointmentModal.js';
import { CalendarSetupModal } from '../components/appointments/CalendarSetupModal.js';
import { WeekCalendar } from '../components/appointments/WeekCalendar.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Skeleton } from '../components/common/Skeleton.js';

export const AppointmentsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'calendar' | 'table'>('calendar');
  const [booking, setBooking] = useState(false);
  const [calendarSetup, setCalendarSetup] = useState(false);

  const { data, refetch, isFetching, isLoading, isError, error } = useAppointments({ search: search.trim() || undefined, limit: 100 });
  const items = data?.items ?? [];
  const kpis = data?.kpis;

  const stats = [
    { label: 'Upcoming visits', value: kpis?.upcoming },
    { label: 'Today', value: kpis?.today },
    { label: 'Synced to calendar', value: kpis?.calendarSynced },
    { label: 'All time', value: kpis?.all },
  ];

  return (
    <div>
      <PageHeader
        title="Appointments"
        description="Site visits booked by your chatbot and your team."
        action={
          <>
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching} aria-label="Refresh" leftIcon={<RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />}>
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCalendarSetup(true)} leftIcon={<Calendar className="h-4 w-4" />}>
              Calendar setup
            </Button>
            <Button size="sm" onClick={() => setBooking(true)} leftIcon={<Plus className="h-4 w-4" />}>
              Book site visit
            </Button>
          </>
        }
      />

      <section aria-label="Visit numbers" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label} className="p-4">
            <p className="text-sm text-text-muted">{s.label}</p>
            {isLoading ? <Skeleton className="mt-1 h-8 w-12" /> : <p className="mt-1 text-2xl font-bold tabular-nums text-text">{s.value ?? 0}</p>}
          </Card>
        ))}
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search visitor, phone or project…"
            aria-label="Search appointments"
            className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div role="group" aria-label="View" className="flex rounded-lg border border-border bg-surface p-0.5">
          {([['calendar', 'Week', Calendar], ['table', 'List', List]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${view === id ? 'bg-accent-soft text-accent' : 'text-text-muted hover:text-text'}`}>
              <Icon aria-hidden className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-text">
          Could not load appointments. {error.message}
          <Button size="sm" variant="outline" onClick={() => void refetch()}>Retry</Button>
        </div>
      ) : isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : view === 'calendar' ? (
        <WeekCalendar appointments={items} />
      ) : (
        <Card className="overflow-hidden">
          <AppointmentsTable appointments={items} onRefresh={() => void refetch()} />
        </Card>
      )}

      {booking && <BookAppointmentModal isOpen onClose={() => setBooking(false)} onSuccess={() => void refetch()} />}
      {calendarSetup && <CalendarSetupModal isOpen onClose={() => setCalendarSetup(false)} />}
    </div>
  );
};

export default AppointmentsPage;
