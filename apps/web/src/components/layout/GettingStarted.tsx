import React, { useCallback, useEffect, useRef, useState, type KeyboardEvent as RKE, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { NAVIGATION_ITEMS, isNavVisible } from '../../config/navigation.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { useChatbots } from '../../services/chatbots.service.js';
import { useProjects } from '../../services/inventory.service.js';
import { useConnections } from '../../services/omnichannel.service.js';
import { useLeads } from '../../services/leads.service.js';
import { useUsersList, useUserInvitations } from '../../services/users.service.js';

/**
 * The sidebar's "Getting started" card (from Cue's OnboardingChecklist): a progress ring, a percentage and the setup
 * tasks. Hover or focus a task and a dark preview card opens beside the sidebar with a small illustration, a line of
 * help and "Start task", which takes you to the page where it is done. A task ticks itself off when the real data
 * exists (a chatbot, a property, a channel, a lead, a teammate), so the ring never lies. Esc closes the preview and
 * ↑ ↓ move between tasks. Finished tasks leave the list ("View all tasks" brings them back); at 100% the card says
 * so and can be hidden for good. Colours come from the app's theme tokens.
 */
type Key = 'chatbot' | 'property' | 'channel' | 'lead' | 'team';
interface Task { key: Key; path: string; label: string; title: string; text: string }
const TASKS: Task[] = [
  { key: 'chatbot', path: '/chatbots', label: 'Create your chatbot', title: 'Create your chatbot', text: 'Name it, pick a language and train it on your project details. It answers buyers on your website around the clock.' },
  { key: 'property', path: '/properties', label: 'Add your first property', title: 'Add a property', text: 'List a project with its units and prices so the bot quotes real inventory instead of guessing.' },
  { key: 'channel', path: '/channels', label: 'Connect a channel', title: 'Connect a channel', text: 'Hook up WhatsApp, your website widget or a lead source so every enquiry lands in one inbox.' },
  { key: 'lead', path: '/leads', label: 'Capture your first lead', title: 'Capture a lead', text: 'Add one by hand, import a CSV or let the chatbot bring one in. The pipeline fills from here.' },
  { key: 'team', path: '/users', label: 'Invite a teammate', title: 'Invite a teammate', text: 'Add an agent or manager so leads get assigned and followed up while you are away.' },
];
const HIDE_KEY = 'propbot_getting_started_hidden';

const Dots = () => (
  <span className="gs-dot" aria-hidden>
    {Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return <i key={i} style={{ transform: `translate(${Math.cos(a) * 6.4}px,${Math.sin(a) * 6.4}px)`, opacity: 0.35 + (i / 8) * 0.65 }} />; })}
  </span>
);
const Tick = () => <span className="gs-tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>;

// one small illustration per task, drawn as UI over the accent gradient
function Art({ k }: { k: Key }) {
  let m: ReactNode;
  if (k === 'chatbot') m = <><div className="gs-b them">Hi! Looking for a 3 BHK in Whitefield?</div><div className="gs-b me">Yes, under ₹1.5 Cr</div><div className="gs-b them">Found 4 homes. Want to see them on a site visit?</div></>;
  else if (k === 'property') m = <><b>Prestige Lakeside</b><div className="gs-row"><span>2 BHK · 1,150 sq ft</span><em>₹92 L</em></div><div className="gs-row"><span>3 BHK · 1,640 sq ft</span><em>₹1.38 Cr</em></div><div className="gs-row"><span>3 BHK + study</span><em>₹1.62 Cr</em></div></>;
  else if (k === 'channel') m = <><div className="gs-row"><span>WhatsApp Business</span><em className="on">Connected</em></div><div className="gs-row"><span>Website widget</span><em className="on">Live</em></div><div className="gs-row"><span>99acres leads</span><em>Connect</em></div></>;
  else if (k === 'lead') m = <><div className="gs-row"><span><b>Mohit Rana</b><br />3 BHK · Whitefield</span><em className="hot">Hot</em></div><div className="gs-bars">{[30, 44, 40, 58, 66, 80, 94].map((h, i) => <i key={i} className={i === 6 ? 'hi' : ''} style={{ height: `${h}%` }} />)}</div><div style={{ color: '#6b7280' }}>Intent score rising</div></>;
  else m = <><div className="gs-row"><span>agent@yourteam.com</span><em>Agent</em></div><div className="gs-seg"><span>Admin</span><span>Manager</span><span className="on">Agent</span><span>Viewer</span></div><div style={{ color: '#6b7280', marginTop: 8 }}>They get an email to join your workspace.</div></>;
  return <div className="gs-art"><div className="gs-mock">{m}</div></div>;
}

/** Shown only for a company workspace; hides itself once dismissed at 100%. */
export const GettingStarted: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role || 'company_admin';
  const tasks = TASKS.filter(t => { const item = NAVIGATION_ITEMS.find(n => n.path === t.path); return !item || isNavVisible(role, item); });
  const bots = useChatbots(), props = useProjects({ limit: 1 }), conns = useConnections(), leads = useLeads({ limit: 1 }), users = useUsersList({ limit: 2 }), invites = useUserInvitations();
  const doneMap: Record<Key, boolean> = {
    chatbot: (bots.data?.total ?? 0) > 0,
    property: (props.data?.total ?? 0) > 0,
    channel: (conns.data?.length ?? 0) > 0,
    lead: (leads.data?.total ?? 0) > 0,
    team: (users.data?.pagination?.total ?? 0) > 1 || (invites.data?.length ?? 0) > 0,
  };
  const loading = [bots, props, conns, leads, users, invites].some(q => q.isLoading);
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } });
  const [hover, setHover] = useState<Key | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const cardRef = useRef<HTMLElement>(null), pvRef = useRef<HTMLDivElement>(null), leaveT = useRef(0);
  const [shown, setShown] = useState(0);

  const doneCount = tasks.filter(t => doneMap[t.key]).length;
  const pct = tasks.length ? Math.round((100 * doneCount) / tasks.length) : 100;
  useEffect(() => {
    let raf = 0; const from = shown, t0 = performance.now();
    const step = (now: number) => { const k = Math.min(1, (now - t0) / 600); setShown(Math.round(from + (pct - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [pct]);

  // the preview sits beside the sidebar, bottom-aligned with the card
  const place = useCallback(() => {
    const card = cardRef.current, pv = pvRef.current; if (!card) return;
    const c = card.getBoundingClientRect(), side = card.closest('aside')?.getBoundingClientRect();
    const h = pv?.offsetHeight || 380;
    setPos({ top: Math.max(12, c.bottom - h), left: (side?.right ?? c.right) + 10 });
  }, []);
  useEffect(() => { if (hover) requestAnimationFrame(place); }, [hover, place]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setHover(null); };
    window.addEventListener('keydown', k); window.addEventListener('resize', place);
    return () => { window.removeEventListener('keydown', k); window.removeEventListener('resize', place); window.clearTimeout(leaveT.current); };
  }, [place]);

  if (hidden || loading || !tasks.length) return null;
  const open = (k: Key) => { window.clearTimeout(leaveT.current); setHover(k); };
  const close = () => { window.clearTimeout(leaveT.current); leaveT.current = window.setTimeout(() => setHover(null), 160); };
  const start = (t: Task) => { setHover(null); navigate(t.path); };
  const hide = () => { setHidden(true); try { localStorage.setItem(HIDE_KEY, '1'); } catch { /* storage unavailable */ } };
  const all = doneCount === tasks.length;
  const list = showAll ? tasks : tasks.filter(t => !doneMap[t.key]);
  const cur = hover ? tasks.find(t => t.key === hover) : null;
  const R = 12, C = 2 * Math.PI * R;
  const onKey = (e: RKE, i: number) => {
    const btns = cardRef.current?.querySelectorAll<HTMLButtonElement>('.gs-t');
    if (!btns) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); btns[Math.min(btns.length - 1, i + 1)]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); btns[Math.max(0, i - 1)]?.focus(); }
  };

  return (
    <>
      <section ref={cardRef} className="gs md:block hidden" aria-label="Getting started" onMouseLeave={close}>
        <style>{CSS}</style>
        <svg className="gs-ring" viewBox="0 0 30 30" aria-hidden>
          <circle cx="15" cy="15" r={R} stroke="var(--accent-soft)" />
          <circle cx="15" cy="15" r={R} stroke="var(--accent)" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - shown / 100)} transform="rotate(-90 15 15)" style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' }} />
        </svg>
        <div className="gs-head"><b>{all ? 'All set' : 'Getting started'}</b><span>{shown}%</span></div>
        {all && !showAll ? (
          <div className="gs-done">Your workspace is set up. Nice work.<br /><button type="button" onClick={hide}>Hide this card</button></div>
        ) : list.map((t, i) => {
          const d = doneMap[t.key];
          return (
            <button key={t.key} type="button" className={'gs-t' + (hover === t.key ? ' on' : '') + (d ? ' done' : '')} aria-expanded={hover === t.key}
              onMouseEnter={() => open(t.key)} onFocus={() => open(t.key)} onClick={() => start(t)} onKeyDown={e => onKey(e, i)}>
              {d ? <Tick /> : <Dots />}<span>{t.label}</span>
            </button>
          );
        })}
        <button type="button" className="gs-all" onClick={() => setShowAll(v => !v)}>{showAll ? 'Hide finished tasks' : doneCount ? `View all tasks (${doneCount} done)` : 'View all tasks'}</button>
      </section>
      {cur && createPortal(
        <div ref={pvRef} className="gs-pv" role="dialog" aria-label={cur.title} style={{ top: pos.top, left: pos.left }} onMouseEnter={() => open(cur.key)} onMouseLeave={close}>
          <style>{CSS}</style>
          <Art k={cur.key} />
          <h3>{cur.title}</h3><p>{cur.text}</p>
          <button type="button" className="gs-go" onClick={() => start(cur)}>{doneMap[cur.key] ? 'Open' : 'Start task'}</button>
        </div>,
        document.body,
      )}
    </>
  );
};

const CSS = `
.gs{margin:0 12px 12px;padding:14px 12px 10px;border-radius:14px;background:var(--surface);border:1px solid var(--border);font-family:Inter,system-ui,sans-serif;color:var(--text)}
.gs *,.gs-pv *{box-sizing:border-box}
.gs button,.gs-pv button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;text-align:left}
.gs-ring{width:30px;height:30px;margin:0 4px;display:block}
.gs-ring circle{fill:none;stroke-width:3.5}
.gs-head{display:flex;align-items:baseline;justify-content:space-between;margin:12px 4px 8px}
.gs-head b{font-weight:600;font-size:15px;letter-spacing:-.01em}
.gs-head span{font-size:13px;color:var(--text-muted);font-variant-numeric:tabular-nums}
.gs-t{display:flex;align-items:center;gap:12px;width:100%;height:38px;padding:0 10px;border-radius:10px;font-size:13.5px;color:var(--text);transition:background .15s,color .15s}
.gs-t:hover,.gs-t.on{background:var(--surface-2)}
.gs-t.done{color:var(--text-faint)}
.gs-t.done span{text-decoration:line-through;text-decoration-color:var(--border)}
.gs-t span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gs-dot{width:18px;height:18px;flex:none;position:relative}
.gs-dot i{position:absolute;left:50%;top:50%;width:3.4px;height:3.4px;margin:-1.7px;border-radius:50%;background:var(--text-faint)}
.gs-tick{width:18px;height:18px;flex:none;border-radius:50%;background:var(--success);display:grid;place-items:center;color:#fff;animation:gs-pop .35s cubic-bezier(.2,.8,.2,1)}
.gs-tick svg{width:11px;height:11px}
@keyframes gs-pop{from{transform:scale(.4)}to{transform:none}}
.gs-all{display:block;margin:8px 10px 4px;font-size:13px;color:var(--accent)}
.gs-all:hover{text-decoration:underline;text-underline-offset:3px}
.gs-done{margin:6px 4px 4px;font-size:12.5px;line-height:1.5;color:var(--text-muted)}
.gs-done button{margin-top:8px;color:var(--accent)}
.gs :focus-visible,.gs-pv :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.gs-pv{position:fixed;z-index:60;width:min(400px,calc(100vw - 280px));min-width:280px;padding:10px 10px 18px;border-radius:16px;background:#141416;color:#fff;border:1px solid rgba(255,255,255,.08);animation:gs-in .22s cubic-bezier(.2,.8,.2,1);font-family:Inter,system-ui,sans-serif}
@keyframes gs-in{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
.gs-art{position:relative;height:190px;border-radius:10px;overflow:hidden;background:linear-gradient(115deg,color-mix(in srgb,var(--accent) 45%,#000) 0%,var(--accent) 45%,color-mix(in srgb,var(--accent) 55%,#fff) 80%,color-mix(in srgb,var(--accent) 15%,#fff) 100%)}
.gs-art::after{content:'';position:absolute;inset:0;background:radial-gradient(60% 80% at 85% 85%,rgba(255,255,255,.5),transparent 60%),radial-gradient(50% 60% at 10% 0%,rgba(0,0,0,.35),transparent 70%)}
.gs-mock{position:absolute;z-index:1;left:22px;right:-30px;top:22px;bottom:22px;border-radius:10px;background:#fff;color:#1c1c1e;padding:14px 46px 14px 16px;font-size:13px;line-height:1.6;display:flex;flex-direction:column;gap:6px;overflow:hidden}
.gs-mock b{font-weight:600}
.gs-b{max-width:78%;padding:6px 10px;border-radius:12px;font-size:12.5px;line-height:1.4}
.gs-b.them{background:#f1f1ef;align-self:flex-start}
.gs-b.me{background:var(--accent);color:var(--on-accent);align-self:flex-end}
.gs-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid #eeeeec;font-size:12.5px}
.gs-row em{font-style:normal;font-size:11.5px;color:#6b7280}
.gs-row em.on{color:#1f8f4e}.gs-row em.hot{color:#c93a3a;font-weight:600}
.gs-bars{display:flex;align-items:flex-end;gap:7px;height:46px}
.gs-bars i{flex:1;border-radius:3px 3px 0 0;background:#d3dbd9}
.gs-bars i.hi{background:var(--accent)}
.gs-seg{display:flex;padding:3px;border-radius:9px;background:#f1f1ef;width:max-content;margin-top:6px}
.gs-seg span{padding:5px 10px;border-radius:7px;font-size:12px;color:#55555a}
.gs-seg span.on{background:#fff;color:#1c1c1e;font-weight:500}
.gs-pv h3{margin:16px 8px 0;font-weight:500;font-size:18px;letter-spacing:-.01em;color:#fff}
.gs-pv p{margin:8px 8px 0;font-size:14px;line-height:1.55;color:#b7b7bd}
.gs-go{margin:16px 8px 0;height:38px;padding:0 18px;border-radius:9px;background:var(--accent)!important;color:var(--on-accent)!important;font-size:14px;font-weight:500;display:inline-flex;align-items:center;transition:opacity .15s}
.gs-go:hover{opacity:.88}
@media (prefers-reduced-motion:reduce){.gs *,.gs-pv,.gs-pv *{animation:none!important;transition:none!important}}
`;
