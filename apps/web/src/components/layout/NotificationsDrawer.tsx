import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { NotificationEntry } from '@propbot/shared';
import { useNotificationCentre } from '../../services/controls.service.js';
import { apiRequest } from '../../services/api-client.js';

/**
 * The bell's notifications drawer, in the "NotificationsDashboard" design (from Cue): it slides in from the right over
 * a dimmed page. A header with mark-all-read and newest/oldest, tabs by kind (All / Leads / Visits / Inbox / System)
 * with unread counts and a sliding underline, and rows with an unread dot, a two-tone line, the time and a priority
 * flag. Hovering a row shows Open and ⋯ (Open, Mark as read, Archive with Undo). A click opens what it is about and
 * marks it read. Reads go to POST /api/controls/notifications/read; archiving hides it in this browser.
 * Colours come from the app's theme tokens, so light and dark follow the app.
 */

type Tab = 'all' | 'leads' | 'visits' | 'inbox' | 'system';
type Pri = 'Low' | 'Moderate' | 'High' | 'Urgent';
const KIND: Record<string, { tab: Exclude<Tab, 'all'>; pri: Pri }> = {
  lead_hot: { tab: 'leads', pri: 'High' },
  lead_created: { tab: 'leads', pri: 'Low' },
  visit_booked: { tab: 'visits', pri: 'Moderate' },
  handoff_requested: { tab: 'inbox', pri: 'Urgent' },
  sla_breach: { tab: 'inbox', pri: 'Urgent' },
  call_completed: { tab: 'inbox', pri: 'Moderate' },
  payment_received: { tab: 'system', pri: 'Low' },
  payment_failed: { tab: 'system', pri: 'Urgent' },
  webhook_failed: { tab: 'system', pri: 'High' },
  credits_low: { tab: 'system', pri: 'High' },
};
const kindOf = (t: string) => KIND[t] ?? { tab: 'system' as const, pri: 'Low' as Pri };
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'leads', label: 'Leads' }, { id: 'visits', label: 'Visits' }, { id: 'inbox', label: 'Inbox' }, { id: 'system', label: 'System' },
];
const PRI: Record<Pri, string> = { Low: 'var(--success)', Moderate: 'var(--warning)', High: 'var(--danger)', Urgent: 'var(--danger)' };

/** "🔥 Hot lead" → icon "🔥", text "Hot lead" */
const splitIcon = (title: string) => { const m = /^(\p{Extended_Pictographic}️?)\s*(.*)$/u.exec(title); return m ? { icon: m[1]!, text: m[2]! } : { icon: '', text: title }; };
const dayOf = (iso: string) => { const d = new Date(iso), t = new Date(); const n = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 864e5); return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : 'Earlier'; };
const when = (iso: string) => {
  const d = new Date(iso), s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

const I = ({ d, s = 15, w = 1.4 }: { d: string; s?: number; w?: number }) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
const ic = {
  checks: 'M1.5 8.5l3 3 5.5-6.5M7.5 11.2l.3.3 5.5-6.5',
  sort: 'M3 4h7M3 8h5M3 12h3M12.5 3.5v9M10.5 10.5l2 2 2-2',
  x: 'M4 4l8 8M12 4l-8 8',
  open: 'M9 3h4v4M13 3 7.5 8.5M11 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2.5',
  more: 'M3.5 8h.01M8 8h.01M12.5 8h.01',
  read: 'M2.5 8.5l3 3 8-8',
  archive: 'M2.5 3h11v3h-11zM3.5 6v6.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V6M6.5 9h3',
  gear: 'M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6.9 2h2.2l.4 1.6 1.2.7 1.6-.5 1.1 1.9-1.2 1.1v1.4l1.2 1.1-1.1 1.9-1.6-.5-1.2.7-.4 1.6H6.9l-.4-1.6-1.2-.7-1.6.5-1.1-1.9 1.2-1.1V7.3L2.6 6.2l1.1-1.9 1.6.5 1.2-.7z',
};
const Flag = ({ c }: { c: string }) => <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden><path d="M3.5 14V2.5" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.4" strokeLinecap="round" /><path d="M4 2.8h8.6l-2.1 3.1 2.1 3.1H4z" fill={c} /></svg>;

interface NotificationsDrawerProps { open: boolean; onClose: () => void }

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useNotificationCentre();
  const [tab, setTab] = useState<Tab>('all');
  const [oldest, setOldest] = useState(false);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [archived, setArchived] = useState<string[]>([]); // hidden right away; the server list drops them on refetch
  const [readNow, setReadNow] = useState<string[]>([]); // read here, before the server's list catches up
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null), ulRef = useRef<HTMLSpanElement>(null), drRef = useRef<HTMLDivElement>(null), toastT = useRef(0);

  const all = useMemo(() => (data?.items ?? []).map(n => ({ ...n, isRead: n.isRead || readNow.includes(n.id) })), [data, readNow]);
  const live = all.filter(n => !archived.includes(n.id));
  const unread = (t: Tab) => live.filter(n => !n.isRead && (t === 'all' || kindOf(n.type).tab === t)).length;
  const live2 = (id: string) => !archived.includes(id);
  const shown = useMemo(() => { const l = all.filter(n => tab === 'all' || kindOf(n.type).tab === tab); return oldest ? l.slice().reverse() : l; }, [all, tab, oldest]);

  // the tab underline slides to the active tab
  useEffect(() => {
    const t = tabsRef.current?.querySelector<HTMLElement>(`[data-t="${tab}"]`), u = ulRef.current;
    if (!t || !u) return;
    u.style.width = `${t.offsetWidth}px`;
    u.style.transform = `translateX(${t.offsetLeft}px)`;
  });
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (menu) setMenu(null); else onClose(); } };
    const off = (e: MouseEvent) => { if (menu && !(e.target as HTMLElement).closest('.nd-pop,.nd-more')) setMenu(null); };
    document.addEventListener('keydown', esc);
    document.addEventListener('mousedown', off);
    return () => { document.removeEventListener('keydown', esc); document.removeEventListener('mousedown', off); };
  }, [open, menu, onClose]);
  useEffect(() => () => clearTimeout(toastT.current), []);
  // closed: keep it out of Tab order; open: hide the voice widget that would sit on the footer
  useEffect(() => {
    drRef.current?.toggleAttribute('inert', !open);
    document.body.classList.toggle('nd-open', open);
    return () => document.body.classList.remove('nd-open');
  }, [open]);

  const say = (text: string, undo?: () => void) => { clearTimeout(toastT.current); setToast({ text, undo }); toastT.current = window.setTimeout(() => setToast(null), 5000); };
  const markRead = (ids?: string[]) => {
    if (ids) setReadNow(r => [...r, ...ids]);
    void apiRequest('/api/controls/notifications/read', { method: 'POST', body: JSON.stringify(ids ? { ids } : {}) })
      .then(() => qc.invalidateQueries({ queryKey: ['controls', 'notifications'] }))
      .catch(() => say('Could not mark as read. Try again.'));
  };
  const setArchive = (ids: string[], archive: boolean) =>
    apiRequest('/api/controls/notifications/archive', { method: 'POST', body: JSON.stringify({ ids, archived: archive }) })
      .then(() => qc.invalidateQueries({ queryKey: ['controls', 'notifications'] }))
      .catch(() => { setArchived(a => (archive ? a.filter(x => !ids.includes(x)) : [...a, ...ids])); say('Could not update. Try again.'); });
  const openItem = (n: NotificationEntry) => {
    if (!n.isRead) markRead([n.id]);
    if (n.linkUrl) { onClose(); navigate(n.linkUrl); }
  };
  const openMenu = (id: string, btn: HTMLElement) => {
    const dr = drRef.current;
    if (!dr) return;
    const b = btn.getBoundingClientRect(), d = dr.getBoundingClientRect();
    const y = b.bottom - d.top + 6, flip = y + 100 > d.height;
    setMenu(menu?.id === id ? null : { id, x: Math.min(d.width - 136, b.right - d.left - 128), y: flip ? b.top - d.top - 96 : y });
  };
  const sel = all.find(n => n.id === menu?.id);
  const act = (kind: 'open' | 'read' | 'archive') => {
    if (!sel) return;
    setMenu(null);
    if (kind === 'open') openItem(sel);
    if (kind === 'read') { markRead([sel.id]); say('Marked as read'); }
    if (kind === 'archive') {
      const id = sel.id;
      setArchived(a => [...a, id]);
      void setArchive([id], true);
      say('Notification archived', () => { setArchived(a => a.filter(x => x !== id)); void setArchive([id], false); setToast(null); });
    }
  };
  const allRead = () => { if (!unread('all')) return; setReadNow(live.map(n => n.id)); markRead(); say('All marked as read'); };

  return createPortal(
    <div className={`nd${open ? ' open' : ''}`}>
      <style>{CSS}</style>
      <div className="nd-dim" onClick={onClose} aria-hidden />
      <div ref={drRef} className="nd-dr" role="dialog" aria-modal="true" aria-label="Notifications" aria-hidden={!open}>
        <div className="nd-hd">
          <h2>Notifications</h2>
          <button type="button" className="nd-ib" onClick={allRead} disabled={!unread('all')} aria-label="Mark all as read" title="Mark all as read"><I d={ic.checks} /></button>
          <button type="button" className="nd-ib" onClick={() => setOldest(o => !o)} aria-label={oldest ? 'Show newest first' : 'Show oldest first'} title={oldest ? 'Oldest first' : 'Newest first'}><I d={ic.sort} /></button>
          <button type="button" className="nd-ib" onClick={onClose} aria-label="Close notifications"><I d={ic.x} /></button>
        </div>
        <div ref={tabsRef} className="nd-tabs" role="tablist">
          {TABS.map(t => (
            <button type="button" key={t.id} data-t={t.id} role="tab" aria-selected={tab === t.id} className={`nd-tab${tab === t.id ? ' on' : ''}`} onClick={() => { setTab(t.id); setMenu(null); }}>
              {t.label}{unread(t.id) ? <span>{unread(t.id)}</span> : null}
            </button>
          ))}
          <span ref={ulRef} className="nd-ul" />
        </div>
        <div className="nd-list" onScroll={() => setMenu(null)}>
          {isLoading && <p className="nd-empty">Loading…</p>}
          {!isLoading && shown.filter(n => live2(n.id)).length === 0 && <p className="nd-empty">You’re all caught up.</p>}
          {shown.filter(n => live2(n.id)).map((n, i, arr) => {
            const k = kindOf(n.type), t = splitIcon(n.title), day = dayOf(n.createdAt), head = i === 0 || dayOf(arr[i - 1]!.createdAt) !== day;
            return (
              <React.Fragment key={n.id}>
                {head && <p className="nd-day">{day}</p>}
                <div className={`nd-row c-${k.tab}${n.isRead ? ' read' : ''}${menu?.id === n.id ? ' menu' : ''}`} onClick={() => openItem(n)}
                  role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') openItem(n); }}>
                  <span className="nd-pic" aria-hidden>{t.icon || '•'}{!n.isRead && <span className="ud" aria-label="Unread" />}</span>
                  <div className="nd-tx">
                    <p className="nd-l1"><b>{t.text}</b><time>{when(n.createdAt)}</time></p>
                    <p className="nd-msg">{n.message}</p>
                    <p className="nd-l2"><em className={`pri ${k.pri}`}><Flag c={PRI[k.pri]} />{k.pri}</em><em>{TABS.find(x => x.id === k.tab)?.label}</em></p>
                  </div>
                  <div className="nd-acts" onClick={e => e.stopPropagation()}>
                    {n.linkUrl && <button type="button" aria-label={`Open ${t.text}`} title="Open" onClick={() => openItem(n)}><I d={ic.open} s={13} /></button>}
                    <button type="button" className="nd-more" aria-label="More" aria-haspopup="menu" aria-expanded={menu?.id === n.id} onClick={e => openMenu(n.id, e.currentTarget)}><I d={ic.more} s={14} w={2.2} /></button>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
        {menu && sel && (
          <div className="nd-pop" role="menu" style={{ left: menu.x, top: menu.y }}>
            {sel.linkUrl && <button type="button" role="menuitem" onClick={() => act('open')}><I d={ic.open} s={13} />Open</button>}
            {!sel.isRead && <button type="button" role="menuitem" onClick={() => act('read')}><I d={ic.read} s={13} />Mark as read</button>}
            <button type="button" role="menuitem" onClick={() => act('archive')}><I d={ic.archive} s={13} />Archive</button>
          </div>
        )}
        <button type="button" className="nd-foot" onClick={() => { onClose(); navigate('/controls'); }}><I d={ic.gear} s={13} />Manage alerts</button>
        {toast && <div className="nd-toast" role="status">{toast.text}{toast.undo && <button type="button" onClick={toast.undo}>Undo</button>}</div>}
      </div>
    </div>,
    document.body,
  );
};

/* Cue's drawer, with its surfaces, lines and text taken from the app's theme tokens */
const CSS = `
.nd { --ink: var(--text); --txt: var(--text-muted); --mute: var(--text-faint); --line: var(--border); --hov: var(--surface-2); position: fixed; inset: 0; z-index: 65; pointer-events: none; font-size: 12px; line-height: 1.35; color: var(--ink); }
.nd.open { pointer-events: auto; }
.nd *, .nd *::before, .nd *::after { box-sizing: border-box; }
.nd button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; text-align: left; }
.nd p, .nd h2 { margin: 0; }
.nd svg { display: block; flex: none; }
.nd :focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.nd-dim { position: absolute; inset: 0; background: rgba(0,0,0,.22); opacity: 0; transition: opacity .35s; }
.nd.open .nd-dim { opacity: 1; }
.nd-dr { position: absolute; right: 0; top: 0; bottom: 0; width: min(420px, 100%); background: var(--surface); border-left: 1px solid var(--line); display: flex; flex-direction: column; transform: translateX(102%); transition: transform .4s cubic-bezier(.2,.8,.2,1); }
.nd.open .nd-dr { transform: none; }
.nd-hd { display: flex; align-items: center; gap: 2px; height: 52px; padding: 0 10px 0 16px; flex: none; }
.nd-hd h2 { font-size: 16px; font-weight: 600; letter-spacing: -.01em; margin-right: auto; }
.nd-ib { width: 28px; height: 28px; border-radius: 7px; display: grid; place-items: center; color: var(--txt); transition: background .15s, color .15s; }
.nd-ib:hover:not(:disabled) { background: var(--hov); color: var(--ink); }
.nd-ib:disabled { opacity: .35; cursor: default; }
.nd-tabs { position: relative; display: flex; gap: 16px; height: 38px; padding: 0 20px; border-bottom: 1px solid var(--line); flex: none; overflow-x: auto; scrollbar-width: none; }
.nd-tab { display: flex; align-items: center; gap: 5px; height: 100%; font-size: 13px; color: var(--txt); white-space: nowrap; transition: color .15s; }
.nd-tab:hover, .nd-tab.on { color: var(--ink); }
.nd-tab.on { font-weight: 500; }
.nd-tab span { min-width: 16px; height: 15px; padding: 0 4px; border-radius: 4px; background: var(--surface-2); color: var(--txt); font-size: 10px; display: grid; place-items: center; }
.nd-tab.on span { background: var(--accent-soft); color: var(--accent); }
.nd-ul { position: absolute; bottom: -1px; left: 0; height: 2px; background: var(--accent); border-radius: 2px; transition: transform .3s cubic-bezier(.2,.8,.2,1), width .3s cubic-bezier(.2,.8,.2,1); }
.nd-list { flex: 1; overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; }
.nd-day { padding: 12px 20px 6px; font-size: 10.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--mute); }
.nd-row { --tone: var(--accent); position: relative; display: flex; align-items: flex-start; gap: 12px; margin: 0 8px 2px; padding: 12px; border-radius: 12px; cursor: pointer; transition: background .15s; }
.nd-row.c-leads { --tone: var(--danger); } .nd-row.c-visits { --tone: var(--success); } .nd-row.c-inbox { --tone: var(--warning); } .nd-row.c-system { --tone: var(--text-muted); }
.nd-row:hover, .nd-row.menu { background: var(--hov); }
.nd-row:not(.read) { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.nd-row:not(.read):hover { background: color-mix(in srgb, var(--accent) 11%, transparent); }
.nd-pic { position: relative; width: 38px; height: 38px; border-radius: 12px; background: color-mix(in srgb, var(--tone) 14%, var(--surface-2)); flex: none; display: grid; place-items: center; font-size: 18px; }
.nd-pic .ud { position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; border-radius: 50%; background: var(--accent); border: 2px solid var(--surface); }
.nd-tx { flex: 1; min-width: 0; }
.nd-l1 { display: flex; align-items: baseline; gap: 8px; font-size: 13px; color: var(--ink); }
.nd-l1 b { font-weight: 600; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nd-row.read .nd-l1 b { font-weight: 500; color: var(--txt); }
.nd-l1 time { font-size: 11px; color: var(--mute); flex: none; }
.nd-msg { margin-top: 3px; font-size: 12.5px; line-height: 1.45; color: var(--txt); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
.nd-l2 { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
.nd-l2 em { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 8px; border-radius: 999px; background: var(--surface-2); font-style: normal; font-size: 10.5px; color: var(--txt); }
.nd-l2 em.pri.High, .nd-l2 em.pri.Urgent { background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger); }
.nd-acts { position: absolute; top: 8px; right: 8px; display: none; align-items: center; gap: 2px; padding: 2px; border-radius: 8px; background: var(--surface); border: 1px solid var(--line); box-shadow: 0 4px 12px -6px rgba(0,0,0,.35); }
.nd-row:hover .nd-acts, .nd-row.menu .nd-acts, .nd-row:focus-within .nd-acts { display: flex; }
.nd-acts button { width: 26px; height: 26px; border-radius: 6px; display: grid; place-items: center; color: var(--txt); }
.nd-acts button:hover { background: var(--hov); color: var(--ink); }
.nd-pop { position: absolute; width: 136px; padding: 4px; background: var(--surface); border: 1px solid var(--line); border-radius: 9px; z-index: 9; box-shadow: 0 14px 30px -16px rgba(0,0,0,.4); animation: nd-pop .16s cubic-bezier(.2,.8,.2,1); }
@keyframes nd-pop { from { opacity: 0; transform: translateY(-4px) scale(.98); } }
.nd-pop button { display: flex; align-items: center; gap: 8px; width: 100%; height: 28px; padding: 0 8px; border-radius: 6px; font-size: 12px; }
.nd-pop button:hover, .nd-pop button:focus-visible { background: var(--hov); outline: none; }
.nd-empty { padding: 48px 16px; text-align: center; color: var(--mute); font-size: 12.5px; }
.nd-foot { display: flex; align-items: center; justify-content: center; gap: 7px; height: 40px; border-top: 1px solid var(--line); color: var(--txt); font-size: 12px; flex: none; width: 100%; text-align: center !important; }
.nd-foot:hover { color: var(--ink); background: var(--hov); }
.nd-toast { position: absolute; left: 50%; bottom: 52px; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; height: 34px; padding: 0 8px 0 12px; border-radius: 8px; background: var(--text); color: var(--surface); font-size: 12px; white-space: nowrap; z-index: 10; animation: nd-up .25s cubic-bezier(.2,.8,.2,1); }
.nd-toast button { height: 24px; padding: 0 8px; border-radius: 5px; color: var(--accent); font-weight: 600; }
@keyframes nd-up { from { opacity: 0; transform: translate(-50%, 8px); } }
body.nd-open elevenlabs-convai { display: none !important; }
@media (prefers-reduced-motion: reduce) { .nd * { animation: none !important; transition: none !important; } }
`;
