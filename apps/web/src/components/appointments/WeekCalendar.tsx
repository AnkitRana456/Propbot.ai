import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, MapPin, MessageSquare, PanelLeft, Video, X } from 'lucide-react';
import type { AppointmentItem, AppointmentStatus } from '@propbot/shared';
import { useRescheduleAppointment } from '../../services/appointments.service.js';
import { useToast } from '../ui/Toast.js';
import { RescheduleModal } from './RescheduleModal.js';

/**
 * The appointments week view, in the "WeekCalendar" design (from Cue): a Today panel beside an hour grid.
 * Click a visit to open it, drag it to another slot or day (15-minute steps) and confirm to reschedule it,
 * double-click an empty slot to book. Colours come from the app's theme tokens, so light and dark follow the app.
 */

/** Appointment status → the lead-status colour pair it shares a meaning with. */
const STATUS_STYLE: Record<AppointmentStatus, { key: string; label: string }> = {
  scheduled: { key: 'new', label: 'Scheduled' },
  confirmed: { key: 'site-visit', label: 'Confirmed' },
  completed: { key: 'won', label: 'Completed' },
  rescheduled: { key: 'contacted', label: 'Rescheduled' },
  no_show: { key: 'negotiation', label: 'No-show' },
  cancelled: { key: 'lost', label: 'Cancelled' },
};
const TYPE_ICON = { site_visit: MapPin, consultation: MessageSquare, video_call: Video } as const;
const movable = (a: AppointmentItem) => a.status === 'scheduled' || a.status === 'confirmed';

export const startOfWeek = (d: Date): Date => {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7)); // Monday
  return out;
};
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fmt = (m: number) => {
  const h = Math.floor(m / 60) % 24, mm = m % 60, h12 = h % 12 || 12;
  return `${h12}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};
const dayLabel = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

const HOUR = 96; // px per hour
type Ev = { a: AppointmentItem; id: string; d: number; s: number; e: number };

/** Side-by-side lanes for visits that overlap in one day. */
function lanesOf(list: Ev[]): Map<string, { lane: number; lanes: number }> {
  const out = new Map<string, { lane: number; lanes: number }>();
  let cluster: { id: string; lane: number }[] = [], ends: number[] = [], clusterEnd = -1;
  const flush = () => { cluster.forEach(c => out.set(c.id, { lane: c.lane, lanes: ends.length })); cluster = []; ends = []; };
  for (const ev of [...list].sort((x, y) => x.s - y.s)) {
    if (ev.s >= clusterEnd) flush();
    let lane = ends.findIndex(end => end <= ev.s);
    if (lane < 0) { lane = ends.length; ends.push(ev.e); } else ends[lane] = ev.e;
    cluster.push({ id: ev.id, lane });
    clusterEnd = Math.max(clusterEnd, ev.e);
  }
  flush();
  return out;
}

interface WeekCalendarProps {
  appointments: AppointmentItem[];
  /** Double-click on an empty slot. */
  onCreate?: () => void;
  /** Injected so tests and previews are deterministic. */
  today?: Date;
}

export const WeekCalendar: React.FC<WeekCalendarProps> = ({ appointments, onCreate, today = new Date() }) => {
  const toast = useToast();
  const reschedule = useRescheduleAppointment();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [pop, setPop] = useState<string | null>(null);
  // a dragged visit sits at its new slot until the move is confirmed or dropped
  const [moved, setMoved] = useState<{ id: string; d: number; s: number; pending: boolean } | null>(null);
  const [panelOn, setPanelOn] = useState(true);
  const [tab, setTab] = useState<'today' | 'next'>('today');
  const [reschedFor, setReschedFor] = useState<AppointmentItem | null>(null);
  const [nowMin, setNowMin] = useState(() => today.getHours() * 60 + today.getMinutes());
  const calRef = useRef<HTMLDivElement>(null), gridRef = useRef<HTMLDivElement>(null), popRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; x: number; y: number; s: number; d: number; len: number; on: boolean } | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)), [weekStart]);
  const evs: Ev[] = useMemo(
    () =>
      appointments.flatMap(a => {
        const at = new Date(a.scheduledAt), d = days.findIndex(x => sameDay(x, at));
        if (d < 0) return [];
        const s = at.getHours() * 60 + at.getMinutes();
        return [{ a, id: a.id, d, s, e: Math.min(1440, s + (a.durationMinutes || 45)) }];
      }),
    [appointments, days],
  );
  const START = Math.min(8, ...evs.map(e => Math.floor(e.s / 60)));
  const END = Math.max(20, ...evs.map(e => Math.ceil(e.e / 60)));
  const shown = evs.map(e => (moved && moved.id === e.id ? { ...e, d: moved.d, s: moved.s, e: moved.s + (e.e - e.s) } : e));
  const todayIdx = days.findIndex(d => sameDay(d, today));

  useEffect(() => {
    const t = setInterval(() => { const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes()); }, 60000);
    return () => clearInterval(t);
  }, []);

  const close = () => { setPop(null); setMoved(null); };
  useEffect(() => {
    if (!pop) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const down = (e: PointerEvent) => { const t = e.target as Element; if (!popRef.current?.contains(t) && !t.closest?.('.wc .ev')) close(); };
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', down);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', down); };
  }, [pop]);

  // place the popover beside its card, inside the scrolled grid
  useLayoutEffect(() => {
    const cal = calRef.current, p = popRef.current;
    if (!pop || !cal || !p) return;
    const anchor = cal.querySelector<HTMLElement>(`.ev[data-id="${pop}"]`);
    if (!anchor) return;
    if (anchor.offsetTop < cal.scrollTop || anchor.offsetTop > cal.scrollTop + cal.clientHeight - 120) cal.scrollTop = Math.max(0, anchor.offsetTop - 80);
    const cr = cal.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    let left = ar.right - cr.left + cal.scrollLeft + 10;
    if (left + 290 > cal.scrollLeft + cal.clientWidth) left = ar.left - cr.left + cal.scrollLeft - 290;
    const top = Math.max(cal.scrollTop + 64, Math.min(ar.top - cr.top + cal.scrollTop, cal.scrollTop + cal.clientHeight - p.offsetHeight - 10));
    p.style.left = `${Math.max(cal.scrollLeft + 8, left)}px`;
    p.style.top = `${top}px`;
  }, [pop, weekStart, moved?.pending]);

  // on a new week, scroll to the first visit (or now, this week) so cards are in view without hunting
  useEffect(() => {
    const cal = calRef.current;
    if (!cal) return;
    const nowInGrid = todayIdx >= 0 && nowMin >= START * 60 && nowMin < END * 60;
    const first = evs.length ? Math.min(...evs.map(e => e.s)) : nowInGrid ? nowMin : 9 * 60;
    cal.scrollTop = Math.max(0, ((first - START * 60) / 60) * HOUR - HOUR / 2);
  }, [weekStart]);

  const shift = (weeks: number) => { close(); setWeekStart(w => new Date(w.getFullYear(), w.getMonth(), w.getDate() + weeks * 7)); };
  const open = (a: AppointmentItem) => { setMoved(null); setWeekStart(startOfWeek(new Date(a.scheduledAt))); setPop(a.id); };

  // drag a visit: 15-minute steps, across days; a press without a move opens it
  const onDown = (e: React.PointerEvent) => {
    const el = (e.target as Element).closest<HTMLElement>('.ev');
    const ev = el && evs.find(x => x.id === el.dataset.id);
    if (!el || !ev || e.button !== 0) return;
    drag.current = { id: ev.id, x: e.clientX, y: e.clientY, s: ev.s, d: ev.d, len: ev.e - ev.s, on: false };
    el.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    if (!g.on && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 5) return;
    const ev = evs.find(x => x.id === g.id);
    if (!ev || !movable(ev.a)) return;
    if (!g.on) { g.on = true; setPop(null); }
    const s = Math.max(START * 60, Math.min(END * 60 - g.len, g.s + Math.round(((e.clientY - g.y) / HOUR) * 4) * 15));
    const under = [...gridRef.current!.querySelectorAll<HTMLElement>('.col')].find(c => { const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX < r.right; });
    setMoved({ id: g.id, d: under ? Number(under.dataset.d) : g.d, s, pending: false });
  };
  const onUp = () => {
    const g = drag.current;
    if (!g) return;
    drag.current = null;
    if (!g.on) { setMoved(null); setPop(g.id); return; }
    setMoved(m => (m && (m.d !== g.d || m.s !== g.s) ? { ...m, pending: true } : null));
    setPop(g.id);
  };
  const confirmMove = () => {
    if (!moved) return;
    const day = days[moved.d]!, at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, moved.s);
    setMoved({ ...moved, pending: false });
    setPop(null);
    reschedule.mutate(
      { id: moved.id, input: { scheduledAt: at.toISOString(), reason: 'Moved on the calendar' } },
      {
        onSuccess: () => toast.success(`Moved to ${dayLabel(at)}, ${fmt(moved.s)}`),
        onError: err => toast.error(err instanceof Error ? err.message : 'Could not move the visit.'),
        onSettled: () => setMoved(null),
      },
    );
  };

  const pev = pop ? shown.find(e => e.id === pop) : undefined;
  const range = `${days[0]!.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${days[6]!.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const byTime = (x: AppointmentItem, y: AppointmentItem) => x.scheduledAt.localeCompare(y.scheduledAt);
  const todays = appointments.filter(a => sameDay(new Date(a.scheduledAt), today)).sort(byTime);
  const upcoming = appointments.filter(a => movable(a) && new Date(a.scheduledAt).getTime() > today.getTime() && !sameDay(new Date(a.scheduledAt), today)).sort(byTime).slice(0, 12);
  const list = tab === 'today' ? todays : upcoming;
  const confirmed = evs.filter(e => e.a.status === 'confirmed').length;
  const next = todays.find(a => movable(a) && new Date(a.scheduledAt).getTime() > today.getTime()) ?? upcoming[0];

  return (
    <section aria-label="Week calendar" className="wc" style={{ '--hr': `${HOUR}px` } as React.CSSProperties}>
      <style>{CSS}</style>
      <header className="head">
        <h2 aria-live="polite">{range}</h2>
        <span className="count">{evs.length} visit{evs.length === 1 ? '' : 's'}</span>
        <ul className="legend" aria-label="Status colours">
          {(['scheduled', 'confirmed', 'completed', 'cancelled'] as const).map(s => (
            <li key={s}><i style={{ background: `var(--status-${STATUS_STYLE[s].key}-fg)` }} />{STATUS_STYLE[s].label}</li>
          ))}
        </ul>
        <div className="tools">
          <button type="button" className="ib" onClick={() => shift(-1)} aria-label="Previous week"><ChevronLeft size={16} /></button>
          <button type="button" className="ib" onClick={() => shift(1)} aria-label="Next week"><ChevronRight size={16} /></button>
          <button type="button" className="ib panel-btn" onClick={() => setPanelOn(!panelOn)} aria-label="Show the Today panel" aria-pressed={panelOn}><PanelLeft size={16} /></button>
          <button type="button" className="today-btn" onClick={() => { close(); setWeekStart(startOfWeek(today)); calRef.current?.scrollTo({ top: Math.max(0, ((nowMin - START * 60) / 60) * HOUR - 120) }); }}>Today</button>
        </div>
      </header>

      <div className={`body${panelOn ? '' : ' wide'}`}>
        <aside className="todo" aria-label="Today">
          <h3>{today.toLocaleDateString('en-IN', { weekday: 'long' })}</h3>
          <p className="sub">{today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}</p>
          <div className="stats">
            <div><b>{todays.length}</b><small>Today</small></div>
            <div><b>{evs.length}</b><small>Week</small></div>
            <div><b>{confirmed}</b><small>Confirmed</small></div>
          </div>
          {next && (
            <button type="button" className="next" onClick={() => open(next)}>
              <small>Next visit</small>
              <b>{next.leadName ?? 'Visitor'}</b>
              <span>{dayLabel(new Date(next.scheduledAt))} · {fmt(new Date(next.scheduledAt).getHours() * 60 + new Date(next.scheduledAt).getMinutes())}</span>
            </button>
          )}
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'today'} onClick={() => setTab('today')}>Today’s visits</button>
            <button type="button" role="tab" aria-selected={tab === 'next'} onClick={() => setTab('next')}>Upcoming</button>
          </div>
          <ul className="evl">
            {list.length === 0 && <li className="none">{tab === 'today' ? 'No visits today.' : 'Nothing coming up.'}</li>}
            {list.map(a => {
              const at = new Date(a.scheduledAt);
              return (
                <li key={a.id}>
                  <button type="button" onClick={() => open(a)} style={{ '--c': `var(--status-${STATUS_STYLE[a.status].key}-fg)` } as React.CSSProperties}>
                    <i />
                    <span>
                      <b>{a.leadName ?? 'Visitor'}</b>
                      <small>{tab === 'next' ? `${dayLabel(at)} · ` : ''}{fmt(at.getHours() * 60 + at.getMinutes())}{a.projectName ? ` · ${a.projectName}` : ''}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="cal" ref={calRef}>
          <div
            className="grid"
            ref={gridRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => { drag.current = null; setMoved(null); }}
            onDoubleClick={e => { const t = e.target as Element; if (t.closest('.col') && !t.closest('.ev')) onCreate?.(); }}
          >
            <div className="corner">IST</div>
            {days.map((d, i) => (
              <div key={i} className={`dh${i === todayIdx ? ' today' : ''}`}>
                <small>{d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()}{i === todayIdx && <span className="sr-only"> (today)</span>}</small>
                <b>{d.getDate()}</b>
              </div>
            ))}
            <div className="hours">{Array.from({ length: END - START }, (_, i) => <div key={i}>{i ? <span>{fmt((START + i) * 60)}</span> : null}</div>)}</div>
            {days.map((_, d) => {
              const mine = shown.filter(e => e.d === d), lanes = lanesOf(mine);
              return (
                <div key={d} className={`col${d === todayIdx ? ' today' : ''}`} data-d={d} style={{ height: (END - START) * HOUR }}>
                  {mine.map(ev => {
                    const { a } = ev, st = STATUS_STYLE[a.status], Icon = TYPE_ICON[a.appointmentType] ?? MapPin;
                    const hgt = ((ev.e - ev.s) / 60) * HOUR - 6, { lane, lanes: n } = lanes.get(ev.id)!;
                    const cls = `ev${hgt < 70 ? ' short' : ''}${pop === ev.id ? ' sel' : ''}${moved?.id === ev.id ? ' dragging' : ''}${movable(a) ? '' : ' off'}`;
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        className={cls}
                        data-id={ev.id}
                        aria-label={`${a.leadName ?? 'Visitor'}, ${fmt(ev.s)} – ${fmt(ev.e)}, ${st.label}`}
                        style={{
                          top: ((ev.s - START * 60) / 60) * HOUR + 3,
                          height: hgt,
                          left: `calc(6px + ${lane} * (100% - 12px) / ${n})`,
                          width: `calc((100% - 12px) / ${n} - ${n > 1 ? 3 : 0}px)`,
                          '--c': `var(--status-${st.key}-fg)`,
                          '--bg-c': `var(--status-${st.key}-bg)`,
                        } as React.CSSProperties}
                      >
                        <span className="ic"><Icon size={16} /></span>
                        <b>{a.leadName ?? 'Visitor'}</b>
                        <small>{fmt(ev.s)} – {fmt(ev.e)}</small>
                        {hgt >= 70 && a.projectName && <small className="proj">{a.projectName}</small>}
                      </button>
                    );
                  })}
                  {d === todayIdx && nowMin >= START * 60 && nowMin < END * 60 && <i className="now" style={{ top: ((nowMin - START * 60) / 60) * HOUR }} />}
                </div>
              );
            })}
          </div>

          {evs.length === 0 && (
            <div className="empty">
              <b>No visits this week</b>
              <span>Double-click a slot or book one to fill the calendar.</span>
              {onCreate && <button type="button" onClick={onCreate}>Book site visit</button>}
            </div>
          )}

          {pev && (
            <div className="pop" role="dialog" aria-label="Visit" ref={popRef} style={{ '--c': `var(--status-${STATUS_STYLE[pev.a.status].key}-fg)` } as React.CSSProperties}>
              <div className="ph">
                <span className="ic">{React.createElement(TYPE_ICON[pev.a.appointmentType] ?? MapPin, { size: 20 })}</span>
                <h3>{pev.a.leadName ?? 'Visitor'}</h3>
                <button type="button" className="x" aria-label="Close" onClick={close}><X size={14} /></button>
              </div>
              <dl>
                <dt>{moved?.pending ? 'Move to' : 'When'}</dt><dd>{dayLabel(days[pev.d]!)} · {fmt(pev.s)} – {fmt(pev.e)}</dd>
                <dt>Status</dt><dd className="st"><i />{STATUS_STYLE[pev.a.status].label}</dd>
                {pev.a.projectName && <><dt>Project</dt><dd>{pev.a.projectName}</dd></>}
                {(pev.a.location || pev.a.projectLocation) && <><dt>Where</dt><dd>{pev.a.location || pev.a.projectLocation}</dd></>}
                {pev.a.assignedAgentName && <><dt>Agent</dt><dd>{pev.a.assignedAgentName}</dd></>}
                {pev.a.leadPhone && <><dt>Phone</dt><dd>{pev.a.leadPhone}</dd></>}
                {pev.a.notes && <><dt>Notes</dt><dd className="note">{pev.a.notes}</dd></>}
              </dl>
              <div className="acts">
                {moved?.pending ? (
                  <>
                    <button type="button" className="pri" onClick={confirmMove}>Move visit</button>
                    <button type="button" onClick={close}>Cancel</button>
                  </>
                ) : (
                  <>
                    {pev.a.meetingLink && <a className="pri" href={pev.a.meetingLink} target="_blank" rel="noreferrer">Join</a>}
                    {movable(pev.a) && <button type="button" onClick={() => { setReschedFor(pev.a); close(); }}>Reschedule</button>}
                    {!pev.a.meetingLink && !movable(pev.a) && <button type="button" onClick={close}>Close</button>}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* portalled: the page's animated wrapper would otherwise trap this fixed overlay inside it */}
      {reschedFor && createPortal(<RescheduleModal isOpen appointment={reschedFor} onClose={() => setReschedFor(null)} />, document.body)}
    </section>
  );
};

const CSS = `
.wc { --card: var(--surface); --pane: var(--surface-2); --line: var(--border); --line2: var(--border-subtle, var(--border)); --ink: var(--text); --dim: var(--text-muted); --mute: var(--text-faint);
  border-radius: 16px; border: 1px solid var(--line); background: var(--card); color: var(--ink); padding: 16px 14px 14px; font-size: 13px; }
.wc *, .wc *::before, .wc *::after { box-sizing: border-box; }
.wc button { font: inherit; color: inherit; cursor: pointer; }
.wc :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.wc .head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 14px; padding: 0 2px 14px; }
.wc .head h2 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.wc .count { color: var(--dim); }
.wc .legend { display: flex; flex-wrap: wrap; gap: 12px; margin: 0; padding: 0; list-style: none; font-size: 12px; color: var(--dim); }
.wc .legend li { display: flex; align-items: center; gap: 6px; }
.wc .legend i, .wc .pop .st i { width: 7px; height: 7px; border-radius: 50%; flex: none; }
.wc .tools { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.wc .ib { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--pane); border: 1px solid var(--line); color: var(--dim); }
.wc .ib:hover, .wc .ib[aria-pressed=true] { color: var(--ink); }
.wc .today-btn { height: 36px; padding: 0 16px; border: 0; border-radius: 10px; background: var(--accent); color: var(--on-accent, #fff); font-weight: 600; box-shadow: 0 1px 0 rgba(255,255,255,.15) inset, 0 4px 14px -6px var(--accent-glow-strong, rgba(0,0,0,.3)); transition: filter .15s; }
.wc .today-btn:hover { filter: brightness(1.08); }
.wc .body { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 14px; height: clamp(440px, calc(100vh - 300px), 900px); }
.wc .body.wide { grid-template-columns: minmax(0, 1fr); }
.wc .body.wide .todo { display: none; }
.wc .todo, .wc .cal { min-height: 0; border-radius: 12px; background: var(--pane); border: 1px solid var(--line); }
.wc .todo { overflow-y: auto; scrollbar-width: thin; padding: 14px 12px; }
.wc .todo h3 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -.01em; }
.wc .todo .sub { margin: 2px 0 12px; font-size: 12px; color: var(--dim); }
.wc .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px; }
.wc .stats div { padding: 8px 6px; border-radius: 9px; background: var(--card); box-shadow: inset 0 0 0 1px var(--line2); text-align: center; }
.wc .stats b { display: block; font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; }
.wc .stats small { display: block; margin-top: 1px; font-size: 10.5px; color: var(--dim); }
.wc .next { width: 100%; display: grid; gap: 2px; margin-bottom: 6px; padding: 10px 11px; border: 0; border-radius: 10px; text-align: left; background: var(--accent-soft); color: var(--ink); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 25%, transparent); }
.wc .next small { font-size: 10.5px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--accent); }
.wc .next b { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wc .next span { font-size: 11.5px; color: var(--dim); }
.wc .next:hover { box-shadow: inset 0 0 0 1px var(--accent); }
.wc .tabs { display: flex; gap: 16px; margin: 12px 0 10px; border-bottom: 1px solid var(--line); }
.wc .tabs button { padding: 0 0 8px; border: 0; border-bottom: 1px solid transparent; margin-bottom: -1px; background: none; color: var(--dim); font-size: 12.5px; }
.wc .tabs button[aria-selected=true] { color: var(--ink); border-color: var(--ink); }
.wc .evl { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.wc .evl .none { color: var(--dim); font-size: 12.5px; padding: 6px 2px; }
.wc .evl button { width: 100%; display: grid; grid-template-columns: 3px 1fr; gap: 10px; padding: 8px; border: 0; border-radius: 8px; text-align: left; font-size: 12.5px; background: var(--card); box-shadow: inset 0 0 0 1px var(--line2); }
.wc .evl button:hover { box-shadow: inset 0 0 0 1px var(--dim); }
.wc .evl i { border-radius: 2px; background: var(--c); }
.wc .evl b { display: block; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wc .evl small { display: block; margin-top: 2px; color: var(--dim); font-size: 11.5px; }
.wc .evl span { min-width: 0; }
.wc .cal { position: relative; overflow: auto; scrollbar-width: thin; }
.wc .grid { position: relative; display: grid; grid-template-columns: 76px repeat(7, minmax(100px, 1fr)); min-width: 100%; }
.wc .corner, .wc .dh { position: sticky; top: 0; z-index: 5; height: 56px; background: var(--pane); border-bottom: 1px solid var(--line); }
.wc .corner { left: 0; z-index: 7; display: grid; place-items: center; border-right: 1px solid var(--line); font-size: 11.5px; color: var(--mute); letter-spacing: .04em; }
.wc .dh { display: flex; flex-direction: column; align-items: center; justify-content: center; border-right: 1px solid var(--line2); color: var(--dim); }
.wc .dh small { font-size: 10.5px; font-weight: 500; letter-spacing: .06em; }
.wc .dh b { margin-top: 3px; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: 16px; font-weight: 500; color: var(--ink); font-variant-numeric: tabular-nums; }
.wc .dh.today small { color: var(--accent); }
.wc .dh.today b { background: var(--accent); color: var(--on-accent, #fff); font-weight: 600; }
.wc .hours { position: sticky; left: 0; z-index: 4; background: var(--pane); border-right: 1px solid var(--line); }
.wc .hours div { height: var(--hr); position: relative; font-size: 11.5px; color: var(--dim); }
.wc .hours div span { position: absolute; top: -8px; left: 12px; white-space: nowrap; }
.wc .col { position: relative; border-right: 1px solid var(--line2); background-image: linear-gradient(var(--line2) 1px, transparent 1px), linear-gradient(color-mix(in srgb, var(--line2) 45%, transparent) 1px, transparent 1px); background-size: 100% var(--hr), 100% calc(var(--hr) / 2); }
.wc .col:last-child { border-right: 0; }
.wc .col.today { background-color: color-mix(in srgb, var(--accent) 5%, transparent); }
.wc .now { position: absolute; left: -1px; right: 0; z-index: 3; height: 0; border-top: 2px solid var(--warning); pointer-events: none; }
.wc .now::before { content: ''; position: absolute; left: -5px; top: -6px; width: 10px; height: 10px; border-radius: 50%; background: var(--warning); }
.wc .ev { position: absolute; z-index: 2; display: flex; flex-direction: column; gap: 2px; padding: 8px 9px 8px 12px; border: 0; border-radius: 9px; background: var(--bg-c); color: var(--c); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 22%, transparent), 0 1px 2px rgba(0,0,0,.06); overflow: hidden; text-align: left; cursor: grab; touch-action: none; transition: box-shadow .15s, opacity .2s, transform .15s; }
.wc .ev::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--c); }
.wc .ev:hover { transform: translateY(-1px); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 45%, transparent), 0 8px 18px -10px rgba(0,0,0,.35); }
.wc .ev.sel { box-shadow: inset 0 0 0 1.5px var(--c), 0 8px 18px -10px rgba(0,0,0,.35); }
.wc .ev.off { opacity: .55; cursor: pointer; }
.wc .ev.off b { text-decoration: line-through; text-decoration-thickness: 1px; }
.wc .ev.dragging { cursor: grabbing; z-index: 9; opacity: .95; box-shadow: inset 0 0 0 1.5px var(--c), 0 18px 40px -12px rgba(0,0,0,.45); }
.wc .ev .ic { color: var(--c); margin-bottom: 2px; opacity: .9; }
.wc .ev b { font-size: 12.5px; line-height: 1.3; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.wc .ev small { font-size: 10.5px; color: color-mix(in srgb, var(--c) 75%, var(--dim)); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.wc .ev .proj { color: var(--dim); }
.wc .empty { position: absolute; left: 50%; top: 55%; transform: translate(-50%, -50%); z-index: 6; width: min(300px, 80%); padding: 18px 20px; border-radius: 14px; background: var(--card); box-shadow: 0 0 0 1px var(--line), 0 20px 40px -24px rgba(0,0,0,.4); text-align: center; display: grid; gap: 4px; justify-items: center; }
.wc .empty b { font-size: 14px; font-weight: 600; }
.wc .empty span { font-size: 12px; color: var(--dim); }
.wc .empty button { margin-top: 8px; height: 32px; padding: 0 14px; border: 0; border-radius: 9px; background: var(--accent); color: var(--on-accent, #fff); font-size: 12.5px; font-weight: 600; }
.wc .ev.short { padding-top: 5px; padding-bottom: 5px; gap: 0; }
.wc .ev.short .ic { display: none; }
.wc .pop { position: absolute; z-index: 20; width: 280px; padding: 16px; border-radius: 14px; background: var(--card); box-shadow: 0 0 0 1px var(--line), 0 28px 60px -20px rgba(0,0,0,.55); animation: wc-pin .15s ease-out; }
@keyframes wc-pin { from { opacity: 0; transform: translateY(-4px); } }
.wc .pop .ph { display: flex; align-items: flex-start; gap: 10px; }
.wc .pop .ph .ic { color: var(--c); flex: none; margin-top: 1px; }
.wc .pop h3 { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.35; flex: 1; min-width: 0; overflow-wrap: anywhere; }
.wc .pop .x { width: 26px; height: 26px; border: 0; border-radius: 7px; display: grid; place-items: center; background: none; color: var(--dim); flex: none; }
.wc .pop .x:hover { background: var(--pane); color: var(--ink); }
.wc .pop dl { display: grid; grid-template-columns: 64px 1fr; gap: 7px 8px; margin: 14px 0; font-size: 12.5px; }
.wc .pop dt { color: var(--dim); }
.wc .pop dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.wc .pop .st { display: flex; align-items: center; gap: 7px; }
.wc .pop .st i { background: var(--c); }
.wc .pop .note { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.wc .pop .acts { display: flex; gap: 8px; }
.wc .pop .acts > * { flex: 1; height: 32px; border: 0; border-radius: 8px; font-size: 12.5px; background: var(--pane); box-shadow: inset 0 0 0 1px var(--line); display: grid; place-items: center; text-decoration: none; color: var(--ink); }
.wc .pop .acts > *:hover { box-shadow: inset 0 0 0 1px var(--dim); }
.wc .pop .acts .pri { background: var(--accent); color: var(--on-accent, #fff); box-shadow: none; font-weight: 500; }
@media (max-width: 1100px) { .wc .legend { display: none; } }
@media (max-width: 760px) { .wc .body, .wc .body.wide { grid-template-columns: minmax(0, 1fr); } .wc .todo, .wc .panel-btn { display: none; } .wc .grid { grid-template-columns: 60px repeat(7, minmax(130px, 1fr)); } .wc .hours div span { left: 6px; } }
@media (prefers-reduced-motion: reduce) { .wc *, .wc *::before, .wc *::after { animation: none !important; transition: none !important; } }
`;
