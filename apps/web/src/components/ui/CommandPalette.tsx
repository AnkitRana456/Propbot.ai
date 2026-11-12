import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDown, ArrowUp, BarChart3, Bot, Building, Calendar, CheckSquare, CornerDownLeft, History, Inbox, LayoutDashboard,
  LifeBuoy, MessageSquare, Moon, Plus, Search, Settings, Sparkles, User, Users, X, Zap,
} from 'lucide-react';
import type { LeadItemResponse } from '@propbot/shared';
import { useLeads } from '../../services/leads.service.js';
import { statusInfo } from './StatusBadge.js';
import { useTheme } from '../../contexts/ThemeContext.js';
import { LeadDetailDrawer } from '../leads/LeadDetailDrawer.js';

/**
 * Ctrl/⌘ K command palette, in the "CommandPalette" design (from Cue): a soft shell round a card, a search bar,
 * "Jump back in" (your recent commands), "Shortcuts" (every other command, with its keys as caps), and while you
 * type, "Leads" from your CRM (a click opens the lead). ↑↓ move, ↵ opens, Esc clears then closes.
 * With `shortcuts`, letter pairs work while the palette is closed (G then L for Leads…), never while typing in a field.
 */

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  /** Listen for the G-then-letter shortcuts while closed (mount it once, in the top bar). */
  shortcuts?: boolean;
}

type Cmd = { id: string; t: string; ic: React.ReactNode; keys: string[]; seq?: string; kw?: string; path?: string; run?: () => void };
type Row = { kind: 'cmd'; cmd: Cmd } | { kind: 'lead'; lead: LeadItemResponse };

const RECENT_KEY = 'propbot_palette_recent';
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const capText = (k: string) => (k === 'mod' ? (isMac ? '⌘' : 'Ctrl') : k === 'shift' ? '⇧' : k);
const readRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]; } catch { return []; } };

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  return i < 0 ? text : <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, shortcuts = false }) => {
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [ran, setRan] = useState<string | null>(null);
  const [down, setDown] = useState<string | null>(null);
  const [lead, setLead] = useState<LeadItemResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null), listRef = useRef<HTMLDivElement>(null), cmdRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef<{ keys: string; t: number }>({ keys: '', t: 0 });

  const commands: Cmd[] = useMemo(() => [
    { id: 'dashboard', t: 'Go to overview', ic: <LayoutDashboard size={15} />, keys: ['G', 'D'], seq: 'g d', kw: 'home dashboard today stats', path: '/dashboard' },
    { id: 'leads', t: 'Open leads', ic: <Users size={15} />, keys: ['G', 'L'], seq: 'g l', kw: 'crm buyers pipeline enquiries', path: '/leads' },
    { id: 'inbox', t: 'Open the inbox', ic: <Inbox size={15} />, keys: ['G', 'I'], seq: 'g i', kw: 'conversations chats messages', path: '/inbox' },
    { id: 'visits', t: 'Site visits & appointments', ic: <Calendar size={15} />, keys: ['G', 'A'], seq: 'g a', kw: 'calendar booking schedule', path: '/appointments' },
    { id: 'tasks', t: 'My tasks', ic: <CheckSquare size={15} />, keys: ['G', 'T'], seq: 'g t', kw: 'todo follow up reminders', path: '/tasks' },
    { id: 'properties', t: 'Property inventory', ic: <Building size={15} />, keys: ['G', 'P'], seq: 'g p', kw: 'projects units listings', path: '/properties' },
    { id: 'chatbots', t: 'Chatbots', ic: <Bot size={15} />, keys: ['G', 'C'], seq: 'g c', kw: 'bots ai agent training', path: '/chatbots' },
    { id: 'whatsapp', t: 'WhatsApp bot', ic: <MessageSquare size={15} />, keys: ['G', 'W'], seq: 'g w', kw: 'whatsapp messages templates', path: '/whatsapp' },
    { id: 'analytics', t: 'Analytics', ic: <BarChart3 size={15} />, keys: ['G', 'R'], seq: 'g r', kw: 'reports charts conversion', path: '/analytics' },
    { id: 'new-bot', t: 'Create a new chatbot', ic: <Plus size={15} />, keys: ['N', 'B'], seq: 'n b', kw: 'new create bot assistant', path: '/chatbots/new' },
    { id: 'assistant', t: 'Ask the AI assistant', ic: <Sparkles size={15} />, keys: ['mod', 'J'], kw: 'ai ask pipeline question copilot', run: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true })) },
    { id: 'theme', t: 'Switch light / dark theme', ic: <Moon size={15} />, keys: ['T', 'T'], seq: 't t', kw: 'dark light mode appearance', run: toggleTheme },
    { id: 'settings', t: 'Workspace settings', ic: <Settings size={15} />, keys: ['G', 'S'], seq: 'g s', kw: 'preferences account api keys mcp', path: '/settings' },
    { id: 'help', t: 'Get help', ic: <LifeBuoy size={15} />, keys: ['G', 'H'], seq: 'g h', kw: 'support docs contact', path: '/help' },
  ], [toggleTheme]);

  // leads from the CRM while typing (2+ characters)
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 200); return () => clearTimeout(t); }, [q]);
  // shortcut: useLeads has no `enabled`, so an empty query searches a word that matches nothing (one tiny request)
  const leadsQ = useLeads({ search: debounced.length >= 2 ? debounced : '__none__', limit: 5 });
  const leads = debounced.length >= 2 && q.trim().length >= 2 ? leadsQ.data?.items ?? [] : [];

  const query = q.trim().toLowerCase();
  const match = (c: Cmd) => `${c.t} ${c.kw ?? ''}`.toLowerCase().includes(query);
  const recentCmds = recent.map(id => commands.find(c => c.id === id)).filter((c): c is Cmd => Boolean(c)).slice(0, 4);
  const sections: { label: string; icon: React.ReactNode; rows: Row[] }[] = query
    ? [
        { label: 'Commands', icon: <Zap size={12} />, rows: commands.filter(match).map(cmd => ({ kind: 'cmd' as const, cmd })) },
        { label: 'Leads', icon: <User size={12} />, rows: leads.map(l => ({ kind: 'lead' as const, lead: l })) },
      ]
    : [
        { label: 'Jump back in', icon: <History size={12} />, rows: recentCmds.map(cmd => ({ kind: 'cmd' as const, cmd })) },
        { label: 'Shortcuts', icon: <Zap size={12} />, rows: commands.filter(c => !recentCmds.includes(c)).map(cmd => ({ kind: 'cmd' as const, cmd })) },
      ];
  const shown = sections.filter(s => s.rows.length);
  const flat = shown.flatMap(s => s.rows);
  const idx = Math.min(active, Math.max(0, flat.length - 1));

  useEffect(() => { setActive(0); }, [q]);
  // the palette lives in the top bar on every page, so a lead it opened closes when the page changes
  const { pathname } = useLocation();
  useEffect(() => { setLead(null); }, [pathname]);
  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [isOpen]);
  useEffect(() => { listRef.current?.querySelector<HTMLElement>('.item.on')?.scrollIntoView({ block: 'nearest' }); }, [idx]);

  const reset = () => { setQ(''); setActive(0); };
  const close = () => { reset(); onClose(); };
  const remember = (id: string) => setRecent(r => {
    const next = [id, ...r.filter(x => x !== id)].slice(0, 4);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    return next;
  });
  const runCmd = (cmd: Cmd, viaKey = false) => {
    setRan(cmd.id);
    remember(cmd.id);
    setTimeout(() => {
      setRan(null);
      if (isOpen) close();
      if (cmd.path) navigate(cmd.path);
      cmd.run?.();
    }, viaKey ? 0 : 160);
  };
  const runRow = (row: Row) => {
    if (row.kind === 'cmd') runCmd(row.cmd);
    else { close(); setLead(row.lead); }
  };
  const press = (k: string) => { setDown(k); setTimeout(() => setDown(d => (d === k ? null : d)), 140); };

  // keys while open: arrows, Enter, Esc; a press outside closes
  useEffect(() => {
    if (!isOpen) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        press(e.key);
        if (flat.length) setActive(a => (Math.min(a, flat.length - 1) + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        press('Enter');
        const row = flat[idx];
        if (row) runRow(row);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (q) reset(); else close();
      }
    };
    const off = (e: PointerEvent) => { if (!cmdRef.current?.contains(e.target as Node)) close(); };
    window.addEventListener('keydown', key);
    document.addEventListener('pointerdown', off);
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('pointerdown', off); };
  });

  // letter pairs while closed (within 900ms), never while typing in a field
  useEffect(() => {
    if (!shortcuts || isOpen) return;
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const now = Date.now(), s = seqRef.current;
      const keys = `${now - s.t < 900 ? s.keys : ''}${e.key.toLowerCase()}`;
      const hit = commands.find(c => c.seq?.replace(/ /g, '') === keys);
      const starts = commands.some(c => c.seq?.replace(/ /g, '').startsWith(keys) && c.seq.replace(/ /g, '') !== keys);
      seqRef.current = hit || !starts ? { keys: '', t: 0 } : { keys, t: now };
      if (hit) { e.preventDefault(); runCmd(hit, true); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  let i = -1;
  return createPortal(
    <>
      <div className={`cp${isOpen ? ' open' : ''}`} aria-hidden={!isOpen}>
        <style>{CSS}</style>
        <div className="cp-scrim" />
        {isOpen && (
          <div ref={cmdRef} className="cmd" role="dialog" aria-label="Command palette">
            <div className="card">
              <label className={`search${q ? ' has' : ''}`}>
                <Search size={16} aria-hidden />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search commands, pages or leads…"
                  role="combobox"
                  aria-expanded
                  aria-controls="cp-list"
                  aria-activedescendant={flat.length ? `cp-row-${idx}` : undefined}
                  autoComplete="off"
                />
                <button type="button" className="clear" aria-label="Clear search" onClick={() => { reset(); inputRef.current?.focus(); }}><X size={12} /></button>
              </label>
              <div className="list" id="cp-list" role="listbox" ref={listRef} onMouseDown={e => e.preventDefault()}>
                {shown.length === 0 ? (
                  <div className="empty">Nothing matches <b>“{q.trim()}”</b>.<br />Try a different word, or press Esc to clear.</div>
                ) : shown.map(s => (
                  <React.Fragment key={s.label}>
                    <div className="sec">{s.icon}{s.label}</div>
                    {s.rows.map(row => {
                      i += 1;
                      const me = i;
                      const key = row.kind === 'cmd' ? row.cmd.id : row.lead.id;
                      return (
                        <button
                          key={key}
                          id={`cp-row-${me}`}
                          type="button"
                          role="option"
                          aria-selected={me === idx}
                          className={`item${me === idx ? ' on' : ''}${row.kind === 'cmd' && ran === row.cmd.id ? ' ran' : ''}`}
                          onMouseMove={() => { if (me !== idx) setActive(me); }}
                          onClick={() => runRow(row)}
                        >
                          {row.kind === 'cmd' ? (
                            <>
                              <span className="ic">{row.cmd.ic}</span>
                              <span className="lb">{highlight(row.cmd.t, q.trim())}</span>
                              <span className="caps">{row.cmd.keys.map((k, n) => <span key={n} className="cap">{capText(k)}</span>)}</span>
                            </>
                          ) : (
                            <>
                              <span className="ic"><User size={15} /></span>
                              <span className="lb">{highlight(row.lead.name, q.trim())}</span>
                              <span className="meta">{[row.lead.phone, statusInfo(row.lead.status).label].filter(Boolean).join(' · ')}</span>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className="foot">
              <div><span className={`key${down === 'ArrowDown' ? ' down' : ''}`}><ArrowDown size={11} /></span><span className={`key${down === 'ArrowUp' ? ' down' : ''}`}><ArrowUp size={11} /></span><span>Move</span></div>
              <div><span className={`key${down === 'Enter' ? ' down' : ''}`}><CornerDownLeft size={11} /></span><span>Open</span></div>
            </div>
          </div>
        )}
      </div>
      <LeadDetailDrawer lead={lead} isOpen={Boolean(lead)} onClose={() => setLead(null)} />
    </>,
    document.body,
  );
};

/* Cue's palette, with its shell, card and text colours taken from the app's theme tokens */
const CSS = `
.cp { position: fixed; inset: 0; z-index: 70; display: grid; justify-items: center; align-items: start; padding: max(70px, 14vh) 16px 24px; pointer-events: none; color: var(--text); -webkit-font-smoothing: antialiased; }
.cp.open { pointer-events: auto; }
.cp *, .cp *::before, .cp *::after { box-sizing: border-box; }
.cp button, .cp input { font: inherit; color: inherit; }
.cp-scrim { position: fixed; inset: 0; background: rgba(10, 14, 20, .35); opacity: 0; transition: opacity .18s; }
.cp.open .cp-scrim { opacity: 1; }
.cp .cmd { position: relative; width: min(600px, 100%); padding: 11px; border-radius: 22px; background: var(--surface-2); box-shadow: 0 0 0 1px var(--border), 0 1px 2px rgba(20,40,60,.06), 0 30px 70px -28px rgba(10,30,50,.5); animation: cp-in .22s cubic-bezier(.2,.9,.3,1.1); }
@keyframes cp-in { from { opacity: 0; transform: translateY(6px) scale(.97); } }
.cp .card { border-radius: 16px; background: var(--surface); box-shadow: 0 1px 2px rgba(0,0,0,.04); padding: 10px 0 8px; }
.cp .search { display: flex; align-items: center; gap: 9px; height: 36px; margin: 0 10px; padding: 0 12px; border-radius: 9px; background: var(--surface-2); color: var(--text-muted); }
.cp .search input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font-size: 13.5px; letter-spacing: -.005em; color: var(--text); }
.cp .search input::placeholder { color: var(--text-faint); }
.cp .search .clear { width: 20px; height: 20px; border: 0; border-radius: 6px; background: var(--surface-3, var(--border)); display: none; place-items: center; cursor: pointer; color: var(--text-muted); }
.cp .search.has .clear { display: grid; }
.cp .list { max-height: min(360px, 55vh); overflow: auto; padding-top: 14px; scrollbar-width: thin; }
.cp .sec { padding: 0 15px 6px; display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--text-faint); }
.cp .sec:not(:first-child) { margin-top: 18px; }
.cp .item { position: relative; display: flex; align-items: center; gap: 13px; width: 100%; height: 29px; margin: 2px 0; padding: 0 15px 0 17px; border: 0; background: none; text-align: left; cursor: pointer; font-size: 13.5px; letter-spacing: -.005em; color: var(--text); }
.cp .item.on { background: var(--surface-2); }
.cp .item.on::before { content: ''; position: absolute; left: 0; top: 5px; bottom: 5px; width: 2px; border-radius: 2px; background: var(--accent); }
.cp .item .ic { width: 16px; display: grid; place-items: center; color: var(--text-muted); flex: none; }
.cp .item.on .ic { color: var(--accent); }
.cp .item .lb { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cp .item .lb mark { background: none; color: var(--text); font-weight: 600; }
.cp .item .meta { font-size: 11.5px; color: var(--text-faint); margin-right: 4px; white-space: nowrap; }
.cp .item.ran { animation: cp-ran .5s ease-out; }
@keyframes cp-ran { 30% { background: var(--accent-soft); } }
.cp .caps { display: flex; gap: 3px; }
.cp .cap { min-width: 18px; height: 18px; padding: 0 4px; border-radius: 4px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--border), 0 1px 0 var(--border); display: grid; place-items: center; font-size: 9.5px; color: var(--text-muted); }
.cp .empty { padding: 26px 16px 30px; text-align: center; font-size: 13px; color: var(--text-faint); line-height: 1.6; }
.cp .empty b { color: var(--text); font-weight: 500; }
.cp .foot { display: flex; align-items: center; justify-content: space-between; padding: 12px 6px 1px; font-size: 11px; color: var(--text-muted); }
.cp .foot > div { display: flex; align-items: center; gap: 6px; }
.cp .key { width: 19px; height: 19px; border-radius: 5px; background: var(--surface); display: grid; place-items: center; box-shadow: 0 1px 1px rgba(0,0,0,.06), inset 0 0 0 1px var(--border); color: var(--text-muted); transition: transform .08s, background-color .08s; }
.cp .key.down { transform: translateY(1px); background: var(--surface-3, var(--surface-2)); }
.cp .foot span:last-child { margin-left: 4px; }
.cp .item:focus-visible, .cp .clear:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
@media (prefers-reduced-motion: reduce) { .cp, .cp *, .cp *::before, .cp *::after { transition: none !important; animation: none !important; } }
`;
