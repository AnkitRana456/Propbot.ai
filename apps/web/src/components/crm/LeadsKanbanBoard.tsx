import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { LeadItemResponse, LeadStatus } from '@propbot/shared';
import { useKanbanBoard, useUpdateStage } from '../../services/crm.service.js';
import { useToast } from '../ui/Toast.js';
import { formatInr } from '../../lib/format.js';
import { AddLeadModal } from './AddLeadModal.js';
import { LostReasonModal } from './LostReasonModal.js';

/**
 * The leads pipeline board, in the "KanbanBoard" design (from Cue): a column per stage, with limits you set per column
 * and can see coming. Drag a lead (mouse, touch hold, or Space + arrows): it lifts and tilts, a dashed slot opens where
 * it will land, the others glide aside, and the target's limit bar shows it arriving ("full after this" / "over limit").
 * Dropping it saves the new stage (Lost asks for a reason first). A click opens the lead. Filter by intent, agent or
 * follow-ups due in 2 days; each column's menu sets its limit, sorts by follow-up or folds it. Board / List.
 * Colours come from the app's theme tokens, so light and dark follow the app.
 */

type Column = { id: LeadStatus; title: string; limit?: number; note?: string; done?: boolean; collapsed?: boolean };
type Person = { id: string; name: string };
type Card = { id: string; lead: LeadItemResponse; column: LeadStatus; tag?: string; due?: string; doneAt?: string; who?: string; sub?: string };

const COLUMNS: Column[] = [
  { id: 'new', title: 'New' },
  { id: 'contacted', title: 'Contacted' },
  { id: 'qualified', title: 'Qualified' },
  { id: 'site_visit_scheduled', title: 'Visit scheduled' },
  { id: 'site_visit_done', title: 'Visit done' },
  { id: 'negotiation', title: 'Negotiation' },
  { id: 'booked', title: 'Booked', note: 'won', done: true },
  { id: 'lost', title: 'Lost', note: 'dropped', collapsed: true },
];
const TAGS = [{ name: 'Hot', color: '#ff453a' }, { name: 'Warm', color: '#ffb020' }, { name: 'Cold', color: '#64d2ff' }];
const PREFS_KEY = 'propbot_board_columns';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y!, m! - 1, d); };
const dayOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diffDays = (a: string, today: Date) => Math.round((parse(a).getTime() - dayOnly(today).getTime()) / 864e5);
const short = (s: string) => { const d = parse(s); return `${MON[d.getMonth()]} ${d.getDate()}`; };
/** "Rahul Sharma (Senior Agent)" → name "Rahul Sharma", role "Senior Agent" */
const splitName = (full: string) => { const m = /^(.*?)\s*\((.+)\)\s*$/.exec(full); return m ? { name: m[1]!, role: m[2]! } : { name: full, role: '' }; };
const initialsOf = (full: string) => splitName(full).name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const tagOfLead = (l: LeadItemResponse) => {
  const label = (l.intentLabel ?? '').toLowerCase(), s = l.intentScore ?? 0;
  return label === 'hot' || s >= 70 ? 'Hot' : label === 'warm' || s >= 35 ? 'Warm' : l.intentScore != null || label ? 'Cold' : undefined;
};
const toCard = (l: LeadItemResponse): Card => ({
  id: l.id,
  lead: l,
  column: l.status === 'converted' ? 'booked' : l.status, // the board has one "won" column
  tag: tagOfLead(l),
  due: l.nextFollowUpAt ? iso(new Date(l.nextFollowUpAt)) : undefined,
  doneAt: l.status === 'booked' || l.status === 'converted' ? iso(new Date(l.updatedAt)) : undefined,
  who: l.assignedAgentId ?? undefined,
  sub: [l.buyerDna?.bhk?.[0], l.buyerDna?.localities?.[0], l.buyerDna?.budgetMax ? formatInr(l.buyerDna.budgetMax) : null].filter(Boolean).join(' · ') || l.phone,
});

const I = {
  cal: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>,
  clock: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>,
  tick: <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  dots: <svg width="16" height="4" viewBox="0 0 16 4" fill="currentColor" aria-hidden="true"><circle cx="2" cy="2" r="1.5" /><circle cx="8" cy="2" r="1.5" /><circle cx="14" cy="2" r="1.5" /></svg>,
  filter: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>,
};

/** move a card to a column, before another card (null: to the end) */
function moveCard(list: Card[], id: string, to: LeadStatus, before: string | null, today: Date) {
  const c = list.find(x => x.id === id);
  if (!c) return list;
  const rest = list.filter(x => x.id !== id);
  const nc: Card = { ...c, column: to, doneAt: to === 'booked' ? (c.column === 'booked' ? c.doneAt : iso(today)) : undefined };
  const at = before ? rest.findIndex(x => x.id === before) : -1;
  if (at >= 0) rest.splice(at, 0, nc);
  else {
    let last = -1;
    rest.forEach((x, i) => { if (x.column === to) last = i; });
    rest.splice(last >= 0 ? last + 1 : rest.length, 0, nc);
  }
  return rest;
}

type Drag = { id: string; from: LeadStatus; w: number; h: number; ox: number; oy: number };
type Over = { col: LeadStatus; before: string | null };

interface LeadsKanbanBoardProps {
  onSelectLead: (lead: LeadItemResponse) => void;
}

export const LeadsKanbanBoard: React.FC<LeadsKanbanBoardProps> = ({ onSelectLead }) => {
  const toast = useToast();
  const { data: board, isLoading } = useKanbanBoard();
  const updateStage = useUpdateStage();
  const [today] = useState(() => new Date());
  // column limits and folds are a per-browser preference
  const [cols, setCols] = useState<Column[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Record<string, Pick<Column, 'limit' | 'collapsed'>>;
      return COLUMNS.map(c => ({ ...c, ...saved[c.id] }));
    } catch { return COLUMNS; }
  });
  const [list, setList] = useState<Card[]>([]);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [fTags, setFTags] = useState<string[]>([]);
  const [fPeople, setFPeople] = useState<string[]>([]);
  const [fSoon, setFSoon] = useState(false);
  const [pop, setPop] = useState<string | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<Over | null>(null);
  const [grab, setGrab] = useState<{ id: string; snap: Card[] } | null>(null);
  const [live, setLive] = useState('');
  const [adding, setAdding] = useState(false);
  const [lostFor, setLostFor] = useState<{ card: Card; snap: Card[] } | null>(null);

  const boardRef = useRef<HTMLDivElement>(null), floatRef = useRef<HTMLDivElement>(null), shellRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef<Record<string, HTMLElement | null>>({});
  const rects = useRef(new Map<string, { x: number; y: number }>());
  const landing = useRef<{ id: string; x: number; y: number } | null>(null);
  const press = useRef<{ id: string; x: number; y: number; touch: boolean; timer?: ReturnType<typeof setTimeout>; started: boolean; dead: boolean; el: HTMLElement } | null>(null);
  const overRef = useRef<Over | null>(null), dragInfo = useRef<Drag | null>(null), blockTouch = useRef<((e: TouchEvent) => void) | null>(null);

  // the server's board is the truth; take it whenever it changes (not mid-drag)
  useEffect(() => {
    if (!board || dragInfo.current) return;
    setList(board.columns.flatMap(c => c.leads.map(toCard)));
  }, [board]);
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(Object.fromEntries(cols.map(c => [c.id, { limit: c.limit, collapsed: c.collapsed }])))); } catch { /* storage unavailable */ }
  }, [cols]);

  const people: Person[] = useMemo(() => {
    const m = new Map<string, string>();
    list.forEach(c => { if (c.who && c.lead.assignedAgentName) m.set(c.who, c.lead.assignedAgentName); });
    return [...m].map(([id, name]) => ({ id, name }));
  }, [list]);
  const person = (id?: string) => people.find(p => p.id === id);
  const tagOf = (name?: string) => TAGS.find(t => t.name === name);

  const shows = useCallback((c: Card) => {
    if (fTags.length && !fTags.includes(c.tag ?? '')) return false;
    if (fPeople.length && !fPeople.includes(c.who ?? '')) return false;
    if (fSoon && (c.column === 'booked' || !c.due || diffDays(c.due, today) > 2)) return false;
    return true;
  }, [fTags, fPeople, fSoon, today]);
  const nFilters = fTags.length + fPeople.length + (fSoon ? 1 : 0);
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  useEffect(() => {
    if (!pop) return;
    const down = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest?.('.kbn-pop,[data-pop]')) setPop(null); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setPop(null); };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [pop]);

  /* FLIP: cards glide to wherever they end up */
  useLayoutEffect(() => {
    const b = boardRef.current;
    if (!b) { rects.current.clear(); return; }
    const br = b.getBoundingClientRect();
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const next = new Map<string, { x: number; y: number }>();
    b.querySelectorAll<HTMLElement>('[data-kid]').forEach(el => {
      const id = el.dataset.kid!, r = el.getBoundingClientRect();
      if (!r.width) return;
      const p = { x: r.left - br.left + b.scrollLeft, y: r.top - br.top };
      next.set(id, p);
      const land = landing.current?.id === id ? landing.current : null;
      const prev = land ? { x: land.x - br.left + b.scrollLeft, y: land.y - br.top } : rects.current.get(id);
      if (still || !prev) return;
      const dx = prev.x - p.x, dy = prev.y - p.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px,${dy}px)${land ? ' rotate(-2.5deg)' : ''}` }, { transform: 'none' }], { duration: land ? 280 : 320, easing: 'cubic-bezier(.22,1,.36,1)' });
    });
    landing.current = null;
    rects.current = next;
  });

  /* saving a move: the stage goes to the server; Lost asks for a reason first; a failure puts the card back */
  const save = (card: Card, to: LeadStatus, snap: Card[]) => {
    if (card.column === to) return;
    if (to === 'lost') { setLostFor({ card, snap }); return; }
    const title = cols.find(c => c.id === to)?.title ?? to;
    updateStage.mutate({ leadId: card.id, status: to }, {
      onSuccess: () => setLive(`${card.lead.name} is now in ${title}.`),
      onError: err => { setList(snap); toast.error(err instanceof Error ? err.message : 'Could not move the lead.'); },
    });
  };

  /* pointer drag */
  const hitTest = (x: number, y: number, dragId: string): Over | null => {
    let best: [string, HTMLElement] | null = null;
    for (const [id, el] of Object.entries(colRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left - 5 && x <= r.right + 5) { best = [id, el]; break; }
    }
    if (!best) return overRef.current;
    const [col, el] = best;
    const els = Array.from(el.querySelectorAll<HTMLElement>('[data-kid]')).filter(c => c.dataset.kid !== dragId);
    const below = els.find(c => { const r = c.getBoundingClientRect(); return y < r.top + r.height / 2; });
    return { col: col as LeadStatus, before: below?.dataset.kid ?? null };
  };
  const placeFloat = (x: number, y: number) => {
    const f = floatRef.current, d = dragInfo.current;
    if (f && d) f.style.transform = `translate(${x - d.ox}px,${y - d.oy}px)`;
  };
  const nextVisibleAfter = (c: Card) => {
    const inCol = list.filter(k => k.column === c.column && shows(k));
    return inCol[inCol.findIndex(k => k.id === c.id) + 1]?.id ?? null;
  };
  const begin = (x: number, y: number) => {
    const p = press.current;
    if (!p || p.dead) return;
    const c = list.find(k => k.id === p.id);
    if (!c) return;
    const r = p.el.getBoundingClientRect();
    const d: Drag = { id: p.id, from: c.column, w: r.width, h: r.height, ox: p.x - r.left, oy: p.y - r.top };
    p.started = true;
    dragInfo.current = d;
    setDrag(d);
    const o = { col: c.column, before: nextVisibleAfter(c) };
    overRef.current = o; setOver(o);
    setPop(null);
    requestAnimationFrame(() => placeFloat(x, y));
    if (p.touch) {
      const f = (e: TouchEvent) => e.preventDefault();
      blockTouch.current = f;
      document.addEventListener('touchmove', f, { passive: false });
    }
  };
  const finish = (cancel: boolean) => {
    const d = dragInfo.current, o = overRef.current, f = floatRef.current;
    if (blockTouch.current) { document.removeEventListener('touchmove', blockTouch.current); blockTouch.current = null; }
    dragInfo.current = null;
    if (d && f) { const r = f.getBoundingClientRect(); landing.current = { id: d.id, x: r.left, y: r.top }; }
    // limits warn (amber, then red) but never refuse a lead: a pipeline stage can't turn a buyer away
    if (d && o && !cancel) {
      const card = list.find(k => k.id === d.id);
      const snap = list;
      setList(l => moveCard(l, d.id, o.col, o.before, today));
      if (card) save(card, o.col, snap);
    }
    overRef.current = null;
    setDrag(null); setOver(null);
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (!p.started) {
        if (p.touch) { if (dist > 8) { p.dead = true; clearTimeout(p.timer); } return; }
        if (dist > 4) begin(e.clientX, e.clientY); else return;
      }
      placeFloat(e.clientX, e.clientY);
      const o = hitTest(e.clientX, e.clientY, p.id);
      if (o && (o.col !== overRef.current?.col || o.before !== overRef.current?.before)) { overRef.current = o; setOver(o); }
    };
    const up = () => {
      const p = press.current;
      if (!p) return;
      clearTimeout(p.timer);
      press.current = null;
      if (p.started) finish(false);
      else if (!p.dead) { const c = list.find(k => k.id === p.id); if (c) onSelectLead(c.lead); }
    };
    const cancel = () => { const p = press.current; if (!p) return; clearTimeout(p.timer); press.current = null; if (p.started) finish(true); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && press.current?.started) cancel(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key); };
  });
  const onCardDown = (e: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (e.button !== 0) return;
    if (grab) setGrab(null);
    if (e.pointerType === 'mouse') { e.preventDefault(); e.currentTarget.focus({ preventScroll: true }); }
    const touch = e.pointerType !== 'mouse';
    press.current = { id, x: e.clientX, y: e.clientY, touch, started: false, dead: false, el: e.currentTarget };
    if (touch) { const x = e.clientX, y = e.clientY; press.current.timer = setTimeout(() => begin(x, y), 240); }
  };

  /* keyboard: Space picks up, arrows move, Space puts down (and saves), Escape puts back */
  const onCardKey = (e: ReactKeyboardEvent<HTMLDivElement>, c: Card) => {
    if (grab?.id === c.id) {
      const colIdx = cols.findIndex(x => x.id === c.column);
      const vis = (col: string) => list.filter(k => k.column === col && k.id !== c.id && shows(k));
      const mine = list.filter(k => k.column === c.column && shows(k));
      const at = mine.findIndex(k => k.id === c.id);
      let to = c.column, idx = at;
      if (e.key === 'ArrowUp') idx = Math.max(0, at - 1);
      else if (e.key === 'ArrowDown') idx = Math.min(vis(c.column).length, at + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const n = cols[colIdx + (e.key === 'ArrowLeft' ? -1 : 1)];
        if (!n) { e.preventDefault(); return; }
        to = n.id; idx = Math.min(at, vis(n.id).length);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const orig = grab.snap.find(k => k.id === c.id);
        setGrab(null);
        if (orig) save(orig, c.column, grab.snap);
        return;
      } else if (e.key === 'Escape') { e.preventDefault(); setList(grab.snap); setGrab(null); return; } else return;
      e.preventDefault();
      if (to === c.column && idx === at) return;
      setList(l => moveCard(l, c.id, to, vis(to)[idx]?.id ?? null, today));
      return;
    }
    if (e.key === ' ') { e.preventDefault(); setGrab({ id: c.id, snap: list }); setLive(`Picked up ${c.lead.name}. Arrow keys move it, Space puts it down, Escape puts it back.`); }
    else if (e.key === 'Enter') { e.preventDefault(); onSelectLead(c.lead); }
  };
  useEffect(() => {
    if (!grab) return;
    const el = boardRef.current?.querySelector<HTMLElement>(`[data-kid="${grab.id}"]`);
    if (el && document.activeElement !== el) el.focus({ preventScroll: false });
  });

  // N adds a lead, unless you are typing
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || t.closest?.('input,textarea,select,[contenteditable]') || grab || adding) return;
      if (!shellRef.current || !(shellRef.current.contains(t) || t === document.body)) return;
      e.preventDefault(); setAdding(true);
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });

  const changeCol = (id: string, patch: Partial<Column>) => setCols(cs => cs.map(c => (c.id === id ? { ...c, ...patch } : c)));
  const sortByDue = (col: string) => {
    setList(l => {
      const inCol = l.filter(k => k.column === col).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));
      let i = 0;
      return l.map(k => (k.column === col ? inCol[i++]! : k));
    });
    setPop(null);
  };

  /* drawing */
  const total = list.length;
  const won = list.filter(k => k.column === 'booked').length;
  const segs = Math.min(total, 20);
  const segOn = total ? Math.round((won / total) * segs) : 0;
  const dragCard = drag ? list.find(k => k.id === drag.id) : null;
  const dueSoon = list.filter(k => k.column !== 'booked' && k.column !== 'lost' && k.due && diffDays(k.due, today) <= 0).length;

  const Avatar = ({ id }: { id?: string }) => { const p = person(id); return p ? <span className="kbn-av" title={p.name}>{initialsOf(p.name)}</span> : null; };

  const CardBody = ({ c }: { c: Card }) => {
    const t = tagOf(c.tag), isDone = c.column === 'booked';
    let due = <span className="kbn-meta q">No follow-up</span>;
    if (isDone) due = <span className="kbn-meta"><span className="kbn-tick">{I.tick}</span>{c.doneAt ? short(c.doneAt) : ''}</span>;
    else if (c.due) {
      const dd = diffDays(c.due, today);
      due = dd < 0 ? <span className="kbn-meta late">{I.clock}{-dd} day{dd === -1 ? '' : 's'} late</span>
        : dd === 0 ? <span className="kbn-meta soon">{I.clock}Today</span>
        : dd === 1 ? <span className="kbn-meta soon">{I.clock}Tomorrow</span>
        : <span className="kbn-meta">{I.cal}{short(c.due)}</span>;
    }
    return (
      <>
        <div className="kbn-r1">
          {t && <span className="kbn-tag"><i style={{ background: isDone ? 'var(--dim)' : t.color }} />{t.name}{c.lead.intentScore != null ? ` · ${c.lead.intentScore}` : ''}</span>}
          <span className="kbn-id">{c.lead.phone.slice(-4) ? `…${c.lead.phone.slice(-4)}` : ''}</span>
        </div>
        <h3>{c.lead.name}</h3>
        {c.sub && <p className="kbn-subl">{c.sub}</p>}
        <div className="kbn-foot">{due}<span className="sp" /><Avatar id={c.who} /></div>
      </>
    );
  };

  const limitBar = (col: Column, count: number, incoming: boolean) => {
    if (!col.limit) return <div className="kbn-lim none"><span>{col.note ?? 'no limit'}</span></div>;
    const lim = col.limit, after = count + (incoming ? 1 : 0);
    const cls = after > lim ? 'over' : after === lim ? 'full' : '';
    const label = incoming ? (after > lim ? `${after} / ${lim} · over limit` : after === lim ? `${after} / ${lim} · full after this` : `${after} / ${lim}`)
      : count > lim ? `${count} / ${lim} · over limit` : count === lim ? `${count} / ${lim} · full` : `${count} / ${lim}`;
    return (
      <div className="kbn-lim" aria-label={label}>
        <div className={`kbn-ticks ${cls}`}>{Array.from({ length: lim }, (_, i) => <i key={i} className={i < count ? 'f' : incoming && i === count ? 'in' : undefined} />)}</div>
        <span className={cls === 'over' ? 'o' : cls === 'full' ? 'w' : undefined}>{label}</span>
      </div>
    );
  };

  const firstOpen = cols.find(x => !x.collapsed && !x.done)?.id;
  const boardView = (
    <div className="kbn-board" ref={boardRef}>
      {cols.map(col => {
        const all = list.filter(k => k.column === col.id);
        const vis = all.filter(shows);
        const incoming = !!drag && over?.col === col.id && drag.from !== col.id;
        const isDone = !!col.done;
        const shown = isDone && !doneOpen ? vis.slice(0, 5) : vis;
        const hidden = vis.length - shown.length;
        if (col.collapsed) {
          return (
            <section key={col.id} ref={el => { colRefs.current[col.id] = el; }} className={`kbn-col fold${incoming ? ' hot' : ''}`} aria-label={col.title} onClick={() => changeCol(col.id, { collapsed: false })}>
              <button type="button" className="kbn-more" aria-label={`Open column: ${col.title}`}>{I.dots}</button>
              <div className="kbn-fold-t">{col.title}<span>{all.length}</span></div>
            </section>
          );
        }
        const slot = drag && over?.col === col.id ? (
          <div className={`kbn-slot${col.limit && all.length - (drag.from === col.id ? 1 : 0) + 1 > col.limit ? ' o' : ''}`} style={{ height: drag.h }} aria-hidden="true" />
        ) : null;
        const slotAt = slot ? (over!.before ? shown.findIndex(k => k.id === over!.before) : -1) : -1;
        return (
          <section key={col.id} ref={el => { colRefs.current[col.id] = el; }} className={`kbn-col${incoming ? ' hot' : ''}`} aria-label={col.title}>
            <div className="kbn-ch">
              {/* with a filter on, "2 / 9": what shows out of what the stage holds */}
              <b>{col.title}</b><span className="n">{nFilters ? `${vis.length} / ${all.length}` : all.length}</span><span className="sp" />
              <span style={{ position: 'relative' }}>
                <button type="button" className="kbn-more" data-pop aria-expanded={pop === col.id} aria-label={`${col.title} menu`} onClick={() => setPop(pop === col.id ? null : col.id)}>{I.dots}</button>
                {pop === col.id && (
                  <div className="kbn-pop" role="menu">
                    <div className="kbn-opt" style={{ cursor: 'default' }}>
                      Limit
                      <div className="kbn-step">
                        <button type="button" aria-label="Lower limit" onClick={() => changeCol(col.id, { limit: Math.max(0, (col.limit ?? 0) - 1) || undefined })}>−</button>
                        <b>{col.limit ?? '∞'}</b>
                        <button type="button" aria-label="Raise limit" onClick={() => changeCol(col.id, { limit: (col.limit ?? Math.max(0, all.length - 1)) + 1 })}>+</button>
                      </div>
                    </div>
                    <hr />
                    <button type="button" role="menuitem" className="kbn-opt" onClick={() => sortByDue(col.id)}>Sort by follow-up</button>
                    <button type="button" role="menuitem" className="kbn-opt" onClick={() => { setAdding(true); setPop(null); }}>Add a lead</button>
                    <button type="button" role="menuitem" className="kbn-opt" onClick={() => { changeCol(col.id, { collapsed: true }); setPop(null); }}>Fold column</button>
                  </div>
                )}
              </span>
            </div>
            {limitBar(col, all.length - (drag && drag.from === col.id && over?.col !== col.id ? 1 : 0), incoming)}
            <div className="kbn-list">
              {shown.map((c, i) => (
                <React.Fragment key={c.id}>
                  {i === slotAt && slot}
                  <div data-kid={c.id} role="button" tabIndex={0} aria-roledescription="lead card" aria-pressed={grab?.id === c.id || undefined}
                    className={`kbn-card${isDone ? ' done' : ''}${drag?.id === c.id ? (over?.col === col.id ? ' gone' : ' ghost') : ''}${grab?.id === c.id ? ' grab' : ''}`}
                    onPointerDown={e => onCardDown(e, c.id)} onKeyDown={e => onCardKey(e, c)} onContextMenu={e => { if (press.current?.touch) e.preventDefault(); }}>
                    <CardBody c={c} />
                  </div>
                </React.Fragment>
              ))}
              {slot && slotAt === -1 && slot}
              {vis.length === 0 && !slot && <div className="kbn-empty">{nFilters ? 'Nothing here' : 'No leads yet'}</div>}
            </div>
            {isDone && hidden > 0 && <button type="button" className="kbn-addc" onClick={() => setDoneOpen(true)}>+ {hidden} more booked</button>}
            {isDone && doneOpen && vis.length > 5 && <button type="button" className="kbn-addc" onClick={() => setDoneOpen(false)}>Show less</button>}
            {!isDone && col.id === firstOpen && <button type="button" className="kbn-addc" onClick={() => setAdding(true)}>+ Add a lead<kbd>N</kbd></button>}
          </section>
        );
      })}
    </div>
  );

  const listView = (
    <div className="kbn-tbl">
      {cols.map(col => {
        const rows = list.filter(k => k.column === col.id && shows(k));
        return (
          <div key={col.id}>
            <div className="kbn-tg">{col.title}<span>{rows.length}</span></div>
            {rows.length === 0 && <div className="kbn-empty">Nothing here</div>}
            {rows.map(c => {
              const t = tagOf(c.tag), dd = c.due ? diffDays(c.due, today) : null;
              return (
                <button type="button" key={c.id} className="kbn-tr" onClick={() => onSelectLead(c.lead)}>
                  <span className="kbn-id">{c.lead.phone.slice(-4) ? `…${c.lead.phone.slice(-4)}` : ''}</span>
                  <span className="t">{c.lead.name}</span>
                  <span className="kbn-tag">{t && <i style={{ background: t.color }} />}{t?.name}</span>
                  <span className={`kbn-meta${col.done ? '' : dd === null ? ' q' : dd < 0 ? ' late' : dd <= 1 ? ' soon' : ''}`}>
                    {col.done ? (c.doneAt ? short(c.doneAt) : '') : dd === null ? 'No follow-up' : dd < 0 ? `${-dd}d late` : dd === 0 ? 'Today' : dd === 1 ? 'Tomorrow' : short(c.due!)}
                  </span>
                  <div className="kbn-avs"><Avatar id={c.who} /></div>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="kbn">
      <style>{CSS}</style>
      <div className="kbn-shell" ref={shellRef}>
        <header className="kbn-top">
          <div>
            <div className="kbn-eye">Pipeline · all leads</div>
            <h2>Leads board</h2>
            <div className="kbn-proj">
              <div className="kbn-seg" aria-hidden="true">{Array.from({ length: segs }, (_, i) => <i key={i} className={i < segOn ? 'f' : undefined} />)}</div>
              <span>{won} of {total} booked{dueSoon ? ` · ${dueSoon} follow-up${dueSoon === 1 ? '' : 's'} due` : ''}</span>
            </div>
          </div>
          <div className="kbn-right">
            <div className="kbn-views" role="group" aria-label="View">
              {(['board', 'list'] as const).map(v => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === 'board' ? 'Board' : 'List'}</button>)}
            </div>
            <div className="kbn-avs" role="group" aria-label="Agents">
              {people.map(p => (
                <button key={p.id} type="button" title={p.name} aria-pressed={fPeople.includes(p.id)} className={fPeople.includes(p.id) ? 'on' : fPeople.length ? 'dimmed' : undefined} onClick={() => setFPeople(f => toggle(f, p.id))}>
                  <span className="kbn-av">{initialsOf(p.name)}</span>
                </button>
              ))}
            </div>
            <div className="kbn-pop-wrap">
              <button type="button" className="kbn-btn" data-pop aria-expanded={pop === 'filter'} onClick={() => setPop(pop === 'filter' ? null : 'filter')}>
                {I.filter}Filter{nFilters > 0 && <b>{nFilters}</b>}
              </button>
              {pop === 'filter' && (
                <div className="kbn-pop" role="dialog" aria-label="Filter">
                  <h4>Intent</h4>
                  {TAGS.map(t => (
                    <button key={t.name} type="button" role="menuitemcheckbox" aria-checked={fTags.includes(t.name)} className="kbn-opt" onClick={() => setFTags(f => toggle(f, t.name))}>
                      <i className="dot" style={{ background: t.color }} />{t.name}<span className="ck">{fTags.includes(t.name) && I.tick}</span>
                    </button>
                  ))}
                  {people.length > 0 && <><hr /><h4>Agents</h4></>}
                  {people.map(p => (
                    <button key={p.id} type="button" role="menuitemcheckbox" aria-checked={fPeople.includes(p.id)} className="kbn-opt" onClick={() => setFPeople(f => toggle(f, p.id))}>
                      <span className="kbn-av" style={{ '--kbn-ring': 'var(--card)' } as CSSProperties}>{initialsOf(p.name)}</span>
                      <span className="who"><b>{splitName(p.name).name}</b>{splitName(p.name).role && <small>{splitName(p.name).role}</small>}</span>
                      <span className="ck">{fPeople.includes(p.id) && I.tick}</span>
                    </button>
                  ))}
                  <hr />
                  <button type="button" role="menuitemcheckbox" aria-checked={fSoon} className="kbn-opt" onClick={() => setFSoon(s => !s)}>{I.clock}Follow-up in 2 days<span className="ck">{fSoon && I.tick}</span></button>
                  {nFilters > 0 && <><hr /><button type="button" className="kbn-opt" style={{ color: 'var(--soft)' }} onClick={() => { setFTags([]); setFPeople([]); setFSoon(false); }}>Clear</button></>}
                </div>
              )}
            </div>
            <button type="button" className="kbn-btn w" onClick={() => setAdding(true)}>+ Add lead</button>
          </div>
        </header>

        {isLoading ? <div className="kbn-empty" style={{ padding: 40 }}>Loading the pipeline…</div> : view === 'board' ? boardView : listView}

        {drag && dragCard && (
          <div ref={floatRef} className="kbn-card kbn-float" style={{ width: drag.w, transform: 'translate(-9999px,0)' }} aria-hidden="true">
            <CardBody c={dragCard} />
          </div>
        )}
        <div className="kbn-live" aria-live="assertive">{live}</div>
      </div>

      {/* portalled: the page's animated wrapper would otherwise trap these fixed overlays inside it */}
      {createPortal(
        <>
          {adding && <AddLeadModal isOpen onClose={() => setAdding(false)} />}
          {lostFor && (
            <LostReasonModal
              isOpen
              leadName={lostFor.card.lead.name}
              onClose={() => { setList(lostFor.snap); setLostFor(null); }}
              onConfirm={reason => {
                const { card, snap } = lostFor;
                setLostFor(null);
                updateStage.mutate({ leadId: card.id, status: 'lost', lostReason: reason }, {
                  onSuccess: () => setLive(`${card.lead.name} is now in Lost.`),
                  onError: err => { setList(snap); toast.error(err instanceof Error ? err.message : 'Could not move the lead.'); },
                });
              }}
            />
          )}
        </>,
        document.body,
      )}
    </div>
  );
};

export default LeadsKanbanBoard;

/* Cue's board, with its shell, column, card and status colours taken from the app's theme tokens */
const CSS = `
.kbn { --shell: var(--surface); --col: var(--surface-2); --colhot: color-mix(in srgb, var(--surface-2) 88%, var(--text)); --card: var(--surface); --card2: var(--surface-3, var(--border)); --lift: var(--surface); --track: var(--border); --fill: var(--text-muted); --hi: var(--text); --soft: var(--text-muted); --dim: var(--text-faint); --ok: var(--success); --warn: var(--warning); --bad: var(--danger); --av: var(--surface-3, var(--surface-2)); --avt: var(--text); --mono: var(--font-mono, ui-monospace, monospace);
  width: 100%; color: var(--hi); -webkit-font-smoothing: antialiased; }
.kbn *, .kbn *::before, .kbn *::after { box-sizing: border-box; margin: 0; }
.kbn button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: inherit; }
.kbn button:focus-visible, .kbn .kbn-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.kbn .kbn-shell { position: relative; width: 100%; background: var(--shell); border: 1px solid var(--border); border-radius: 24px; padding: 10px; }
.kbn .kbn-top { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 18px; padding: 14px 14px 18px; }
.kbn .kbn-eye { font: 500 10px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--dim); }
.kbn .kbn-top h2 { font-size: 24px; font-weight: 600; letter-spacing: -.02em; margin-top: 6px; line-height: 1.15; }
.kbn .kbn-proj { display: flex; align-items: center; gap: 12px; margin-top: 12px; flex-wrap: wrap; }
.kbn .kbn-seg { display: flex; gap: 3px; }
.kbn .kbn-seg i { width: 10px; height: 4px; border-radius: 2px; background: var(--track); transition: background .4s; }
.kbn .kbn-seg i.f { background: var(--ok); }
.kbn .kbn-proj span { font: 500 11px var(--mono); color: var(--soft); }
.kbn .kbn-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.kbn .kbn-views { display: flex; gap: 16px; margin-right: 12px; }
.kbn .kbn-views button { font-size: 13px; font-weight: 500; color: var(--dim); display: flex; align-items: center; gap: 6px; transition: color .2s; }
.kbn .kbn-views button::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: var(--accent); opacity: 0; transition: opacity .2s; }
.kbn .kbn-views button:hover { color: var(--soft); }
.kbn .kbn-views button[aria-pressed="true"] { color: var(--hi); }
.kbn .kbn-views button[aria-pressed="true"]::before { opacity: 1; }
.kbn .kbn-av { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; flex: none; font-size: 9px; font-weight: 600; color: var(--avt); background: var(--av); box-shadow: 0 0 0 2px var(--kbn-ring, var(--card)); transition: box-shadow .2s, opacity .2s; }
.kbn .kbn-avs { display: flex; }
.kbn .kbn-avs > * + * { margin-left: -4px; }
.kbn .kbn-top .kbn-av { --kbn-ring: var(--shell); }
/* header agents: spaced, not stacked, so a selected ring never cuts into its neighbour */
.kbn .kbn-top .kbn-avs { gap: 6px; padding: 3px; }
.kbn .kbn-top .kbn-avs > * + * { margin-left: 0; }
.kbn .kbn-top .kbn-avs button { border-radius: 50%; }
.kbn .kbn-top .kbn-av { width: 28px; height: 28px; font-size: 10px; box-shadow: inset 0 0 0 1px var(--border); }
.kbn .kbn-top .kbn-avs button:hover .kbn-av { box-shadow: inset 0 0 0 1px var(--text-muted); }
.kbn .kbn-top .kbn-avs button.dimmed .kbn-av { opacity: .45; }
.kbn .kbn-top .kbn-avs button.on .kbn-av { background: var(--accent); color: var(--on-accent, #fff); box-shadow: 0 0 0 2px var(--shell), 0 0 0 3.5px var(--accent); opacity: 1; }
/* filter rows: name on one line, the role under it, both cut with … instead of wrapping into the next row */
.kbn .kbn-pop { width: 270px; }
.kbn .kbn-opt .who { flex: 1; min-width: 0; display: grid; line-height: 1.25; text-align: left; }
.kbn .kbn-opt .who b { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kbn .kbn-opt .who small { font-size: 11px; color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kbn .kbn-opt:has(.who) { height: auto; min-height: 44px; padding-top: 5px; padding-bottom: 5px; }
.kbn .kbn-opt .ck { flex: none; }
.kbn .kbn-btn { height: 36px; padding: 0 15px; border-radius: 999px; background: var(--col) !important; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; transition: filter .2s; }
.kbn .kbn-btn:hover { filter: brightness(.96); }
.kbn .kbn-btn.w { background: var(--accent) !important; color: var(--on-accent, #fff); font-weight: 600; }
.kbn .kbn-btn.w:hover { filter: brightness(1.08); }
.kbn .kbn-btn b { font: 500 10.5px var(--mono); color: var(--soft); }
.kbn .kbn-pop-wrap { position: relative; }
.kbn .kbn-pop { position: absolute; top: calc(100% + 8px); right: 0; z-index: 30; width: 250px; max-height: min(460px, 70vh); overflow-y: auto; overscroll-behavior: contain; background: var(--card); border: 1px solid var(--border); box-shadow: 0 18px 40px -18px rgba(0,0,0,.4); border-radius: 18px; padding: 8px; animation: kbnPop .18s ease-out; }
.kbn .kbn-pop h4 { font: 500 10px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--dim); padding: 8px 10px 6px; }
.kbn .kbn-opt { display: flex; align-items: center; gap: 10px; width: 100%; height: 34px; padding: 0 10px; border-radius: 10px; font-size: 13px; transition: background .15s; }
.kbn .kbn-opt:hover { background: var(--col); }
.kbn .kbn-opt .ck { margin-left: auto; width: 16px; height: 16px; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid var(--dim); }
.kbn .kbn-opt[aria-checked="true"] .ck { background: var(--accent); border-color: var(--accent); color: var(--on-accent, #fff); }
.kbn .kbn-opt .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
.kbn .kbn-pop hr { border: 0; height: 1px; background: var(--border); margin: 6px 4px; }
.kbn .kbn-step { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.kbn .kbn-step button { width: 26px; height: 26px; border-radius: 50%; background: var(--col) !important; display: grid; place-items: center; font-size: 15px; line-height: 1; }
.kbn .kbn-step b { font: 500 12px var(--mono); min-width: 22px; text-align: center; }
/* the board always scrolls sideways: a pipeline has more stages than fit */
.kbn .kbn-board { display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x proximity; padding-bottom: 6px; scrollbar-width: thin; }
.kbn .kbn-col { flex: 0 0 272px; scroll-snap-align: start; background: var(--col); border-radius: 20px; padding: 16px 8px 8px; position: relative; min-height: 420px; display: flex; flex-direction: column; transition: background .3s; }
.kbn .kbn-col.hot { background: var(--colhot); }
.kbn .kbn-col.nope { animation: kbnNope .45s; }
.kbn .kbn-col.fold { flex: 0 0 52px; min-height: 0; padding: 16px 0; align-items: center; cursor: pointer; }
.kbn .kbn-col.fold .kbn-fold-t { writing-mode: vertical-rl; font-size: 13.5px; font-weight: 500; margin-top: 14px; display: flex; gap: 10px; align-items: center; }
.kbn .kbn-col.fold .kbn-fold-t span { font: 500 11px var(--mono); color: var(--soft); }
.kbn .kbn-ch { display: flex; align-items: baseline; gap: 9px; padding: 0 10px; }
.kbn .kbn-ch b { font-size: 14px; font-weight: 600; letter-spacing: -.01em; }
.kbn .kbn-ch .n { font: 500 12px var(--mono); color: var(--soft); }
.kbn .kbn-ch .sp { flex: 1; }
.kbn .kbn-more { width: 28px; height: 22px; border-radius: 8px; color: var(--dim); display: grid; place-items: center; transition: color .2s, background .2s; }
.kbn .kbn-more:hover, .kbn .kbn-more[aria-expanded="true"] { color: var(--hi); background: var(--card); }
.kbn .kbn-ch .kbn-pop { top: 34px; right: 6px; }
.kbn .kbn-lim { display: flex; align-items: center; gap: 10px; padding: 12px 10px 14px; min-height: 42px; }
.kbn .kbn-ticks { display: flex; gap: 3px; flex: 1; }
.kbn .kbn-ticks i { flex: 1; height: 4px; border-radius: 2px; background: var(--track); transition: background .3s; }
.kbn .kbn-ticks i.f { background: var(--fill); }
.kbn .kbn-ticks.full i.f { background: var(--warn); }
.kbn .kbn-ticks.over i.f, .kbn .kbn-ticks.over i.in { background: var(--bad); }
.kbn .kbn-ticks i.in { background: repeating-linear-gradient(-45deg, var(--warn) 0 2px, transparent 2px 4px); animation: kbnBlink .6s ease-in-out infinite alternate; }
.kbn .kbn-ticks.over i.in { background: repeating-linear-gradient(-45deg, var(--bad) 0 2px, transparent 2px 4px); }
.kbn .kbn-lim span { font: 500 10.5px var(--mono); color: var(--dim); white-space: nowrap; }
.kbn .kbn-lim span.w { color: var(--warn); } .kbn .kbn-lim span.o { color: var(--bad); }
.kbn .kbn-lim.none span { flex: 1; }
.kbn .kbn-list { display: flex; flex-direction: column; gap: 6px; min-height: 60px; }
.kbn .kbn-card { background: var(--card); border-radius: 16px; padding: 12px 13px 11px; position: relative; cursor: grab; user-select: none; -webkit-user-select: none; box-shadow: inset 0 0 0 1px var(--border-subtle, transparent); transition: box-shadow .2s, opacity .2s; }
.kbn .kbn-card:hover { box-shadow: inset 0 0 0 1px var(--border); }
.kbn .kbn-card.ghost { opacity: .22; }
.kbn .kbn-card.gone { display: none; }
.kbn .kbn-card.grab { outline: 2px dashed var(--accent); outline-offset: 2px; }
.kbn .kbn-r1 { display: flex; align-items: center; gap: 8px; }
.kbn .kbn-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--soft); font-weight: 500; }
.kbn .kbn-tag i { width: 6px; height: 6px; border-radius: 50%; flex: none; }
.kbn .kbn-id { margin-left: auto; font: 500 10.5px var(--mono); color: var(--dim); }
.kbn .kbn-card h3 { font-size: 13.5px; font-weight: 600; line-height: 1.35; margin: 7px 0 2px; overflow-wrap: anywhere; }
.kbn .kbn-subl { font-size: 12px; color: var(--soft); margin: 0 0 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kbn .kbn-card.done h3 { color: var(--soft); }
.kbn .kbn-foot { display: flex; align-items: center; gap: 12px; min-height: 24px; }
.kbn .kbn-foot .sp { flex: 1; }
.kbn .kbn-meta { font: 500 11px var(--mono); color: var(--soft); display: flex; align-items: center; gap: 5px; white-space: nowrap; }
.kbn .kbn-meta.soon { color: var(--warn); } .kbn .kbn-meta.late { color: var(--bad); } .kbn .kbn-meta.q { color: var(--dim); }
.kbn .kbn-tick { width: 14px; height: 14px; border-radius: 50%; background: var(--ok); display: grid; place-items: center; color: #fff; }
.kbn .kbn-slot { border-radius: 16px; border: 1.5px dashed color-mix(in srgb, var(--hi) 25%, transparent); flex: none; }
.kbn .kbn-slot.o { border-color: var(--bad); }
.kbn .kbn-float { position: fixed; left: 0; top: 0; z-index: 1000; pointer-events: none; background: var(--lift); cursor: grabbing; rotate: -2.5deg; box-shadow: inset 0 0 0 1px var(--border), 0 18px 34px -16px rgba(0,0,0,.35); }
.kbn .kbn-float .kbn-av { --kbn-ring: var(--lift); }
.kbn .kbn-addc { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 10px; font-size: 12.5px; color: var(--dim); border-radius: 12px; margin-top: 2px; transition: color .2s; }
.kbn .kbn-addc:hover { color: var(--hi); }
.kbn .kbn-addc kbd { margin-left: auto; font: 500 10px var(--mono); color: var(--dim); border: 1px solid var(--border); border-radius: 5px; padding: 1px 5px; }
.kbn .kbn-empty { font-size: 12px; color: var(--dim); padding: 14px 10px; }
.kbn .kbn-tbl { background: var(--col); border-radius: 20px; padding: 6px 8px 8px; }
.kbn .kbn-tg { display: flex; align-items: baseline; gap: 9px; padding: 14px 12px 8px; font-size: 13.5px; font-weight: 600; }
.kbn .kbn-tg span { font: 500 11.5px var(--mono); color: var(--soft); }
.kbn .kbn-tr { display: grid; grid-template-columns: 64px minmax(0,1fr) 90px 110px 40px; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 0 12px; border-radius: 12px; font-size: 13px; transition: background .15s; }
.kbn .kbn-tr:hover { background: var(--card); }
.kbn .kbn-tr .kbn-id { margin: 0; }
.kbn .kbn-tr .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.kbn .kbn-tr .kbn-avs { justify-content: flex-end; }
.kbn .kbn-tr .kbn-av { --kbn-ring: var(--col); }
.kbn .kbn-live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@keyframes kbnBlink { to { opacity: .4; } }
@keyframes kbnPop { from { opacity: 0; transform: translateY(-4px); } }
@keyframes kbnNope { 20%, 60% { transform: translateX(-5px); } 40%, 80% { transform: translateX(5px); } }
@media (max-width: 960px) { .kbn .kbn-top { grid-template-columns: 1fr; align-items: start; } .kbn .kbn-right { justify-content: flex-start; } .kbn .kbn-pop-wrap .kbn-pop { right: auto; left: 0; } .kbn .kbn-col { flex-basis: min(272px, 78vw); } }
@media (max-width: 560px) { .kbn .kbn-top h2 { font-size: 21px; } .kbn .kbn-views { width: 100%; margin: 0 0 4px; } .kbn .kbn-tr { grid-template-columns: 52px minmax(0,1fr) 84px; } .kbn .kbn-tr .kbn-tag, .kbn .kbn-tr .kbn-avs { display: none; } }
@media (prefers-reduced-motion: reduce) { .kbn *, .kbn *::before { animation: none !important; transition: none !important; } }
`;
