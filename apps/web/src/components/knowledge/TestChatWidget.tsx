import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronRight, Clock, Copy, PenLine, RefreshCw, RotateCcw, Square, ThumbsDown, ThumbsUp, Zap } from 'lucide-react';
import type { RagQueryResponse } from '@propbot/shared';
import { useTheme } from '../../contexts/ThemeContext.js';

/**
 * The chatbot test playground, in the "Ember" chat design (from Cue): a Quick | Think switch, a live thinking
 * timeline that runs while the knowledge base is searched, markdown replies that type in, Copy / 👍 / 👎 /
 * Regenerate, Stop (or Esc). Colours come from the app's theme tokens, so light and dark follow the app.
 */

interface HistoryTurn { role: 'visitor' | 'assistant'; content: string; }

interface TestChatWidgetProps {
  onTestQuery: (query: string, history: HistoryTurn[], visitorName?: string) => Promise<RagQueryResponse>;
  onCorrectAnswer: (question: string) => void;
  botName?: string;
}

type Step = { t: string; d: string; tags?: string[]; src?: boolean };
type Phase = 'think' | 'wait' | 'dots' | 'type' | 'done' | 'stopped';
type UserMsg = { id: string; role: 'user'; text: string };
type AiMsg = {
  id: string; role: 'ai'; question: string; think: boolean; started: number;
  phase: Phase; steps: Step[]; active: number; typed: number; pause: number; tagsShown: number;
  text: string; shown: number; thoughtMs?: number; meta?: RagQueryResponse; failed?: boolean; feedback?: 'up' | 'down';
};
type Msg = UserMsg | AiMsg;

const SAMPLE_PROMPTS = ['What is the starting price?', 'What is the clubhouse size?', 'When is the possession date?', 'Which banks give home loans?'];
const MODE_KEY = 'propbot_test_mode';
const TICK = 30;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const firstSteps = (q: string, botName: string): Step[] => [
  { t: 'Understanding the question.', d: `“${clip(q, 60)}” — working out what the buyer actually wants to know.`, tags: ['Your message'] },
  { t: 'Searching your knowledge base.', d: `Matching the question against everything ${botName} was trained on, and checking verified answers first.`, tags: [botName] },
];
const resultSteps = (r: RagQueryResponse | null): Step[] => {
  if (!r) return [{ t: 'Could not reach the knowledge base.', d: 'The request failed, so there is no grounded answer this time.' }];
  if (r.overrideApplied) return [{ t: 'Found a verified answer.', d: 'Your team saved a corrected answer for this question, so it is used as is.', tags: ['Verified override'] }];
  if (r.citations.length) {
    return [
      { t: `Reading ${r.citations.length} source${r.citations.length > 1 ? 's' : ''}.`, d: 'Keeping only the passages that answer the question and comparing what they say.', tags: r.citations.map(c => `${clip(c.sourceTitle, 28)} · ${Math.round(c.similarityScore * 100)}%`), src: true },
      { t: 'Writing the answer.', d: 'Short and clear, using only what the sources say.' },
    ];
  }
  return r.isGrounded
    ? [{ t: 'Checked the sources.', d: 'No single passage scored high enough to show as a citation.' }]
    : [{ t: 'No matching source found.', d: 'Nothing trained covers this, so the reply says so instead of guessing.' }];
};

// ---------------- tiny markdown (React nodes only, no HTML injection) ----------------
const inline = (s: string, k: string): React.ReactNode[] =>
  s.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*)/g).filter(Boolean).map((p, i) => {
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) return <code key={`${k}${i}`}>{p.slice(1, -1)}</code>;
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={`${k}${i}`}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={`${k}${i}`}>{p.slice(1, -1)}</em>;
    return p;
  });

const CodeBlock: React.FC<{ lang: string; code: string }> = ({ lang, code }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code">
      <header>
        <span>{lang || 'code'}</span>
        <button type="button" onClick={() => void navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); })}>
          {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Copied' : 'Copy'}
        </button>
      </header>
      <pre><code>{code}</code></pre>
    </div>
  );
};

const Markdown: React.FC<{ text: string }> = ({ text }) => {
  const out: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) body.push(lines[i++]!);
      i++;
      out.push(<CodeBlock key={i} lang={fence[1] ?? ''} code={body.join('\n')} />);
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) { out.push(<h3 key={i}>{inline(h[2]!, `h${i}`)}</h3>); i++; continue; }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*([-*]|\d+\.)\s+/, ''));
      const lis = items.map((t, j) => <li key={j}>{inline(t, `l${i}-${j}`)}</li>);
      out.push(ordered ? <ol key={i}>{lis}</ol> : <ul key={i}>{lis}</ul>);
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(```|#{1,3}\s|\s*([-*]|\d+\.)\s)/.test(lines[i]!)) para.push(lines[i++]!);
    out.push(<p key={i}>{inline(para.join('\n'), `p${i}`)}</p>);
  }
  return <>{out}</>;
};

const Mark = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2c.6 4.2 2.6 6.3 6.6 7.1-4 .8-6 3-6.6 7.2-.6-4.2-2.6-6.4-6.6-7.2C9.4 8.3 11.4 6.2 12 2z" />
    <path d="M18.6 14.5c.3 2 1.2 3 3.2 3.4-2 .4-2.9 1.4-3.2 3.4-.3-2-1.2-3-3.2-3.4 2-.4 2.9-1.4 3.2-3.4z" opacity=".55" />
  </svg>
);
// a 3×3 grid with a light running clockwise round the edge; the order of the edge cells sets the delay
const RING = [0, 1, 2, 5, 8, 7, 6, 3];
const DotMatrix: React.FC<{ sm?: boolean }> = ({ sm }) => (
  <span className={`dm${sm ? ' sm' : ''}`} aria-hidden="true">
    {Array.from({ length: 9 }, (_, n) => (n === 4 ? <i key={n} className="c" /> : <i key={n} style={{ animationDelay: `${RING.indexOf(n) * 0.15}s` }} />))}
  </span>
);

const Timeline: React.FC<{ m: AiMsg; live: boolean }> = ({ m, live }) => (
  <div className={`tl${live ? '' : ' static'}`}>
    {live && <div className="tl-head"><DotMatrix /><span className="shimmer">Thinking…</span></div>}
    <div className="tl-rail">
      {m.steps.map((s, i) => {
        if (live && i > m.active) return null;
        const active = live && i === m.active && m.phase === 'think';
        const done = live && (i < m.active || m.phase !== 'think');
        const detail = active ? s.d.slice(0, m.typed) : s.d;
        const showTags = !active || m.typed >= s.d.length / 2;
        const tags = s.tags ? (s.src && active ? s.tags.slice(0, m.tagsShown) : s.tags) : [];
        return (
          <div key={i} className={`tl-step fresh${active ? ' active' : ''}${done ? ' done' : ''}`}>
            <span className="ic">{active ? <DotMatrix sm /> : <i />}</span>
            <div className="tt">{s.t}</div>
            <div className={`dd${active && m.typed < s.d.length ? ' typing' : ''}`}>{detail}</div>
            {showTags && tags.length > 0 && <div className="tags">{tags.map(t => <span key={t} className="tag fresh">{s.src && <b>{t[0]}</b>}{t}</span>)}</div>}
          </div>
        );
      })}
      {live && m.phase === 'wait' && (
        <div className="tl-wait"><span className="ic"><i /><i /><i /></span><span className="tt">Reading your sources…</span></div>
      )}
    </div>
  </div>
);

export const TestChatWidget: React.FC<TestChatWidgetProps> = ({ onTestQuery, onCorrectAnswer, botName = 'PropBot AI' }) => {
  const { theme } = useTheme();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [think, setThink] = useState(() => {
    try { return localStorage.getItem(MODE_KEY) !== 'quick'; } catch { return true; }
  });
  const [openTrace, setOpenTrace] = useState<Record<string, boolean>>({});
  const [openSrc, setOpenSrc] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [visitorName, setVisitorName] = useState<string | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stuck = useRef(true); // follow the newest text unless the person scrolled up

  const live = msgs.find((m): m is AiMsg => m.role === 'ai' && m.phase !== 'done' && m.phase !== 'stopped');
  const busy = Boolean(live);

  const setMode = (t: boolean) => {
    setThink(t);
    try { localStorage.setItem(MODE_KEY, t ? 'think' : 'quick'); } catch { /* storage unavailable */ }
  };
  const patch = (id: string, f: (m: AiMsg) => AiMsg) => setMsgs(list => list.map(m => (m.id === id && m.role === 'ai' ? f(m) : m)));

  // one clock drives the live reply: steps type in, then the answer types in
  useEffect(() => {
    if (!live) return;
    const id = live.id;
    const t = setInterval(() => patch(id, m => {
      if (m.phase === 'think') {
        const s = m.steps[m.active]!;
        const tagsShown = m.typed >= s.d.length / 2 ? m.tagsShown + 0.2 : m.tagsShown; // a source tag every ~150ms
        if (m.typed < s.d.length) return { ...m, typed: m.typed + 2, tagsShown };
        if (m.pause < 10) return { ...m, pause: m.pause + 1, tagsShown };
        if (m.active < m.steps.length - 1) return { ...m, active: m.active + 1, typed: 0, pause: 0, tagsShown: 0 };
        if (!m.meta && !m.failed) return { ...m, phase: 'wait' };
        return { ...m, phase: 'type', thoughtMs: Date.now() - m.started };
      }
      if (m.phase === 'type') return m.shown >= m.text.length ? { ...m, phase: 'done' } : { ...m, shown: m.shown + 4 };
      return m;
    }), TICK);
    return () => clearInterval(t);
  }, [live?.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(160, el.scrollHeight)}px`;
  }, [input]);

  const stop = () => { if (live) patch(live.id, m => ({ ...m, phase: 'stopped', shown: m.phase === 'type' ? m.shown : 0 })); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && live) stop(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });

  const ask = async (question: string, before: Msg[]) => {
    const history: HistoryTurn[] = before
      .filter(m => m.role === 'user' || (m.role === 'ai' && m.text && m.phase === 'done'))
      .slice(-12)
      .map(m => ({ role: m.role === 'user' ? 'visitor' : 'assistant', content: m.text }));
    let name = visitorName;
    if (!name) {
      name = question.match(/(?:my name is|i am|i'm|mera naam|naam hai)\s+([A-Z][a-z]+)/i)?.[1];
      if (name) setVisitorName(name);
    }
    const id = `a${Date.now()}`;
    const ai: AiMsg = {
      id, role: 'ai', question, think, started: Date.now(), phase: think ? 'think' : 'dots',
      steps: think ? firstSteps(question, botName) : [], active: 0, typed: 0, pause: 0, tagsShown: 0, text: '', shown: 0,
    };
    stuck.current = true;
    setMsgs([...before, { id: `u${Date.now()}`, role: 'user', text: question }, ai]);

    let res: RagQueryResponse | null = null;
    let text = '';
    try {
      res = await onTestQuery(question, history, name);
      text = res.answer;
    } catch (err) {
      text = err instanceof Error ? err.message : 'Could not get an answer from the knowledge base.';
    }
    patch(id, m => {
      if (m.phase === 'stopped') return m; // Stop already ended this reply
      const steps = m.think ? [...m.steps, ...resultSteps(res)] : m.steps;
      const base = { ...m, text, meta: res ?? undefined, failed: !res, steps };
      if (!m.think) return { ...base, phase: 'type' };
      return m.phase === 'wait' ? { ...base, phase: 'think', active: m.steps.length, typed: 0, pause: 0, tagsShown: 0 } : base;
    });
  };

  const send = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    void ask(q, msgs);
  };
  const regenerate = (m: AiMsg) => {
    if (busy) return;
    const at = msgs.findIndex(x => x.id === m.id);
    void ask(m.question, msgs.slice(0, Math.max(0, at - 1)));
  };
  const reset = () => { if (live) stop(); setMsgs([]); setVisitorName(undefined); setOpenTrace({}); setOpenSrc({}); };

  const badge = (meta: RagQueryResponse) => {
    if (meta.overrideApplied) return <span className="badge ok">Verified override</span>;
    if (meta.isGrounded) return meta.citations.length ? <span className="badge ok">From your sources</span> : null;
    return <span className="badge warn">Not in knowledge base</span>;
  };

  return (
    <div className={`ec${theme === 'light' ? ' light' : ''}`}>
      <style>{CSS}</style>
      <header className="ec-hd">
        <span className="ec-mark"><Mark /></span>
        <div className="ec-ttl"><b>{botName}</b><small>Test playground · live answers from your sources</small></div>
        <div className={`mode${think ? ' think' : ''}`} role="radiogroup" aria-label="Reply mode">
          <span className="knob" aria-hidden="true" />
          <button type="button" role="radio" aria-checked={!think} onClick={() => setMode(false)} title="Answer straight away"><Zap size={12} />Quick</button>
          <button type="button" role="radio" aria-checked={think} onClick={() => setMode(true)} title="Show how the answer is found"><Clock size={12} />Think</button>
        </div>
        <button type="button" className="iconbtn" onClick={reset} title="Start fresh" aria-label="Start a fresh test chat"><RotateCcw size={15} /></button>
      </header>

      <div ref={scrollRef} className="ec-scroll" onScroll={e => { const el = e.currentTarget; stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }} aria-live="polite">
        {msgs.length === 0 ? (
          <section className="hello">
            <span className="hello-mark"><Mark /></span>
            <h2>What would a buyer ask {botName}?</h2>
            <p>Ask the way a buyer would. Switch to Think to watch how the answer is found.</p>
            <div className="chips">
              {SAMPLE_PROMPTS.map(p => <button key={p} type="button" className="chip" onClick={() => send(p)}>{p}</button>)}
            </div>
          </section>
        ) : (
          <div className="thread">
            {msgs.map(m => {
              if (m.role === 'user') return <div key={m.id} className="msg user"><div className="bubble">{m.text}</div></div>;
              const isLive = m.id === live?.id;
              const thinking = isLive && (m.phase === 'think' || m.phase === 'wait');
              const typing = m.phase === 'type';
              const visible = m.phase === 'done' ? m.text : m.text.slice(0, m.shown);
              return (
                <div key={m.id} className={`msg ai${isLive ? ' live' : ''}`}>
                  <span className="mark"><Mark /></span>
                  <div className="body">
                    {thinking && <Timeline m={m} live />}
                    {!thinking && m.think && m.thoughtMs != null && (
                      <>
                        <button type="button" className="thought" aria-expanded={Boolean(openTrace[m.id])} onClick={() => setOpenTrace(o => ({ ...o, [m.id]: !o[m.id] }))}>
                          Thought for {Math.max(1, Math.round(m.thoughtMs / 1000))}s <ChevronRight size={13} />
                        </button>
                        {openTrace[m.id] && <div className="trace"><Timeline m={m} live={false} /></div>}
                      </>
                    )}
                    {m.phase === 'dots' && <span className="thinking"><i /><i /><i /></span>}
                    {visible && <div className={m.failed ? 'err' : undefined}><Markdown text={visible} /></div>}
                    {typing && <span className="caret" />}
                    {m.phase === 'stopped' && <div className="stopped">Stopped</div>}
                    {m.phase === 'done' && (
                      <>
                        {m.meta && (
                          <div className="meta">
                            {badge(m.meta)}
                            <span><Zap size={11} />{m.meta.latencyMs}ms</span>
                            <span>{m.meta.tokensUsed.total} tokens</span>
                            {m.meta.citations.length > 0 && (
                              <button type="button" className="linkish" onClick={() => setOpenSrc(o => ({ ...o, [m.id]: !o[m.id] }))}>
                                {m.meta.citations.length} source{m.meta.citations.length > 1 ? 's' : ''} {openSrc[m.id] ? '▾' : '▸'}
                              </button>
                            )}
                          </div>
                        )}
                        {m.meta && openSrc[m.id] && (
                          <div className="srcs">
                            {m.meta.citations.map((c, i) => (
                              <div key={i} className="src">
                                <div><b>{c.sourceTitle}</b><span>{Math.round(c.similarityScore * 100)}% match</span></div>
                                {c.sectionHeader && <small>Section: {c.sectionHeader}</small>}
                                <p>“{c.snippet}”</p>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="acts">
                          <button type="button" title="Copy" aria-label="Copy answer" onClick={() => void navigator.clipboard?.writeText(m.text).then(() => { setCopied(m.id); setTimeout(() => setCopied(null), 1400); })}>
                            {copied === m.id ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                          <button type="button" title="Good answer" aria-label="Good answer" aria-pressed={m.feedback === 'up'} className={m.feedback === 'up' ? 'on' : undefined} onClick={() => patch(m.id, x => ({ ...x, feedback: x.feedback === 'up' ? undefined : 'up' }))}><ThumbsUp size={14} /></button>
                          <button type="button" title="Bad answer" aria-label="Bad answer" aria-pressed={m.feedback === 'down'} className={m.feedback === 'down' ? 'on' : undefined} onClick={() => patch(m.id, x => ({ ...x, feedback: x.feedback === 'down' ? undefined : 'down' }))}><ThumbsDown size={14} /></button>
                          <button type="button" title="Regenerate" aria-label="Regenerate answer" disabled={busy} onClick={() => regenerate(m)}><RefreshCw size={14} /></button>
                          <button type="button" className="fix" onClick={() => onCorrectAnswer(m.question)}><PenLine size={13} />Correct answer</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="dock">
        <div className="composer">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask a test question, e.g. What is the carpet area?"
            aria-label={`Message ${botName}`}
          />
          {busy ? (
            <button type="button" className="send" onClick={stop} aria-label="Stop the reply" title="Stop (Esc)"><Square size={11} fill="currentColor" /></button>
          ) : (
            <button type="button" className="send" onClick={() => send()} disabled={!input.trim()} aria-label="Send"><ArrowUp size={15} /></button>
          )}
        </div>
        <div className="fine">Answers come only from your trained sources. Use “Correct answer” to fix one.</div>
      </div>
    </div>
  );
};

const CSS = `
.ec { --main: var(--surface); --raise: var(--surface-2); --field: var(--surface-2); --line: var(--border); --ink: var(--text); --dim: var(--text-muted); --mute: var(--text-faint);
  --dm-off: #1b2747; --dm-on: #8db4ff; --dm-mid: #5684ec; --dm-c: #3e6fe0; --dm-c2: #5a8af5; --dm-glow: 90,145,255; --shim-a: #8d8d8d; --shim-b: #ffffff;
  position: relative; display: flex; flex-direction: column; height: 100%; overflow: hidden; border-radius: 16px; border: 1px solid var(--line); background: var(--main); color: var(--ink); font-size: 13.5px; -webkit-font-smoothing: antialiased; }
.ec.light { --dm-off: #d7e1f7; --dm-on: #2f6cf0; --dm-mid: #6f97f0; --dm-c: #6f97f0; --dm-c2: #2f6cf0; --dm-glow: 47,108,240; --shim-a: #a3a3a3; --shim-b: #111111; }
.ec *, .ec *::before, .ec *::after { box-sizing: border-box; }
.ec button { font: inherit; color: inherit; cursor: pointer; }
.ec button:focus-visible, .ec textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.ec-hd { display: flex; align-items: center; gap: 10px; padding: 12px 12px 12px 16px; border-bottom: 1px solid var(--line); }
.ec-mark, .ec .mark, .hello-mark { display: grid; place-items: center; border-radius: 50%; box-shadow: inset 0 0 0 1px var(--line); color: var(--ink); flex: none; }
.ec-mark { width: 30px; height: 30px; }
.ec-ttl { flex: 1; min-width: 0; display: grid; }
.ec-ttl b { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ec-ttl small { font-size: 11.5px; color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ec .iconbtn { width: 30px; height: 30px; border: 0; border-radius: 8px; background: var(--raise); display: grid; place-items: center; color: var(--dim); flex: none; transition: color .15s; }
.ec .iconbtn:hover { color: var(--ink); }
.ec .mode { position: relative; display: grid; grid-template-columns: 1fr 1fr; height: 30px; padding: 3px; border-radius: 9px; background: var(--raise); flex: none; }
.ec .mode button { position: relative; z-index: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-width: 66px; padding: 0 8px; border: 0; border-radius: 6px; background: none; color: var(--dim); font-size: 12.5px; transition: color .2s; }
.ec .mode button[aria-checked=true] { color: var(--ink); }
.ec .mode .knob { position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc(50% - 3px); border-radius: 6px; background: var(--main); box-shadow: 0 1px 2px rgba(0,0,0,.25), inset 0 0 0 1px var(--line); transition: transform .28s cubic-bezier(.3,.9,.3,1.15); }
.ec .mode.think .knob { transform: translateX(100%); }
.ec-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 18px 16px 10px; scrollbar-width: thin; }
.ec .hello { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 12px 8px 28px; }
.hello-mark { width: 42px; height: 42px; margin-bottom: 14px; }
.hello-mark svg { width: 20px; height: 20px; }
.ec .hello h2 { margin: 0 0 6px; font-size: 21px; font-weight: 600; letter-spacing: -.02em; line-height: 1.25; }
.ec .hello p { margin: 0 0 18px; max-width: 340px; font-size: 12.5px; line-height: 1.5; color: var(--dim); }
.ec .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.ec .chip { height: 30px; padding: 0 11px; border: 0; border-radius: 7px; background: var(--raise); color: var(--dim); font-size: 12.5px; transition: color .15s, box-shadow .15s; }
.ec .chip:hover { color: var(--ink); box-shadow: inset 0 0 0 1px var(--line); }
.ec .thread { display: flex; flex-direction: column; gap: 22px; }
.ec .msg.user { align-self: flex-end; max-width: 82%; }
.ec .msg.user .bubble { padding: 9px 14px; border-radius: 18px; background: var(--raise); line-height: 1.55; white-space: pre-wrap; word-wrap: break-word; }
.ec .msg.ai { display: flex; gap: 12px; }
.ec .msg.ai .mark { width: 26px; height: 26px; margin-top: 1px; }
.ec .msg.ai .mark svg { width: 13px; height: 13px; }
.ec .msg.ai.live .mark { visibility: hidden; }
.ec .body { flex: 1; min-width: 0; line-height: 1.65; }
.ec .body p { margin: 0 0 10px; white-space: pre-wrap; }
.ec .body p:last-child { margin-bottom: 0; }
.ec .body h3 { margin: 14px 0 6px; font-size: 14.5px; font-weight: 600; }
.ec .body ul, .ec .body ol { margin: 0 0 10px; padding-left: 20px; }
.ec .body li { margin: 3px 0; }
.ec .body ul { list-style: disc; } .ec .body ol { list-style: decimal; }
.ec .body strong { font-weight: 600; }
.ec .body em { font-style: italic; }
.ec .body code { font: 12px var(--font-mono, monospace); padding: 1px 5px; border-radius: 5px; background: var(--raise); }
.ec .body .code { margin: 4px 0 12px; border-radius: 12px; box-shadow: inset 0 0 0 1px var(--line); overflow: hidden; }
.ec .body .code header { display: flex; justify-content: space-between; align-items: center; height: 32px; padding: 0 8px 0 12px; font-size: 12px; color: var(--dim); background: var(--raise); }
.ec .body .code header button { height: 24px; padding: 0 8px; border: 0; border-radius: 6px; background: none; color: var(--dim); font-size: 12px; display: inline-flex; gap: 5px; align-items: center; }
.ec .body .code header button:hover { color: var(--ink); }
.ec .body pre { margin: 0; padding: 10px 12px 12px; overflow-x: auto; font: 12px/1.6 var(--font-mono, monospace); }
.ec .body pre code { padding: 0; background: none; }
.ec .err { color: var(--danger); }
.ec .caret { display: inline-block; width: 8px; height: 15px; margin-left: 2px; vertical-align: -2px; border-radius: 2px; background: var(--ink); animation: ec-blink 1s steps(2) infinite; }
@keyframes ec-blink { 50% { opacity: 0; } }
.ec .tl { margin: 0 0 12px; }
.ec .tl-head { display: flex; align-items: center; gap: 12px; height: 26px; margin-bottom: 10px; }
.ec .dm { display: grid; grid-template-columns: repeat(3, 5px); gap: 2.5px; padding: 1px; flex: none; }
.ec .dm i { width: 5px; height: 5px; border-radius: 1.2px; background: var(--dm-off); animation: ec-dm 1.2s linear infinite; }
.ec .dm i.c { background: var(--dm-c); box-shadow: 0 0 5px rgba(var(--dm-glow),.6); animation: ec-dmc 1.2s ease-in-out infinite; }
.ec .dm.sm { grid-template-columns: repeat(3, 3.5px); gap: 1.5px; }
.ec .dm.sm i { width: 3.5px; height: 3.5px; border-radius: .9px; }
@keyframes ec-dm { 0% { background: var(--dm-on); box-shadow: 0 0 6px 1px rgba(var(--dm-glow),.9); } 14% { background: var(--dm-mid); box-shadow: 0 0 4px rgba(var(--dm-glow),.5); } 34%, 100% { background: var(--dm-off); box-shadow: none; } }
@keyframes ec-dmc { 50% { background: var(--dm-c2); box-shadow: 0 0 8px rgba(var(--dm-glow),.85); } }
.ec .tl-head .shimmer, .ec .tl-step.active .tt, .ec .tl-wait .tt { background: linear-gradient(90deg, var(--shim-a) 0%, var(--shim-a) 35%, var(--shim-b) 50%, var(--shim-a) 65%, var(--shim-a) 100%); background-size: 240% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: ec-shimmer 2s linear infinite; }
.ec .tl-head .shimmer { font-size: 14.5px; }
@keyframes ec-shimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }
.ec .tl-rail { position: relative; padding-left: 28px; }
.ec .tl-rail::before { content: ''; position: absolute; left: 8px; top: 6px; bottom: 14px; width: 1px; background: var(--line); }
.ec .tl-step { position: relative; padding-bottom: 14px; }
.ec .tl-step.fresh, .ec .tag.fresh { animation: ec-stepin .35s ease-out both; }
@keyframes ec-stepin { from { opacity: 0; transform: translateY(4px); } }
.ec .tl-step .ic { position: absolute; left: -28px; top: 2px; width: 18px; height: 18px; display: grid; place-items: center; background: var(--main); }
.ec .tl-step .ic > i { width: 5px; height: 5px; border-radius: 50%; background: var(--mute); }
.ec .tl-step .tt { font-size: 13.5px; }
.ec .tl-step .dd { margin-top: 4px; font-size: 12.5px; line-height: 1.6; color: var(--dim); }
.ec .tl-step .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
.ec .tl-step .tag { height: 22px; padding: 0 8px; border-radius: 6px; background: var(--raise); font-size: 11px; color: var(--dim); display: inline-flex; align-items: center; gap: 5px; }
.ec .tl-step .tag b { width: 13px; height: 13px; border-radius: 3px; display: grid; place-items: center; font-size: 8px; font-weight: 700; background: var(--accent); color: var(--on-accent, #fff); text-transform: uppercase; }
.ec .tl-step.done { opacity: .55; }
.ec .tl.static .tl-step { opacity: .85; animation: none; }
.ec .typing::after { content: '▍'; margin-left: 1px; color: var(--mute); animation: ec-blink 1s steps(2) infinite; }
.ec .tl-wait { position: relative; display: flex; align-items: center; height: 22px; font-size: 13.5px; }
.ec .tl-wait .ic { position: absolute; left: -28px; top: 9px; width: 18px; display: flex; justify-content: center; gap: 2px; background: var(--main); }
.ec .tl-wait .ic i, .ec .thinking i { border-radius: 50%; background: var(--mute); animation: ec-dot 1.2s ease-in-out infinite; }
.ec .tl-wait .ic i { width: 3px; height: 3px; }
.ec .thinking { display: inline-flex; gap: 4px; padding-top: 8px; }
.ec .thinking i { width: 6px; height: 6px; }
.ec .tl-wait .ic i:nth-child(2), .ec .thinking i:nth-child(2) { animation-delay: .15s; }
.ec .tl-wait .ic i:nth-child(3), .ec .thinking i:nth-child(3) { animation-delay: .3s; }
@keyframes ec-dot { 30% { transform: translateY(-4px); background: var(--ink); } }
.ec .thought { display: inline-flex; align-items: center; gap: 3px; margin: 0 0 8px; padding: 0; border: 0; background: none; color: var(--dim); font-size: 12.5px; }
.ec .thought:hover { color: var(--ink); }
.ec .thought svg { transition: transform .2s; }
.ec .thought[aria-expanded=true] svg { transform: rotate(90deg); }
.ec .trace { margin: 2px 0 12px; animation: ec-stepin .25s ease-out; }
.ec .stopped { margin-top: 6px; font-size: 12px; color: var(--mute); }
.ec .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-top: 10px; font-size: 11.5px; color: var(--mute); }
.ec .meta > span { display: inline-flex; align-items: center; gap: 4px; }
.ec .badge { height: 22px; padding: 0 8px; border-radius: 6px; font-weight: 500; }
.ec .badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.ec .badge.ok { color: var(--success); background: var(--success-soft, var(--raise)); }
.ec .badge.warn { color: var(--warning); background: rgba(var(--warning-rgb), .1); }
.ec .linkish { border: 0; background: none; padding: 0; color: var(--dim); font-size: 11.5px; }
.ec .linkish:hover { color: var(--ink); }
.ec .srcs { display: grid; gap: 8px; margin-top: 10px; }
.ec .src { padding: 9px 11px; border-radius: 10px; background: var(--raise); font-size: 12px; }
.ec .src > div { display: flex; justify-content: space-between; gap: 8px; }
.ec .src > div span { color: var(--success); font-size: 11px; white-space: nowrap; }
.ec .src small { display: block; margin-top: 2px; color: var(--dim); font-size: 11px; }
.ec .src p { margin: 5px 0 0; color: var(--dim); font-size: 11.5px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.ec .acts { display: flex; align-items: center; gap: 2px; margin-top: 8px; margin-left: -6px; opacity: 0; transition: opacity .2s; }
.ec .msg.ai:hover .acts, .ec .msg.ai:last-child .acts, .ec .acts:focus-within { opacity: 1; }
.ec .acts button { height: 28px; min-width: 28px; border: 0; border-radius: 7px; background: none; color: var(--dim); display: inline-grid; grid-auto-flow: column; align-items: center; justify-content: center; gap: 5px; }
.ec .acts button:hover:not(:disabled), .ec .acts button.on { background: var(--raise); color: var(--ink); }
.ec .acts button:disabled { opacity: .4; cursor: default; }
.ec .acts .fix { margin-left: auto; padding: 0 9px; font-size: 12px; color: var(--accent); }
.ec .dock { padding: 8px 14px 12px; }
.ec .composer { display: flex; align-items: flex-end; gap: 8px; border-radius: 16px; background: var(--field); padding: 10px 10px 10px 14px; box-shadow: inset 0 0 0 1px var(--line); transition: box-shadow .2s; }
.ec .composer:focus-within { box-shadow: inset 0 0 0 1px var(--dim); }
.ec .composer textarea { flex: 1; display: block; min-height: 22px; max-height: 160px; resize: none; border: 0; outline: 0; background: none; font: inherit; font-size: 13.5px; line-height: 1.5; color: var(--ink); padding: 3px 0; }
.ec .composer textarea::placeholder { color: var(--mute); }
.ec .composer textarea:focus-visible { outline: none; }
.ec .send { width: 30px; height: 30px; border: 0; border-radius: 50%; background: var(--ink); color: var(--main); display: grid; place-items: center; flex: none; transition: transform .12s, opacity .15s; }
.ec .send:active { transform: scale(.94); }
.ec .send:disabled { opacity: .3; cursor: default; }
.ec .fine { margin-top: 7px; font-size: 11px; color: var(--mute); text-align: center; }
@media (prefers-reduced-motion: reduce) { .ec *, .ec *::before, .ec *::after { animation: none !important; transition: none !important; } }
`;
