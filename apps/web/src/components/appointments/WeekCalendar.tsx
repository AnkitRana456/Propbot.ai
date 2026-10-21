import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AppointmentItem, AppointmentStatus } from '@propbot/shared';

/** Appointment status → the lead-status colour pair it shares a meaning with. */
const STATUS_STYLE: Record<AppointmentStatus, { key: string; label: string }> = {
  scheduled: { key: 'new', label: 'Scheduled' },
  confirmed: { key: 'site-visit', label: 'Confirmed' },
  completed: { key: 'won', label: 'Completed' },
  rescheduled: { key: 'contacted', label: 'Rescheduled' },
  no_show: { key: 'negotiation', label: 'No-show' },
  cancelled: { key: 'lost', label: 'Cancelled' },
};

export const startOfWeek = (d: Date): Date => {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7)); // Monday
  return out;
};

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

interface WeekCalendarProps {
  appointments: AppointmentItem[];
  onSelect?: (a: AppointmentItem) => void;
  /** Injected so tests and previews are deterministic. */
  today?: Date;
}

export const WeekCalendar: React.FC<WeekCalendarProps> = ({ appointments, onSelect, today = new Date() }) => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)),
    [weekStart],
  );
  const byDay = useMemo(
    () =>
      days.map(d =>
        appointments
          .filter(a => sameDay(new Date(a.scheduledAt), d))
          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
      ),
    [days, appointments],
  );
  const total = byDay.reduce((s, x) => s + x.length, 0);
  const shift = (weeks: number) => setWeekStart(w => new Date(w.getFullYear(), w.getMonth(), w.getDate() + weeks * 7));
  const range = `${days[0]!.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${days[6]!.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <section aria-label="Week calendar" className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous week" className="rounded-lg border border-border p-1.5 text-text-muted hover:bg-surface-2 hover:text-text">
            <ChevronLeft aria-hidden className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => shift(1)} aria-label="Next week" className="rounded-lg border border-border p-1.5 text-text-muted hover:bg-surface-2 hover:text-text">
            <ChevronRight aria-hidden className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setWeekStart(startOfWeek(today))} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-surface-2">
            Today
          </button>
          <h2 className="ml-2 text-base font-semibold text-text" aria-live="polite">{range}</h2>
          <span className="text-sm text-text-muted">{total} visit{total === 1 ? '' : 's'}</span>
        </div>
        <ul className="flex flex-wrap items-center gap-3 text-xs text-text-muted" aria-label="Status colours">
          {(['scheduled', 'confirmed', 'completed', 'cancelled'] as const).map(s => (
            <li key={s} className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--status-${STATUS_STYLE[s].key}-fg)` }} />
              {STATUS_STYLE[s].label}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-7 sm:divide-x sm:divide-y-0">
        {days.map((d, i) => {
          const isToday = sameDay(d, today);
          return (
            <div key={d.toISOString()} className={`min-h-[140px] p-2 sm:min-h-[280px] ${isToday ? 'bg-accent-soft/40' : ''}`}>
              <div className="mb-2 flex items-baseline justify-between sm:flex-col sm:items-start">
                <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                <span className={`text-sm font-semibold ${isToday ? 'text-accent' : 'text-text'}`}>
                  {d.getDate()}
                  {isToday && <span className="sr-only"> (today)</span>}
                </span>
              </div>
              <ul className="space-y-1.5">
                {byDay[i]!.length === 0 && <li className="text-xs text-text-muted">No visits</li>}
                {byDay[i]!.map(a => {
                  const st = STATUS_STYLE[a.status];
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => onSelect?.(a)}
                        style={{ backgroundColor: `var(--status-${st.key}-bg)`, color: `var(--status-${st.key}-fg)` }}
                        className="w-full rounded-md px-2 py-1.5 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <span className="block font-semibold tabular-nums">
                          {new Date(a.scheduledAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <span className="block truncate font-medium">{a.leadName ?? 'Visitor'}</span>
                        <span className="block truncate opacity-80">{a.projectName ?? st.label}</span>
                        <span className="sr-only">{st.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
};
