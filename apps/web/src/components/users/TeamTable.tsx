import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';

/**
 * TeamTable (from Cue): the team members table in one card. Search, a status filter and "Add member" on top; sortable
 * headings whose rows slide to their new places; Shift-click range ticking with bulk "Change role / Remove";
 * Edit turns the role into a picker in place; Delete folds the row away; Add member opens an invite row.
 * Status is a dot and a word, never a pill. Colours come from the app's theme tokens, so light and dark follow it.
 * The page decides what the actions really do through onInvite / onRole / onRemove (they may reject: the card then
 * snaps back to the `members` it was given).
 */
export type Status = 'active' | 'away' | 'offline' | 'invited';
export interface Member { id: string; name: string; email: string; status: Status; role: string; lastActive: number; photo?: string }

interface TeamTableProps {
  title?: string;
  members: Member[];
  roles: string[];
  pageSize?: number;
  lastLabel?: string;                                   // heading of the time column (default "Last active")
  statusLabels?: Partial<Record<Status, string>>;
  loading?: boolean;
  onInvite?: (email: string, role: string) => Promise<unknown>;
  onRole?: (ids: string[], role: string) => Promise<unknown>;
  onRemove?: (ids: string[]) => Promise<unknown>;
  confirmRemove?: (ids: string[]) => boolean;           // return false to keep them
  onOpen?: (m: Member) => void;                         // click a name
  className?: string;
  style?: CSSProperties;
}

const STATUS: Record<Status, { label: string; color: string; rank: number }> = {
  active: { label: 'Active', color: 'var(--success)', rank: 0 },
  away: { label: 'Away', color: 'var(--warning)', rank: 1 },
  invited: { label: 'Invited', color: 'var(--accent)', rank: 2 },
  offline: { label: 'Offline', color: 'var(--danger)', rank: 3 },
};

export const minutesSince = (iso: string) => Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
function ago(min: number) {
  if (min >= 1e9) return 'Not yet';
  if (min < 1) return 'Just now';
  if (min < 60) return `${Math.round(min)} min ago`;
  if (min < 1440) return `${Math.round(min / 60)} h ago`;
  const d = Math.round(min / 1440);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
}
const initials = (n: string) => n.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

type SortKey = 'name' | 'status' | 'role' | 'lastActive';

const CSS = `
.tm{--bg:var(--surface);--ink:var(--text);--txt:var(--text-muted);--mute:var(--text-faint);--faint:var(--border);--line:var(--border);--soft:var(--surface-2);--hov:var(--surface-2);--sel:var(--accent-soft);--acc:var(--accent);
  container-type:inline-size;position:relative;width:100%;background:var(--bg);border:1px solid var(--line);border-radius:18px;padding:24px 24px 18px;
  font-family:Inter,system-ui,sans-serif;font-size:13px;line-height:normal;color:var(--ink);-webkit-font-smoothing:antialiased;box-sizing:border-box;text-align:left}
.tm *,.tm *::before,.tm *::after{box-sizing:border-box}
.tm button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;text-align:left}
.tm button:focus-visible,.tm input:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.tm .head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.tm h2{margin:0;font-size:26px;font-weight:600;line-height:1.1;letter-spacing:-0.03em;color:var(--ink)}
.tm .sub{margin-top:10px;height:18px;display:flex;align-items:center;gap:14px;color:var(--mute);font-size:12.5px;white-space:nowrap}
.tm .sub b{font-weight:500;color:var(--ink)}
.tm .sub button{color:var(--txt);font-size:12.5px}
.tm .sub button:hover{color:var(--ink)}
.tm .sub button.danger:hover{color:var(--danger)}
.tm .sub .sep{width:1px;height:12px;background:var(--line)}
.tm .tools{display:flex;align-items:center;gap:8px}
.tm .search{display:flex;align-items:center;gap:8px;height:36px;width:230px;padding:0 12px;border-radius:10px;background:var(--soft);color:var(--mute)}
.tm .search input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:400 13px Inter,system-ui,sans-serif;color:var(--ink);padding:0;margin:0;box-shadow:none}
.tm .search input::placeholder{color:var(--mute)}
.tm .ghost{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 12px;border-radius:10px;color:var(--txt);transition:background .15s,color .15s}
.tm .ghost:hover,.tm .ghost[aria-expanded="true"]{background:var(--soft);color:var(--ink)}
.tm .ghost .n{color:var(--acc)}
.tm .primary{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:10px;background:var(--ink);color:var(--bg);font-weight:500;transition:opacity .15s}
.tm .primary:hover{opacity:.86}
.tm .pop{position:absolute;z-index:5;min-width:170px;padding:6px;border-radius:12px;background:var(--bg);border:1px solid var(--line);box-shadow:0 10px 30px -12px rgba(0,0,0,.3)}
.tm .pop button{display:flex;align-items:center;gap:9px;width:100%;height:32px;padding:0 10px;border-radius:8px;color:var(--txt);text-align:left}
.tm .pop button:hover{background:var(--soft);color:var(--ink)}
.tm .pop button[aria-checked="true"]{color:var(--ink)}
.tm .pop button[aria-checked="true"]::after{content:'';margin-left:auto;width:6px;height:6px;border-radius:50%;background:var(--acc)}
.tm .tm-table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed}
.tm th{height:38px;padding:0 10px;text-align:left;font:500 12px Inter,system-ui,sans-serif;color:var(--mute);background:var(--soft);white-space:nowrap;border:0}
.tm th:first-child{border-radius:10px 0 0 10px}.tm th:last-child{border-radius:0 10px 10px 0}
.tm th .sort{display:inline-flex;align-items:center;gap:5px;color:var(--mute);font:500 12px Inter,system-ui,sans-serif}
.tm th .sort:hover,.tm th .sort.on{color:var(--ink)}
.tm th .sort svg{transition:transform .2s;opacity:.55}
.tm th .sort.on svg{opacity:1}
.tm th .sort.desc svg{transform:rotate(180deg)}
.tm td{height:52px;padding:0 10px;border:0;border-bottom:1px solid var(--line);color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .15s}
.tm tr.row{position:relative}
.tm tr.row:hover td{background:var(--hov)}
.tm tr.row.on td{background:var(--sel)}
.tm tr.row.out td{opacity:0;height:0;border-color:transparent;transition:opacity .22s,height .3s .1s,border-color .3s}
.tm tr.row.new td{animation:tm-in .45s cubic-bezier(.2,.8,.2,1)}
@keyframes tm-in{from{opacity:0;background:var(--sel)}to{opacity:1}}
.tm .ck{width:16px;height:16px;border-radius:5px;border:1.5px solid var(--text-faint);display:grid;place-items:center;transition:background .15s,border-color .15s;cursor:pointer}
.tm .ck svg{opacity:0;transform:scale(.6);transition:opacity .15s,transform .2s cubic-bezier(.3,1.6,.6,1)}
.tm .ck.on,.tm .ck.some{background:var(--ink);border-color:var(--ink)}
.tm .ck.on svg,.tm .ck.some svg{opacity:1;transform:none;color:var(--bg)}
.tm .who{display:flex;align-items:center;gap:10px;min-width:0;color:var(--ink);font-weight:500}
.tm .who span{overflow:hidden;text-overflow:ellipsis}
.tm .who button.nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;color:var(--ink)}
.tm .who button.nm:hover{color:var(--acc)}
.tm .ava{flex:none;width:28px;height:28px;border-radius:50%;object-fit:cover;background:var(--soft);display:grid;place-items:center;font:500 10.5px Inter,system-ui,sans-serif;color:#fff}
.tm .st{display:inline-flex;align-items:center;gap:7px;color:var(--ink)}
.tm .st i{width:6px;height:6px;border-radius:50%;flex:none}
.tm .num{font-variant-numeric:tabular-nums}
.tm .acts{display:flex;justify-content:flex-end;gap:2px;opacity:0;transition:opacity .15s}
.tm tr.row:hover .acts,.tm tr.row:focus-within .acts,.tm tr.row.editing .acts{opacity:1}
@media (hover:none){.tm .acts{opacity:1}}
.tm .act{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 9px;border-radius:8px;color:var(--txt);font-size:12.5px}
.tm .act:hover{background:var(--soft);color:var(--ink)}
.tm .act.del:hover{color:var(--danger)}
.tm .act.save{color:var(--acc)}
.tm .pick{position:relative;display:inline-flex}
.tm td:has(.pick){overflow:visible}
.tm tr.row.editing,.tm tr.addrow{position:relative;z-index:6}
.tm .foot{position:relative;z-index:6}
.tm .pick-btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 8px 0 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:400 13px Inter,system-ui,sans-serif;font-variant-numeric:tabular-nums;transition:border-color .15s}
.tm .pick-btn:hover,.tm .pick-btn[aria-expanded="true"]{border-color:var(--text-faint)}
.tm .pick-btn svg{color:var(--mute);transition:transform .2s}
.tm .pick-btn[aria-expanded="true"] svg{transform:rotate(180deg)}
.tm .pick-pop{display:block;top:calc(100% + 6px);left:0;min-width:max(100%,120px)}
.tm .pick-pop.up{top:auto;bottom:calc(100% + 6px)}
.tm .pop button.hi{background:var(--soft);color:var(--ink)}
.tm .addrow td{background:var(--sel);border-bottom-color:transparent}
.tm .addrow input{width:100%;height:32px;padding:0 10px;margin:0;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:400 13px Inter,system-ui,sans-serif;outline:0;box-shadow:none}
.tm .addrow input:focus{border-color:var(--acc)}
.tm .addrow .err{color:var(--danger);font-size:12px;margin-left:8px}
.tm .empty td{height:120px;text-align:center;color:var(--mute);white-space:normal}
.tm .foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;color:var(--mute);font-size:12.5px;flex-wrap:wrap}
.tm .per{display:flex;align-items:center;gap:8px}
.tm .pages{display:flex;align-items:center;gap:2px}
.tm .pages button{min-width:28px;height:28px;padding:0 6px;border-radius:8px;color:var(--txt);font-variant-numeric:tabular-nums;text-align:center;display:inline-grid;place-items:center}
.tm .pages button:hover{background:var(--soft);color:var(--ink)}
.tm .pages button[aria-current="page"]{background:var(--ink);color:var(--bg)}
.tm .pages button:disabled{opacity:.35;cursor:default;background:none}
.tm .pages .gap{width:20px;text-align:center}
.tm .col-email{width:22%}.tm .col-status{width:15%}.tm .col-role{width:14%}.tm .col-last{width:12%}.tm .col-act{width:150px}.tm .col-ck{width:44px}
@container (max-width: 900px){.tm .col-email,.tm .c-email{display:none}}
@container (max-width: 680px){.tm .col-last,.tm .c-last{display:none}.tm .search{width:160px}.tm h2{font-size:22px}.tm .col-act{width:96px}.tm .act span{display:none}}
@container (max-width: 520px){.tm{padding:18px 14px 14px}.tm .col-role,.tm .c-role{display:none}.tm .tools{width:100%}.tm .search{flex:1;width:auto;min-width:0}
  .tm .lbl{display:none}.tm .ghost,.tm .primary{padding:0 11px}.tm .col-ck{width:36px}.tm .col-status{width:96px}.tm .col-act{width:70px}.tm .act{padding:0 6px}
  .tm th:last-child span{display:none}.tm td,.tm th{padding:0 6px}}
@media (prefers-reduced-motion: reduce){.tm *{transition:none!important;animation:none!important}}
`;

const Check = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const Dash = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" aria-hidden="true"><path d="M6 12h12" /></svg>;
const Arrow = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>;
const Icon = ({ d, s = 14 }: { d: string; s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const I = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  filter: 'M4 6h16M7 12h10M10 18h4',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6',
};

// a picker in the component's own style: a quiet button and a menu that opens below, or above when `up`
function Pick<T extends string | number>({ value, options, onChange, label, up = false, autoFocus = false }:
  { value: T; options: T[]; onChange: (v: T) => void; label: string; up?: boolean; autoFocus?: boolean }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (autoFocus) btn.current?.focus(); }, [autoFocus]);
  useEffect(() => {
    if (!open) return;
    setHi(Math.max(0, options.indexOf(value)));
    const away = (e: Event) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const choose = (v: T) => { onChange(v); setOpen(false); btn.current?.focus(); };
  const onKey = (e: KeyboardEvent) => {
    if (!open) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(options.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(options[hi]!); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.stopPropagation(); setOpen(false); }
  };
  return (
    <span ref={wrap} className="pick" onKeyDown={onKey}>
      <button ref={btn} type="button" className="pick-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${value}`} onClick={() => setOpen(o => !o)}>
        {value}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <span className={'pop pick-pop' + (up ? ' up' : '')} role="listbox" aria-label={label}>
          {options.map((o, i) => (
            <button key={String(o)} type="button" role="option" aria-selected={o === value} aria-checked={o === value} className={i === hi ? 'hi' : undefined} onMouseEnter={() => setHi(i)} onClick={() => choose(o)}>{o}</button>
          ))}
        </span>
      )}
    </span>
  );
}

function Avatar({ m }: { m: Member }) {
  const [bad, setBad] = useState(false);
  if (m.photo && !bad) return <img className="ava" src={m.photo} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} />;
  return <span className="ava" style={{ background: `hsl(${hue(m.name)} 42% 56%)` }} aria-hidden="true">{initials(m.name)}</span>;
}

export function TeamTable({ title = 'Team members', members, roles, pageSize = 8, lastLabel = 'Last active', statusLabels, loading, onInvite, onRole, onRemove, confirmRemove, onOpen, className, style }: TeamTableProps) {
  const [rows, setRows] = useState<Member[]>(members);
  useEffect(() => { setRows(members); }, [members]);
  const label = (s: Status) => statusLabels?.[s] ?? STATUS[s].label;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [per, setPer] = useState(pageSize);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ id: string; role: string } | null>(null);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [fresh, setFresh] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ email: '', role: roles[roles.length - 2] ?? roles[0] ?? '' });
  const [draftErr, setDraftErr] = useState('');
  const [bulkRoleOpen, setBulkRoleOpen] = useState(false);
  const lastTick = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tops = useRef<Map<string, number>>(new Map());

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter(m => (filter === 'all' || m.status === filter) && (!q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)));
    const val = (m: Member) => sort.key === 'status' ? STATUS[m.status].rank : sort.key === 'role' ? roles.indexOf(m.role) : sort.key === 'lastActive' ? m.lastActive : m.name.toLowerCase();
    const out = [...list].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
    const i = fresh ? out.findIndex(m => m.id === fresh) : -1;
    if (i > 0) out.unshift(...out.splice(i, 1));
    return out;
  }, [rows, query, filter, sort, roles, fresh]);

  const pages = Math.max(1, Math.ceil(shown.length / per));
  const cur = Math.min(page, pages);
  const pageRows = shown.slice((cur - 1) * per, cur * per);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  // rows slide to their new places when the order changes (sort, add, delete)
  useLayoutEffect(() => {
    const root = rootRef.current; if (!root) return;
    const next = new Map<string, number>();
    root.querySelectorAll<HTMLTableRowElement>('tr.row').forEach(tr => {
      const id = tr.dataset.id!; const top = tr.offsetTop; next.set(id, top);
      const before = tops.current.get(id);
      if (before !== undefined && before !== top && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        tr.style.transition = 'none'; tr.style.transform = `translateY(${before - top}px)`;
        requestAnimationFrame(() => { tr.style.transition = 'transform .38s cubic-bezier(.2,.8,.2,1)'; tr.style.transform = ''; });
      }
    });
    tops.current = next;
  }, [pageRows.map(m => m.id).join(',')]);

  const sortBy = (key: SortKey) => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }));
  const pageIds = pageRows.map(m => m.id);
  const allOn = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const someOn = !allOn && pageIds.some(id => selected.has(id));
  const toggleAll = () => setSelected(s => { const n = new Set(s); pageIds.forEach(id => (allOn ? n.delete(id) : n.add(id))); return n; });
  const tick = (id: string, e?: MouseEvent) => {
    const last = lastTick.current; // read now: the updater below runs after lastTick changes
    setSelected(s => {
      const n = new Set(s);
      if (e?.shiftKey && last) {
        const a = pageIds.indexOf(last), b = pageIds.indexOf(id);
        if (a >= 0 && b >= 0) { const on = !s.has(id); pageIds.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => (on ? n.add(x) : n.delete(x))); return n; }
      }
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
    lastTick.current = id;
  };
  const remove = (ids: string[]) => {
    if (confirmRemove && !confirmRemove(ids)) return;
    setLeaving(new Set(ids));
    window.setTimeout(() => {
      setRows(r => r.filter(m => !ids.includes(m.id)));
      void onRemove?.(ids);
      setSelected(s => { const n = new Set(s); ids.forEach(id => n.delete(id)); return n; });
      setLeaving(new Set());
    }, 380);
  };
  const setRole = (ids: string[], role: string) => { setRows(r => r.map(m => (ids.includes(m.id) ? { ...m, role } : m))); void onRole?.(ids, role); };
  const invite = () => {
    const email = draft.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setDraftErr('Enter an email address'); return; }
    if (rows.some(m => m.email.toLowerCase() === email.toLowerCase())) { setDraftErr('Already on the team'); return; }
    const name = email.split('@')[0]!.replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const m: Member = { id: `new-${Date.now()}`, name, email, status: 'invited', role: draft.role, lastActive: 1e9 };
    setRows(r => [m, ...r]);
    void onInvite?.(email, draft.role);
    setFresh(m.id); setAdding(false); setDraft({ email: '', role: draft.role }); setDraftErr('');
    setFilter('all'); setQuery(''); setPage(1);
    window.setTimeout(() => setFresh(null), 1600);
  };
  const onDraftKey = (e: KeyboardEvent) => { if (e.key === 'Enter') invite(); if (e.key === 'Escape') { setAdding(false); setDraftErr(''); } };

  useEffect(() => {
    if (!filterOpen && !bulkRoleOpen) return;
    const close = (e: Event) => { if (!(e.target as HTMLElement).closest?.('.pop, [aria-haspopup]')) { setFilterOpen(false); setBulkRoleOpen(false); } };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { setFilterOpen(false); setBulkRoleOpen(false); } };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [filterOpen, bulkRoleOpen]);

  const pageList = (): (number | '…')[] => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    const out: (number | '…')[] = [1];
    const a = Math.max(2, cur - 1), b = Math.min(pages - 1, cur + 1);
    if (a > 2) out.push('…');
    for (let i = a; i <= b; i++) out.push(i);
    if (b < pages - 1) out.push('…');
    out.push(pages);
    return out;
  };
  const sel = [...selected];
  const head = (key: SortKey, text: string) => (
    <button type="button" className={'sort' + (sort.key === key ? ' on' + (sort.dir === -1 ? ' desc' : '') : '')} onClick={() => sortBy(key)} aria-label={`Sort by ${text}`}>{text}<Arrow /></button>
  );
  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none');

  return (
    <div ref={rootRef} className={['tm', className].filter(Boolean).join(' ')} style={style}>
      <style>{CSS}</style>
      <div className="head">
        <div>
          <h2>{title}</h2>
          <div className="sub" aria-live="polite">
            {sel.length ? (
              <>
                <span><b className="num">{sel.length}</b> selected</span>
                <span className="sep" />
                <span style={{ position: 'relative' }}>
                  <button type="button" aria-haspopup="menu" aria-expanded={bulkRoleOpen} onClick={() => setBulkRoleOpen(o => !o)}>Change role</button>
                  {bulkRoleOpen && (
                    <div className="pop" role="menu" style={{ top: 24, left: -8 }}>
                      {roles.map(r => <button key={r} type="button" role="menuitem" onClick={() => { setRole(sel, r); setBulkRoleOpen(false); }}>{r}</button>)}
                    </div>
                  )}
                </span>
                <button type="button" className="danger" onClick={() => remove(sel)}>Remove</button>
                <button type="button" onClick={() => setSelected(new Set())}>Clear</button>
              </>
            ) : <span><span className="num">{rows.length}</span> {rows.length === 1 ? 'member' : 'members'}</span>}
          </div>
        </div>
        <div className="tools">
          <label className="search">
            <Icon d={I.search} />
            <input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Search members" aria-label="Search members" />
          </label>
          <span style={{ position: 'relative' }}>
            <button type="button" className="ghost" aria-haspopup="menu" aria-expanded={filterOpen} onClick={() => setFilterOpen(o => !o)}>
              <Icon d={I.filter} />{filter === 'all' ? <span className="lbl">Filter</span> : <span>Status: <span className="n">{label(filter)}</span></span>}
            </button>
            {filterOpen && (
              <div className="pop" role="menu" style={{ top: 42, right: 0 }}>
                {(['all', 'active', 'away', 'invited', 'offline'] as const).map(k => (
                  <button key={k} type="button" role="menuitemradio" aria-checked={filter === k} onClick={() => { setFilter(k); setPage(1); setFilterOpen(false); }}>
                    {k !== 'all' && <i style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS[k].color, flex: 'none' }} />}
                    {k === 'all' ? 'All statuses' : label(k)}
                  </button>
                ))}
              </div>
            )}
          </span>
          {onInvite && <button type="button" className="primary" aria-label="Add member" onClick={() => { setAdding(true); setDraftErr(''); }}><Icon d={I.plus} /><span className="lbl">Add member</span></button>}
        </div>
      </div>

      <table className="tm-table">
        <colgroup>
          <col className="col-ck" /><col /><col className="col-email" /><col className="col-status" /><col className="col-role" /><col className="col-last" /><col className="col-act" />
        </colgroup>
        <thead>
          <tr>
            <th><span className={'ck' + (allOn ? ' on' : someOn ? ' some' : '')} role="checkbox" aria-checked={allOn ? true : someOn ? 'mixed' : false} aria-label="Select this page" tabIndex={0}
              onClick={toggleAll} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleAll(); } }}>{someOn ? <Dash /> : <Check />}</span></th>
            <th aria-sort={ariaSort('name')}>{head('name', 'Name')}</th>
            <th className="c-email">Email</th>
            <th aria-sort={ariaSort('status')}>{head('status', 'Status')}</th>
            <th className="c-role" aria-sort={ariaSort('role')}>{head('role', 'Role')}</th>
            <th className="c-last" aria-sort={ariaSort('lastActive')}>{head('lastActive', lastLabel)}</th>
            <th style={{ textAlign: 'right' }}><span style={{ paddingRight: 8 }}>Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {adding && (
            <tr className="addrow">
              <td />
              <td colSpan={2}>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <input autoFocus type="email" value={draft.email} placeholder="name@company.com" aria-label="Email to invite"
                    onChange={e => { setDraft({ ...draft, email: e.target.value }); setDraftErr(''); }} onKeyDown={onDraftKey} />
                  {draftErr && <span className="err" role="alert">{draftErr}</span>}
                </span>
              </td>
              <td><span className="st"><i style={{ background: STATUS.invited.color }} />{label('invited')}</span></td>
              <td className="c-role"><Pick value={draft.role} options={roles} label="Role" onChange={r => setDraft({ ...draft, role: r })} /></td>
              <td className="c-last" />
              <td><div className="acts" style={{ opacity: 1 }}>
                <button type="button" className="act save" onClick={invite}>Invite</button>
                <button type="button" className="act" onClick={() => { setAdding(false); setDraftErr(''); }}>Cancel</button>
              </div></td>
            </tr>
          )}
          {pageRows.map(m => {
            const on = selected.has(m.id), ed = editing?.id === m.id;
            return (
              <tr key={m.id} data-id={m.id} className={['row', on ? 'on' : '', ed ? 'editing' : '', leaving.has(m.id) ? 'out' : '', fresh === m.id ? 'new' : ''].filter(Boolean).join(' ')}>
                <td><span className={'ck' + (on ? ' on' : '')} role="checkbox" aria-checked={on} aria-label={`Select ${m.name}`} tabIndex={0}
                  onClick={e => tick(m.id, e)} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tick(m.id); } }}><Check /></span></td>
                <td><div className="who"><Avatar m={m} />{onOpen && m.status !== 'invited' ? <button type="button" className="nm" onClick={() => onOpen(m)}>{m.name}</button> : <span>{m.name}</span>}</div></td>
                <td className="c-email">{m.email}</td>
                <td><span className={'st ' + m.status}><i style={{ background: STATUS[m.status].color }} />{label(m.status)}</span></td>
                <td className="c-role">{ed
                  ? <Pick value={editing!.role} options={roles} label={`Role of ${m.name}`} autoFocus onChange={r => setEditing({ id: m.id, role: r })} />
                  : m.role}</td>
                <td className="c-last num">{ago(m.lastActive)}</td>
                <td><div className="acts">
                  {ed ? (
                    <>
                      <button type="button" className="act save" onClick={() => { setRole([m.id], editing!.role); setEditing(null); }}>Save</button>
                      <button type="button" className="act" onClick={() => setEditing(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="act" onClick={() => setEditing({ id: m.id, role: m.role })} aria-label={`Edit ${m.name}`}><Icon d={I.edit} /><span>Edit</span></button>
                      <button type="button" className="act del" onClick={() => remove([m.id])} aria-label={`Remove ${m.name}`}><Icon d={I.trash} /><span>Delete</span></button>
                    </>
                  )}
                </div></td>
              </tr>
            );
          })}
          {!pageRows.length && !adding && (
            <tr className="empty"><td colSpan={7}>{loading ? 'Loading…' : <>No one matches {query ? <>"{query}"</> : 'this filter'}.{' '}
              <button type="button" style={{ color: 'var(--acc)' }} onClick={() => { setQuery(''); setFilter('all'); }}>Clear search</button></>}</td></tr>
          )}
        </tbody>
      </table>

      <div className="foot">
        <div className="per">Show
          <Pick value={per} options={[5, 8, 10, 20]} label="Rows per page" up onChange={n => { setPer(n); setPage(1); }} />
          per page · <span className="num">{shown.length ? `${(cur - 1) * per + 1}–${Math.min(cur * per, shown.length)} of ${shown.length}` : '0'}</span>
        </div>
        <nav className="pages" aria-label="Pages">
          <button type="button" disabled={cur === 1} onClick={() => setPage(cur - 1)} aria-label="Previous page"><Icon d={I.left} /></button>
          {pageList().map((p, i) => p === '…'
            ? <span key={'g' + i} className="gap">…</span>
            : <button key={p} type="button" aria-current={p === cur ? 'page' : undefined} onClick={() => setPage(p)}>{p}</button>)}
          <button type="button" disabled={cur === pages} onClick={() => setPage(cur + 1)} aria-label="Next page"><Icon d={I.right} /></button>
        </nav>
      </div>
    </div>
  );
}
