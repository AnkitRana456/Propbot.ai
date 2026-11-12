import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUp, Check, ChevronRight, Copy, PenLine, RefreshCw, Square, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { apiRequest } from '../../services/api-client.js';

/**
 * The app-wide AI assistant, in the "AIPanel" design (from Cue): it slides in from the right and the page makes room.
 * Ask about your pipeline (real answers from /api/growth/ask-pipeline): "Thinking…" shimmers, then "Thought for Ns" and
 * the leads it looked at, and the answer types in. Copy · Good · Bad · Regenerate under each reply; Stop while it types.
 * Ctrl/⌘ J toggles it, Esc closes it. Colours follow the app's theme tokens.
 */

type Lead = { id: string; name: string; status?: string; intentScore?: number; intentLabel?: string; budgetMax?: number };
type Reply = { answer: string; toolUsed?: string; citations?: Lead[]; guardrailTriggered?: boolean };
type Turn = {
  id: number; q: string; state: 'thinking' | 'typing' | 'done' | 'stopped';
  text: string; shown: number; ms: number; leads: Lead[]; tool?: string; open: null | 'thought' | 'leads'; fb: 'up' | 'down' | null; copied: boolean; failed?: boolean;
};

const SUGGEST = ['Who are my hottest leads?', 'Site visits scheduled this week', 'Lead volume by source this month'];
let uid = 0;

const Mark = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={(size * 44) / 52} viewBox="0 0 52 44" aria-hidden="true">
    <path d="M2 20a17 17 0 0 1 34 0z" fill="currentColor" />
    <path d="M50 24a17 17 0 0 1-34 0z" fill="var(--accent)" />
  </svg>
);

// "1. Heading" → heading, "- x" → bullet, **bold** kept bold; the dot trails the last block while typing
function rich(text: string, live: boolean) {
  const lines = text.split('\n').filter(l => l.trim());
  const bold = (s: string, k: number) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') && p.length > 4 ? <strong key={`${k}-${i}`}>{p.slice(2, -2)}</strong> : p));
  return lines.map((l, i) => {
    const caret = live && i === lines.length - 1 ? <span className="aip-caret" /> : null;
    if (/^#{1,3}\s/.test(l)) return <h4 key={i}>{bold(l.replace(/^#{1,3}\s/, ''), i)}{caret}</h4>;
    if (/^\d+\.\s/.test(l)) return <h4 key={i}>{bold(l, i)}{caret}</h4>;
    if (/^\s*[-•*]\s/.test(l)) return <p key={i} className="aip-li">{bold(l.replace(/^\s*[-•*]\s/, ''), i)}{caret}</p>;
    return <p key={i}>{bold(l, i)}{caret}</p>;
  });
}

interface AssistantPanelProps {
  open: boolean;
  onClose: () => void;
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({ open, onClose }) => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const feedRef = useRef<HTMLDivElement>(null), taRef = useRef<HTMLTextAreaElement>(null), panelRef = useRef<HTMLElement>(null);
  // a closed panel stays out of the tab order (React 18 has no `inert` prop)
  useEffect(() => { if (panelRef.current) panelRef.current.inert = !open; }, [open]);
  // the floating voice widget sits bottom-right, right over the send button: hide it while the panel is open
  useEffect(() => {
    document.body.classList.toggle('aip-open', open);
    return () => document.body.classList.remove('aip-open');
  }, [open]);
  const live = turns.find(t => t.state === 'thinking' || t.state === 'typing');
  const patch = (id: number, p: Partial<Turn> | ((t: Turn) => Partial<Turn>)) => setTurns(all => all.map(t => (t.id === id ? { ...t, ...(typeof p === 'function' ? p(t) : p) } : t)));

  useEffect(() => { if (open) setTimeout(() => taRef.current?.focus({ preventScroll: true }), 380); }, [open]);
  useEffect(() => { const f = feedRef.current; if (f) f.scrollTop = f.scrollHeight; }, [turns]);
  useEffect(() => { const t = taRef.current; if (t) { t.style.height = 'auto'; t.style.height = `${Math.min(140, t.scrollHeight)}px`; } }, [input]);

  // the answer types in word by word
  const typing = live?.state === 'typing' ? live.id : null;
  useEffect(() => {
    if (typing == null) return;
    const iv = setInterval(() => patch(typing, t => {
      if (t.state !== 'typing') return {};
      const next = t.text.indexOf(' ', t.shown + 1);
      return next < 0 ? { shown: t.text.length, state: 'done' } : { shown: next };
    }), 28);
    return () => clearInterval(iv);
  }, [typing]);

  const ask = async (id: number, q: string) => {
    const started = Date.now();
    patch(id, { state: 'thinking', text: '', shown: 0, open: null, fb: null, failed: false });
    let reply: Reply | null = null, failed = false;
    try {
      reply = await apiRequest<Reply>('/api/growth/ask-pipeline', { method: 'POST', body: JSON.stringify({ question: q, query: q }) });
    } catch (err) {
      failed = true;
      reply = { answer: err instanceof Error ? `Could not get an answer: ${err.message}` : 'Could not get an answer. Try again.' };
    }
    patch(id, t => (t.state === 'stopped' ? {} : { state: 'typing', text: reply!.answer || 'No answer came back.', ms: Date.now() - started, leads: reply!.citations ?? [], tool: reply!.toolUsed, failed }));
  };
  const send = (raw?: string) => {
    const q = (raw ?? input).trim();
    if (!q || live) return;
    const t: Turn = { id: ++uid, q, state: 'thinking', text: '', shown: 0, ms: 0, leads: [], open: null, fb: null, copied: false };
    setTurns(all => [...all, t]);
    setInput('');
    void ask(t.id, q);
  };
  const stop = () => { if (live) patch(live.id, t => ({ state: 'stopped', shown: t.state === 'typing' ? t.shown : 0 })); };
  const newChat = () => { setTurns([]); setInput(''); taRef.current?.focus({ preventScroll: true }); };
  const copy = (t: Turn) => {
    void navigator.clipboard?.writeText(t.text).catch(() => {});
    patch(t.id, { copied: true });
    setTimeout(() => patch(t.id, { copied: false }), 1400);
  };

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (live) stop(); else onClose(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  return (
    <div className={`aip-slot${open ? ' on' : ''}`}>
      <style>{CSS}</style>
      <section ref={panelRef} className="aip-panel" aria-label="AI assistant panel" aria-hidden={!open}>
        <div className="aip-ph">
          <span className="aip-hm"><Mark size={18} /></span>
          <b>{turns[0]?.q ?? 'Ask PropBot'}</b>
          <button type="button" className="aip-hb" aria-label="New chat" title="New chat" onClick={newChat}><PenLine size={15} /></button>
          <button type="button" className="aip-hb" aria-label="Close assistant" title="Close (Esc)" onClick={onClose}><X size={17} /></button>
        </div>

        <div className="aip-feed" ref={feedRef} aria-live="polite">
          {turns.length === 0 ? (
            <div className="aip-empty">
              <Mark size={28} />
              <h3>Ask about your pipeline</h3>
              <p>Leads, visits, sources and budgets, answered from your own CRM.</p>
              {SUGGEST.map(s => <button type="button" key={s} className="aip-sug" onClick={() => send(s)}><ArrowRight size={14} />{s}</button>)}
            </div>
          ) : turns.map(t => {
            const visible = t.state === 'done' ? t.text : t.text.slice(0, t.shown);
            return (
              <div key={t.id} className="aip-turn">
                <div className="aip-bub">{t.q}</div>
                <div className="aip-meta">
                  {t.state === 'thinking' ? <span className="aip-shim">Thinking…</span> : t.state === 'stopped' && !visible ? <span>Stopped</span> : (
                    <>
                      <button type="button" className={`aip-th${t.open === 'thought' ? ' x' : ''}`} onClick={() => patch(t.id, { open: t.open === 'thought' ? null : 'thought' })}>
                        Thought for {Math.max(1, Math.round(t.ms / 1000))} second{Math.round(t.ms / 1000) > 1 ? 's' : ''} <ChevronRight size={14} />
                      </button>
                      {t.leads.length > 0 && (
                        <button type="button" className="aip-src" onClick={() => patch(t.id, { open: t.open === 'leads' ? null : 'leads' })}><i />{t.leads.length} lead{t.leads.length > 1 ? 's' : ''}</button>
                      )}
                    </>
                  )}
                </div>
                {t.open === 'thought' && <div className="aip-drop">{t.tool ? `Looked up your CRM with “${t.tool}”, then wrote a short answer.` : 'Read the question, checked your CRM, and kept the answer short.'}</div>}
                {t.open === 'leads' && (
                  <div className="aip-drop">
                    {t.leads.map(l => <div key={l.id}>{l.name}{l.intentScore != null ? ` · ${l.intentScore}% intent` : ''}{l.status ? ` · ${l.status.replace(/_/g, ' ')}` : ''}</div>)}
                  </div>
                )}
                {visible && (
                  <div className="aip-ans">
                    <span className="aip-mk"><Mark /></span>
                    <div className={`aip-t${t.failed ? ' err' : ''}`}>{rich(visible, t.state === 'typing')}</div>
                  </div>
                )}
                {(t.state === 'done' || (t.state === 'stopped' && visible)) && (
                  <div className="aip-acts">
                    <button type="button" aria-label="Copy" title="Copy" className={t.copied ? 'on' : ''} onClick={() => copy(t)}>{t.copied ? <Check size={16} /> : <Copy size={16} />}</button>
                    <button type="button" aria-label="Good reply" title="Good reply" aria-pressed={t.fb === 'up'} className={t.fb === 'up' ? 'on' : ''} onClick={() => patch(t.id, { fb: t.fb === 'up' ? null : 'up' })}><ThumbsUp size={16} fill={t.fb === 'up' ? 'currentColor' : 'none'} /></button>
                    <button type="button" aria-label="Bad reply" title="Bad reply" aria-pressed={t.fb === 'down'} className={t.fb === 'down' ? 'on' : ''} onClick={() => patch(t.id, { fb: t.fb === 'down' ? null : 'down' })}><ThumbsDown size={16} fill={t.fb === 'down' ? 'currentColor' : 'none'} /></button>
                    <button type="button" aria-label="Regenerate" title="Regenerate" disabled={Boolean(live)} onClick={() => void ask(t.id, t.q)}><RefreshCw size={16} /></button>
                    {t.state === 'stopped' && <span className="aip-stopped">Stopped</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="aip-box">
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            placeholder="Ask about your leads and visits…"
            aria-label="Message the assistant"
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          />
          <div className="aip-brow">
            <span className="aip-hint">Enter to send · Shift+Enter new line</span>
            <button type="button" className={`aip-send${live || input.trim() ? ' go' : ''}`} aria-label={live ? 'Stop' : 'Send'} onClick={() => (live ? stop() : send())}>
              {live ? <Square size={11} fill="currentColor" /> : <ArrowUp size={15} />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

const CSS = `
body.aip-open elevenlabs-convai { display: none !important; }
.aip-slot { width: 0; flex: none; display: flex; justify-content: flex-end; overflow: hidden; transition: width .52s cubic-bezier(.3,.7,.2,1); }
.aip-slot.on { width: 408px; }
.aip-panel { width: 400px; flex: none; margin: 8px 8px 8px 0; display: flex; flex-direction: column; min-height: 0; border-radius: 20px; background: var(--surface); border: 1px solid var(--border); color: var(--text); font-size: 14px; line-height: 1.5; transform: translateX(24px); opacity: 0; transition: transform .52s cubic-bezier(.3,.7,.2,1), opacity .3s; }
.aip-slot.on .aip-panel { transform: none; opacity: 1; }
.aip-panel *, .aip-panel *::before, .aip-panel *::after { box-sizing: border-box; }
.aip-panel button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
.aip-panel :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.aip-ph { height: 58px; flex: none; display: flex; align-items: center; gap: 4px; padding: 0 10px 0 18px; border-bottom: 1px solid var(--border-subtle, var(--border)); }
.aip-hm { color: var(--text); margin-right: 6px; display: flex; }
.aip-ph b { flex: 1; min-width: 0; font-weight: 600; font-size: 15px; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aip-hb { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; color: var(--text-muted); }
.aip-hb:hover { background: var(--surface-2); color: var(--text); }
.aip-feed { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; padding: 8px 18px 18px; display: flex; flex-direction: column; line-height: 1.6; }
.aip-empty { margin: auto 0; padding-bottom: 20px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; color: var(--text); }
.aip-empty h3 { font-size: 21px; font-weight: 600; letter-spacing: -.02em; margin: 14px 0 0; }
.aip-empty p { margin: 2px 0 12px; font-size: 13px; color: var(--text-muted); }
.aip-sug { display: flex; align-items: center; gap: 8px; padding: 7px 0; font-size: 14px; color: var(--text-muted) !important; text-align: left; transition: color .2s; }
.aip-sug svg { color: var(--text-faint); transition: transform .2s, color .2s; flex: none; }
.aip-sug:hover { color: var(--text) !important; }
.aip-sug:hover svg { transform: translateX(3px); color: var(--accent); }
.aip-turn { display: flex; flex-direction: column; margin-top: 22px; }
.aip-turn:first-child { margin-top: 12px; }
.aip-bub { align-self: flex-end; max-width: 88%; padding: 9px 16px; border-radius: 20px; background: var(--text); color: var(--surface); font-size: 14px; line-height: 1.45; animation: aip-up .45s cubic-bezier(.3,.7,.2,1) both; overflow-wrap: anywhere; }
@keyframes aip-up { from { opacity: 0; transform: translateY(10px); } }
.aip-meta { display: flex; align-items: center; gap: 6px; min-height: 22px; margin-top: 18px; color: var(--text-muted); font-size: 13px; }
.aip-th { display: flex; align-items: center; gap: 4px; }
.aip-th svg { transition: transform .25s; }
.aip-th.x svg { transform: rotate(90deg); }
.aip-src { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.aip-src i { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }
.aip-th:hover, .aip-src:hover { color: var(--text) !important; }
.aip-shim { background: linear-gradient(90deg, var(--text-muted) 0%, var(--text-muted) 40%, var(--text) 50%, var(--text-muted) 60%, var(--text-muted) 100%) 0 0/250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: aip-sh 1.4s linear infinite; }
@keyframes aip-sh { from { background-position: 100% 0; } to { background-position: -50% 0; } }
.aip-drop { margin-top: 6px; padding-left: 12px; border-left: 2px solid var(--border); color: var(--text-muted); font-size: 12.5px; line-height: 1.6; animation: aip-fade .25s both; }
.aip-ans { display: flex; gap: 12px; margin-top: 10px; }
.aip-mk { flex: none; margin-top: 4px; color: var(--text); }
.aip-t { min-width: 0; font-size: 14px; color: var(--text); overflow-wrap: anywhere; }
.aip-t.err { color: var(--danger); }
.aip-t p { margin: 0; }
.aip-t p + p { margin-top: 8px; }
.aip-t h4 { margin: 14px 0 0; font-size: 14px; font-weight: 600; }
.aip-t h4:first-child { margin-top: 0; }
.aip-t h4 + p { margin-top: 2px; }
.aip-t strong { font-weight: 600; }
.aip-t .aip-li { position: relative; padding-left: 14px; }
.aip-t .aip-li + .aip-li { margin-top: 4px; }
.aip-t .aip-li::before { content: ''; position: absolute; left: 2px; top: .72em; width: 4px; height: 4px; border-radius: 50%; background: var(--accent); }
.aip-caret { display: inline-block; width: 7px; height: 7px; margin-left: 5px; border-radius: 50%; background: var(--accent); vertical-align: middle; animation: aip-bl 1s ease-in-out infinite; }
@keyframes aip-bl { 50% { opacity: .25; } }
.aip-acts { display: flex; align-items: center; gap: 2px; margin: 10px 0 0 26px; color: var(--text-muted); animation: aip-fade .35s both; }
@keyframes aip-fade { from { opacity: 0; } }
.aip-acts button { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; transition: background .15s, color .15s; }
.aip-acts button:hover:not(:disabled) { background: var(--surface-2); color: var(--text); }
.aip-acts button.on { color: var(--accent); }
.aip-acts button:disabled { opacity: .4; cursor: default; }
.aip-stopped { margin-left: 8px; font-size: 12px; color: var(--text-faint); }
.aip-box { flex: none; margin: 0 12px 12px; border: 1px solid var(--border); border-radius: 16px; padding: 12px; background: var(--surface); transition: border-color .2s, box-shadow .2s; }
.aip-box:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow, transparent); }
.aip-box textarea { display: block; width: 100%; max-height: 140px; padding: 0 2px; border: 0; outline: 0; resize: none; background: none; font: inherit; font-size: 14px; line-height: 1.5; color: var(--text); scrollbar-width: none; box-shadow: none; }
.aip-box textarea::placeholder { color: var(--text-faint); }
.aip-box textarea:focus-visible { outline: none; }
.aip-brow { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.aip-hint { font-size: 11.5px; color: var(--text-faint); }
.aip-send { margin-left: auto; width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: var(--surface-2) !important; color: var(--text-faint) !important; transition: background .2s, color .2s; }
.aip-send.go { background: var(--accent) !important; color: var(--on-accent, #fff) !important; }
/* not enough room to push the page: float over it instead */
@media (max-width: 1279px) {
  .aip-slot { position: fixed; top: 0; right: 0; bottom: 0; z-index: 60; pointer-events: none; overflow: visible; }
  .aip-slot.on { pointer-events: auto; }
  .aip-panel { box-shadow: 0 24px 60px -20px rgba(0,0,0,.45); }
}
@media (max-width: 767px) {
  .aip-slot { position: fixed; inset: 0; z-index: 60; width: 100% !important; pointer-events: none; overflow: visible; }
  .aip-slot.on { pointer-events: auto; background: rgba(0,0,0,.25); }
  .aip-panel { width: calc(100% - 16px); margin: 8px; transform: translateY(30px); }
}
@media (prefers-reduced-motion: reduce) { .aip-slot, .aip-panel { transition: none; } .aip-shim, .aip-caret { animation: none; } }
`;
