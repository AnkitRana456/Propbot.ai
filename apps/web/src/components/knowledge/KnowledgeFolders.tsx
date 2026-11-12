import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ExternalLink, MoreHorizontal, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import type { KnowledgeSourceResponse } from '@propbot/shared';

/**
 * The chatbot's knowledge sources, in the "Glossy Folder Knowledge Base" design (from Cue): one glossy folder per
 * kind of source (documents, websites, Q&A, notes, properties), then a quiet sources table for the open folder with
 * sort, search and a row menu (open link, retrain, delete). Colours follow the app's theme tokens.
 */

type Kind = KnowledgeSourceResponse['type'];
const KINDS: { id: Kind; name: string; one: string }[] = [
  { id: 'file', name: 'Documents', one: 'document' },
  { id: 'url', name: 'Websites', one: 'page' },
  { id: 'qa', name: 'Q&A pairs', one: 'Q&A set' },
  { id: 'text', name: 'Text notes', one: 'note' },
  { id: 'property', name: 'Properties', one: 'property' },
];
const STATUS: Record<KnowledgeSourceResponse['status'], { label: string; color: string }> = {
  ready: { label: 'Ready', color: 'var(--success)' },
  processing: { label: 'Training', color: 'var(--warning)' },
  queued: { label: 'Queued', color: 'var(--accent)' },
  failed: { label: 'Failed', color: 'var(--danger)' },
};
const fmtBytes = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`);
const fmtDate = (d?: string | Date | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never');

/* glossy blue folder: back, two papers that peek out on hover, see-through front with a light sweep and a bright rim */
function BigFolder({ files }: { files: number }) {
  const id = `kbf${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg width="100%" viewBox="0 0 196 160" aria-hidden style={{ height: 'auto', maxWidth: 168, display: 'block', margin: '0 auto 10px', overflow: 'visible' }}>
      <defs>
        <clipPath id={`${id}c`}><rect x="0" y="0" width="196" height="160" /></clipPath>
        <clipPath id={`${id}k`}><path d="M14 52a10 10 0 0 1 10-10h56l12 12h80a10 10 0 0 1 10 10v74a12 12 0 0 1-12 12H26a12 12 0 0 1-12-12z" /></clipPath>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7cc0f7" /><stop offset="1" stopColor="#3a8ae0" /></linearGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b3dcfd" /><stop offset=".18" stopColor="#86c5f9" /><stop offset=".6" stopColor="#5aa6ef" /><stop offset="1" stopColor="#3c8de2" /></linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".38" /><stop offset=".45" stopColor="#fff" stopOpacity=".08" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <linearGradient id={`${id}e`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f5fa8" stopOpacity="0" /><stop offset="1" stopColor="#1f5fa8" stopOpacity=".28" /></linearGradient>
      </defs>
      <path d="M14 22a10 10 0 0 1 10-10h44a10 10 0 0 1 7.5 3.4L84 25h88a10 10 0 0 1 10 10v95H14z" fill={`url(#${id}b)`} />
      <path d="M24 13h44a9 9 0 0 1 6.8 3L83 26h89" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.4" />
      {files > 0 && (
        <g clipPath={`url(#${id}c)`}>
          <g className="paper p1"><rect x="36" y="24" width="74" height="96" rx="6" fill="#fff" stroke="#dfe8f2" /><path d="M48 44h40M48 54h48M48 64h32" stroke="#d6e1ec" strokeWidth="3" strokeLinecap="round" /></g>
          <g className="paper p2"><rect x="88" y="30" width="72" height="92" rx="6" fill="#f7fbff" stroke="#dfe8f2" /><rect x="100" y="44" width="32" height="14" rx="3" fill="#bfe0fb" /><path d="M100 68h44M100 78h36" stroke="#d6e1ec" strokeWidth="3" strokeLinecap="round" /></g>
        </g>
      )}
      <g className="front">
        <path d="M14 52a10 10 0 0 1 10-10h56l12 12h80a10 10 0 0 1 10 10v74a12 12 0 0 1-12 12H26a12 12 0 0 1-12-12z" fill={`url(#${id}f)`} fillOpacity=".95" />
        <g clipPath={`url(#${id}k)`}>
          <path d="M14 42h110L60 152H14z" fill={`url(#${id}s)`} />
          <rect x="14" y="112" width="168" height="40" fill={`url(#${id}e)`} />
        </g>
        <path d="M24.5 43.5h55l12 12h80.5a8.5 8.5 0 0 1 8.5 8.5" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M14.8 64v74a11 11 0 0 0 11 11" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.2" />
        <circle cx="30" cy="136" r="3.2" fill="#fff" fillOpacity=".7" />
      </g>
    </svg>
  );
}
const DocIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>
    <path d="M5 2.5h6.5L15.5 6.5V17a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5z" /><path d="M11.5 2.5v4h4" />
  </svg>
);

interface KnowledgeFoldersProps {
  sources: KnowledgeSourceResponse[];
  isLoading: boolean;
  onRetrain: (sourceId: string) => void;
  onDelete: (sourceId: string) => void;
  onAdd: () => void;
  retrainingId?: string | null;
}
type SortKey = 'title' | 'status' | 'chunks' | 'size' | 'trained';

export const KnowledgeFolders: React.FC<KnowledgeFoldersProps> = ({ sources, isLoading, onRetrain, onDelete, onAdd, retrainingId }) => {
  const [cur, setCur] = useState<Kind | 'all'>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'trained', dir: -1 });
  const [menu, setMenu] = useState<{ id: string; top: number; left: number; confirm: boolean } | null>(null);
  const rootRef = useRef<HTMLElement>(null), menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const off = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('pointerdown', off);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [menu]);

  const count = (k: Kind) => sources.filter(s => s.type === k).length;
  const folders = KINDS.filter(k => count(k.id) > 0);
  const curName = cur === 'all' ? 'All sources' : KINDS.find(k => k.id === cur)!.name;
  const query = q.trim().toLowerCase();
  const shown = useMemo(() => {
    const list = sources.filter(s => (cur === 'all' || s.type === cur) && (!query || s.title.toLowerCase().includes(query) || (s.sourceUrl ?? '').toLowerCase().includes(query)));
    const val = (s: KnowledgeSourceResponse) =>
      sort.k === 'title' ? s.title.toLowerCase() : sort.k === 'status' ? s.status : sort.k === 'chunks' ? s.chunkCount : sort.k === 'size' ? s.byteSize : new Date(s.lastTrainedAt ?? 0).getTime();
    return [...list].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * sort.dir);
  }, [sources, cur, query, sort]);
  const sortBy = (k: SortKey) => setSort(s => ({ k, dir: s.k === k ? ((-s.dir) as 1 | -1) : k === 'title' || k === 'status' ? 1 : -1 }));
  const head = (k: SortKey, label: string, cls = '') => (
    <button type="button" className={cls} onClick={() => sortBy(k)} aria-sort={sort.k === k ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
      {label}{sort.k === k && <span aria-hidden>{sort.dir > 0 ? '↑' : '↓'}</span>}
    </button>
  );
  const ms = menu ? sources.find(s => s.id === menu.id) : undefined;

  return (
    <section className="kbx" ref={rootRef} aria-label="Knowledge sources">
      <style>{CSS}</style>
      <div className="top">
        <nav className="crumb" aria-label="Folder">
          {cur !== 'all' && <><button type="button" onClick={() => setCur('all')}>All sources</button><span aria-hidden>/</span></>}
          <b>{curName}</b>
        </nav>
        <label className="search">
          <Search size={15} aria-hidden />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search sources" aria-label="Search sources" />
          {q && <button type="button" aria-label="Clear search" onClick={() => setQ('')}><X size={14} /></button>}
        </label>
        <button type="button" className="add" onClick={onAdd}><Plus size={15} />Add source</button>
      </div>

      {isLoading ? (
        <div className="empty"><RefreshCw size={22} className="spin" />Loading knowledge sources…</div>
      ) : sources.length === 0 ? (
        <div className="empty">
          <BigFolder files={0} />
          <b>No sources yet</b>
          <span>Add documents, website pages or Q&A pairs so your chatbot can answer from them.</span>
          <button type="button" className="add" onClick={onAdd}><Plus size={15} />Add your first source</button>
        </div>
      ) : (
        <>
          {cur === 'all' && !query && (
            <div className="grid">
              {folders.map(k => (
                <button key={k.id} type="button" className="fc" onClick={() => setCur(k.id)}>
                  <BigFolder files={count(k.id)} />
                  <b>{k.name}</b>
                  <span>{count(k.id)} {count(k.id) === 1 ? k.one : `${k.one}s`}</span>
                </button>
              ))}
              <button type="button" className="fc new" onClick={onAdd}><Plus size={20} />Add source</button>
            </div>
          )}

          <h3 className="h">{query ? `Results for “${q.trim()}”` : cur === 'all' ? 'All sources' : 'Sources'} <small>{shown.length}</small></h3>
          <div className="table" role="table">
            <div className="tr hd" role="row">
              {head('title', 'Name')}
              {head('status', 'Status', 'c-st')}
              {head('chunks', 'Chunks', 'c-num')}
              {head('size', 'Size', 'c-size')}
              {head('trained', 'Last trained', 'c-date')}
              <span />
            </div>
            {shown.length === 0 && <div className="none">{query ? 'Nothing matches that search.' : 'No sources in this folder.'}</div>}
            {shown.map(s => {
              const st = STATUS[s.status], busy = retrainingId === s.id || s.status === 'processing';
              return (
                <div key={s.id} className="tr row" role="row">
                  <div className="nm">
                    <DocIcon />
                    <span>
                      <b title={s.title}>{s.title}</b>
                      {(s.sourceUrl || s.errorMessage || cur === 'all') && (
                        <small className={s.errorMessage ? 'err' : undefined} title={s.errorMessage ?? s.sourceUrl ?? undefined}>
                          {s.errorMessage ?? s.sourceUrl ?? KINDS.find(k => k.id === s.type)?.name}
                        </small>
                      )}
                    </span>
                  </div>
                  <span className="st c-st" style={{ '--c': st.color } as React.CSSProperties}><i className={busy ? 'pulse' : undefined} />{busy && s.status === 'ready' ? 'Retraining' : st.label}</span>
                  <span className="mut c-num">{s.chunkCount}</span>
                  <span className="mut c-size">{fmtBytes(s.byteSize)}</span>
                  <span className="mut c-date">{fmtDate(s.lastTrainedAt)}</span>
                  <button
                    type="button"
                    className="ib"
                    aria-label={`Actions for ${s.title}`}
                    onClick={e => {
                      const r = e.currentTarget.getBoundingClientRect(), o = rootRef.current!.getBoundingClientRect();
                      setMenu(menu?.id === s.id ? null : { id: s.id, top: r.bottom - o.top + 4, left: r.right - o.left - 180, confirm: false });
                    }}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {menu && ms && (
        <div className="menu" ref={menuRef} role="menu" style={{ top: menu.top, left: Math.max(8, menu.left) }}>
          {ms.sourceUrl && <a role="menuitem" href={ms.sourceUrl} target="_blank" rel="noreferrer" onClick={() => setMenu(null)}><ExternalLink size={14} />Open link</a>}
          <button type="button" role="menuitem" disabled={retrainingId === ms.id} onClick={() => { onRetrain(ms.id); setMenu(null); }}><RefreshCw size={14} />Retrain</button>
          {menu.confirm ? (
            <button type="button" role="menuitem" className="danger" onClick={() => { onDelete(ms.id); setMenu(null); }}><Trash2 size={14} />Yes, delete for good</button>
          ) : (
            <button type="button" role="menuitem" className="danger" onClick={() => setMenu({ ...menu, confirm: true })}><Trash2 size={14} />Delete…</button>
          )}
        </div>
      )}
    </section>
  );
};

const CSS = `
.kbx { position: relative; border-radius: 16px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); font-size: 13.5px; overflow: hidden; }
.kbx *, .kbx *::before, .kbx *::after { box-sizing: border-box; }
.kbx button, .kbx input { font: inherit; color: inherit; }
.kbx button { background: none; border: 0; padding: 0; cursor: pointer; }
.kbx :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.kbx .top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 14px; background: var(--surface); border-bottom: 1px solid var(--border); }
.kbx .crumb { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 120px; font-size: 15px; white-space: nowrap; }
.kbx .crumb button { padding: 3px 6px; border-radius: 7px; color: var(--text-muted); }
.kbx .crumb button:hover { background: var(--surface-2); color: var(--text); }
.kbx .crumb > span { color: var(--text-faint); }
.kbx .crumb b { font-weight: 600; letter-spacing: -.01em; }
.kbx .search { display: flex; align-items: center; gap: 8px; height: 34px; width: 210px; max-width: 100%; padding: 0 10px; border-radius: 9px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); }
.kbx .search:focus-within { border-color: var(--accent); }
.kbx .search input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font-size: 13px; color: var(--text); }
.kbx .search input::placeholder { color: var(--text-faint); }
.kbx .add { height: 34px; padding: 0 12px; border-radius: 9px; display: inline-flex; align-items: center; gap: 6px; background: var(--accent) !important; color: var(--on-accent, #fff) !important; font-size: 13px; font-weight: 600; white-space: nowrap; }
.kbx .add:hover { filter: brightness(1.08); }
.kbx .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; padding: 16px 14px 4px; }
.kbx .fc { min-width: 0; border-radius: 16px; padding: 16px 10px 14px; text-align: center; transition: background .2s; }
.kbx .fc:hover, .kbx .fc:focus-visible { background: var(--surface-3, var(--surface)); }
.kbx .fc b { display: block; font-size: 14.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kbx .fc > span { font-size: 12.5px; color: var(--text-muted); }
.kbx .fc .paper, .kbx .fc .front { transition: transform .35s cubic-bezier(.2,.8,.2,1); }
.kbx .fc .front { transform-origin: 50% 100%; }
.kbx .fc:hover .paper.p1 { transform: translate(-6px,-12px) rotate(-6deg); }
.kbx .fc:hover .paper.p2 { transform: translate(8px,-16px) rotate(5deg); }
.kbx .fc:hover .front { transform: perspective(500px) rotateX(-12deg); }
.kbx .fc.new { border: 1.5px dashed var(--border); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 170px; color: var(--text-muted); font-weight: 500; }
.kbx .fc.new:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
.kbx .h { display: flex; align-items: center; gap: 8px; margin: 14px 16px 10px; font-size: 15px; font-weight: 600; }
.kbx .h small { font-size: 12px; font-weight: 500; color: var(--text-muted); padding: 1px 7px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border); }
.kbx .table { margin: 0 14px 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); overflow: hidden; }
.kbx .tr { display: grid; grid-template-columns: minmax(0, 1fr) 82px 50px 58px 92px 30px; align-items: center; gap: 8px; padding: 0 10px 0 14px; min-height: 54px; border-top: 1px solid var(--border-subtle, var(--border)); }
.kbx .tr:first-child { border-top: 0; }
.kbx .tr.hd { min-height: 40px; background: var(--surface-2); font-size: 12px; }
.kbx .tr.hd button { display: inline-flex; align-items: center; gap: 4px; color: var(--text-muted); font-weight: 500; text-align: left; }
.kbx .tr.hd button:hover { color: var(--text); }
.kbx .tr.row:hover { background: color-mix(in srgb, var(--surface-2) 55%, transparent); }
.kbx .nm { display: flex; align-items: center; gap: 10px; min-width: 0; color: var(--text-muted); }
.kbx .nm > span { min-width: 0; display: grid; }
.kbx .nm b { font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kbx .nm small { font-size: 11.5px; color: var(--text-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kbx .nm small.err { color: var(--danger); }
.kbx .st { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; white-space: nowrap; }
.kbx .st i { width: 7px; height: 7px; border-radius: 50%; background: var(--c); flex: none; }
.kbx .st i.pulse { animation: kbx-pulse 1.2s ease-in-out infinite; }
@keyframes kbx-pulse { 50% { opacity: .3; transform: scale(.7); } }
.kbx .mut { font-size: 12.5px; color: var(--text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.kbx .ib { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; color: var(--text-muted); }
.kbx .ib:hover { background: var(--surface-2); color: var(--text); }
.kbx .none, .kbx .empty { padding: 32px 20px; text-align: center; color: var(--text-muted); font-size: 13px; }
.kbx .empty { display: grid; justify-items: center; gap: 6px; padding: 36px 20px 40px; }
.kbx .empty b { font-size: 15px; color: var(--text); }
.kbx .empty span { max-width: 320px; margin-bottom: 8px; }
.kbx .spin { animation: kbx-spin 1s linear infinite; color: var(--accent); }
@keyframes kbx-spin { to { transform: rotate(360deg); } }
.kbx .menu { position: absolute; z-index: 30; width: 180px; padding: 4px; border-radius: 11px; background: var(--surface); border: 1px solid var(--border); box-shadow: 0 18px 40px -18px rgba(0,0,0,.4); display: flex; flex-direction: column; animation: kbx-pop .14s ease-out; }
@keyframes kbx-pop { from { opacity: 0; transform: translateY(-4px); } }
.kbx .menu > * { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 8px; font-size: 13px; text-align: left; color: var(--text); text-decoration: none; }
.kbx .menu > *:hover { background: var(--surface-2); }
.kbx .menu > *:disabled { opacity: .5; cursor: default; }
.kbx .menu .danger { color: var(--danger); }
@media (max-width: 640px) { .kbx .tr { grid-template-columns: minmax(0, 1fr) 90px 32px; } .kbx .c-num, .kbx .c-size, .kbx .c-date { display: none; } .kbx .search { width: 100%; order: 3; } .kbx .grid { grid-template-columns: repeat(2, 1fr); } }
@media (prefers-reduced-motion: reduce) { .kbx * { animation: none !important; transition: none !important; } }
`;
