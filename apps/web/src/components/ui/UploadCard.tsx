/**
 * UploadCard — a dark upload card with every stage (React 18, no other deps). A state machine drives one panel:
 *  ready → checking → uploading ⇄ paused → finishing → done, or error / cancelled. With `endpoint` the file goes up
 *  with XMLHttpRequest (live bytes, a speed EMA, Retry re-sends from 0); without one, or for the demo file, a simulated
 *  network runs. Every job has an id and every timer and callback checks it, so a cancel or a new pick never lets a
 *  stale job finish. The CSS lives in this file, scoped under .up and keyed off data-s (state) and data-v (view).
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from '../../lib/use-reduced-motion.js';

type State = 'ready' | 'checking' | 'uploading' | 'paused' | 'finishing' | 'done' | 'error' | 'cancelled';
type View = 'drop' | 'prog' | 'done' | 'error';
type DemoFile = { name: string; size: number; blob: Blob; demo: true };
type Job = {
  id: number; file: Blob; name: string; size: number; sent: number; rate: number; target: number; state: State; last: number;
  boost: number; t0: number; real: boolean; failAt: number; remote: string | null; local: string | null; xhr: XMLHttpRequest | null; reply: unknown;
};

export type UploadCardProps = {
  /** real mode: POST here (multipart, field "file", unless `body` builds something else); a JSON { url } reply enables Copy link */
  endpoint?: string;
  /** extra request headers in real mode, e.g. Authorization */
  headers?: Record<string, string>;
  /** builds the request body from the file, for APIs that take JSON instead of multipart */
  body?: (file: Blob, name: string) => XMLHttpRequestBodyInit | Promise<XMLHttpRequestBodyInit>;
  maxBytes?: number;
  accept?: string;
  hint?: string;
  title?: string;
  /** shows "No file handy? Try a demo file" (a simulated upload) */
  demo?: boolean;
  /** `reply` is the server's parsed JSON (null when simulated) */
  onComplete?: (file: File | Blob, url: string | null, reply: unknown) => void;
  onError?: (title: string, message: string) => void;
  onCancel?: () => void;
  className?: string;
  style?: CSSProperties;
};

const CSS = `.up, .up *{box-sizing: border-box;}
.up{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;--page: #e9eaec; --card: #18181a; --card-line: #2b2b2f; --panel: #222225; --panel-line: #2e2e33; --text: #f2f2f4; --dim: #9a9aa3; --faint: #5f5f68; --blue: #3d7cf0; --blue-hi: #6fa0ff; --off: #e6e6ea; --off-dim: #3a3a40; --green: #3ccf7a; --red: #ff5d5d;}
.up button, .up input{font: inherit; color: inherit;}
.up .mono{font-family: 'JetBrains Mono', ui-monospace, monospace;}
.up{width: min(100%, 480px); padding: 14px; border-radius: 16px; background: var(--card); border: 1px solid var(--card-line); color: var(--text); box-shadow: 0 30px 60px -30px rgba(0,0,0,.55), 0 2px 6px rgba(0,0,0,.2);}
.up-h{display: flex; align-items: center; gap: 12px; padding: 4px 6px 14px; font-size: 19px; font-weight: 500; letter-spacing: -.01em;}
.up-h svg{flex: none;}
.up-h .state{margin-left: auto; font: 500 11px/1 'JetBrains Mono', monospace; letter-spacing: .06em; text-transform: uppercase; color: var(--dim); display: inline-flex; align-items: center; gap: 7px;}
.up-h .state::before{content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--faint); transition: background-color .3s;}
.up[data-s=uploading] .state::before, .up[data-s=finishing] .state::before{background: var(--blue); animation: up-pulse 1.2s infinite;}
.up[data-s=paused] .state::before{background: #e6b34a;}
.up[data-s=done] .state::before{background: var(--blue-hi);}
.up[data-s=error] .state::before{background: var(--red);}
@keyframes up-pulse{50% { opacity: .35; }}
.up .panel{position: relative; padding: 16px; border-radius: 12px; background: var(--panel); border: 1px solid var(--panel-line); min-height: 196px;}
.up .view{display: none;}
.up[data-v=drop] .v-drop, .up[data-v=prog] .v-prog, .up[data-v=done] .v-done, .up[data-v=error] .v-error{display: block; animation: up-viewIn .28s cubic-bezier(.2,.8,.2,1);}
@keyframes up-viewIn{from { opacity: 0; transform: translateY(4px); }}
.up .drop{display: grid; place-items: center; gap: 10px; min-height: 162px; padding: 18px; border-radius: 10px; border: 1.5px dashed #3c3c43; text-align: center; cursor: pointer; transition: border-color .2s, background-color .2s;}
.up .drop:hover, .up .drop:focus-visible{border-color: #55555e; outline: 0;}
.up .drop.over{border-color: var(--blue); background: rgba(61,124,240,.08);}
.up .drop .ico{width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; background: #2c2c31; transition: transform .25s cubic-bezier(.3,1.4,.5,1), background-color .2s;}
.up .drop.over .ico{transform: translateY(-4px) scale(1.06); background: rgba(61,124,240,.2);}
.up .drop b{font-weight: 500; font-size: 15px;}
.up .drop b u{text-decoration: none; color: var(--blue-hi);}
.up .drop small{color: var(--dim); font: 400 11.5px/1.4 'JetBrains Mono', monospace;}
.up .drop-note{min-height: 16px; margin-top: 10px; text-align: center; font: 400 11.5px/1.3 'JetBrains Mono', monospace; color: var(--dim);}
.up .demo{border: 0; background: none; padding: 0; color: var(--blue-hi); cursor: pointer; font: inherit; text-decoration: underline; text-underline-offset: 3px;}
.up .row1{display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;}
.up .fname{display: flex; align-items: center; gap: 6px; min-width: 0; padding-bottom: 6px; color: var(--dim); font-size: 14px;}
.up .fname span{overflow: hidden; text-overflow: ellipsis; white-space: nowrap;}
.up .pct{font-size: 32px; font-weight: 400; letter-spacing: -.02em; font-variant-numeric: tabular-nums; line-height: 1;}
.up .segs{display: grid; grid-template-columns: repeat(24, 1fr); gap: 7px; height: 38px; margin: 16px 0 14px;}
.up .segs i{border-radius: 1.5px; background: var(--off); transition: background-color .2s, opacity .3s, transform .3s;}
.up .segs i.on{background: var(--blue);}
.up .segs i.edge{background: var(--blue-hi); animation: up-edge .6s ease-in-out infinite alternate;}
@keyframes up-edge{to { opacity: .55; }}
.up[data-s=checking] .segs i{animation: up-scan 1s ease-in-out infinite; background: var(--off-dim);}
@keyframes up-scan{50% { background: #55555e; }}
.up[data-s=paused] .segs i.on{background: #4d6aa8;}
.up[data-s=paused] .segs i:not(.on){background: #bcbcc2;}
.up[data-s=done] .segs i{background: var(--blue);}
.up .stats{display: flex; justify-content: space-between; gap: 12px; font: 400 12.5px/1 'JetBrains Mono', monospace; color: var(--blue-hi); font-variant-numeric: tabular-nums;}
.up .stats .r{display: flex; gap: 14px;}
.up .stats .eta{color: var(--dim);}
.up[data-s=paused] .stats{color: var(--dim);}
.up .actions{display: flex; gap: 8px; margin-top: 18px;}
.up .btn{flex: 1; height: 34px; border-radius: 9px; border: 1px solid #3a3a40; background: #1c1c1f; color: var(--text); font-size: 13px; cursor: pointer; transition: background-color .15s, border-color .15s, transform .1s;}
.up .btn:hover{background: #26262a; border-color: #4a4a52;}
.up .btn:active{transform: scale(.98);}
.up .btn.pri{background: var(--blue); border-color: var(--blue);}
.up .btn.pri:hover{background: #4f8bf7;}
.up .btn:focus-visible, .up .demo:focus-visible{outline: 2px solid var(--blue-hi); outline-offset: 2px;}
.up .btn[hidden]{display: none;}
.up .btn:disabled{opacity: .5; cursor: default;}
.up .done{display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center;}
.up .tick{width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; background: rgba(61,124,240,.18); box-shadow: 0 0 0 1px rgba(111,160,255,.25); animation: up-pop .4s cubic-bezier(.3,1.5,.5,1);}
@keyframes up-pop{from { transform: scale(.6); opacity: 0; }}
.up .tick path{stroke-dasharray: 24; stroke-dashoffset: 24; animation: up-draw .45s .1s cubic-bezier(.3,.8,.3,1) forwards;}
@keyframes up-draw{to { stroke-dashoffset: 0; }}
.up .done b{display: block; font-size: 15px; font-weight: 500;}
.up .done small{display: block; margin-top: 4px; color: var(--dim); font: 400 12px/1.4 'JetBrains Mono', monospace;}
.up .done .segs{grid-column: 1 / -1; margin: 6px 0 0; height: 10px;}
.up .done .segs i{animation: up-sweep .5s both;}
@keyframes up-sweep{from { opacity: .2; transform: scaleY(.4); }}
.up .err{display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center;}
.up .err .bang{width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,93,93,.14); color: var(--red); font-weight: 600; font-size: 20px;}
.up .err b{display: block; font-size: 15px; font-weight: 500;}
.up .err small{display: block; margin-top: 4px; color: var(--dim); font: 400 12px/1.4 'JetBrains Mono', monospace;}
.up[data-v=error] .panel{animation: up-shake .34s;}
@keyframes up-shake{25% { transform: translateX(-4px); } 75% { transform: translateX(4px); }}
@media (max-width: 420px){.up .segs{gap: 4px; height: 30px;}
.up .pct{font-size: 26px;}
.up-h{font-size: 17px;}}
@media (prefers-reduced-motion: reduce){.up, .up *, .up::before, .up *::before{animation: none !important; transition: none !important;}}
`;

// CSVs are often a few KB, which would read "0 MB"
const MB = (b: number) => (b && b < 104858 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1).replace(/\.0$/, '') + ' MB');
const SEGS = Array.from({ length: 24 }, (_, i) => i);
const LABEL: Record<State, string> = { ready: 'Ready', checking: 'Checking', uploading: 'Uploading', paused: 'Paused', finishing: 'Finishing', done: 'Complete', error: 'Failed', cancelled: 'Cancelled' };
const DEMO_NOTE = 'Demo file for the upload card. A real 50 MB archive would open here.';

const UpIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 15V3.5M7 8.5l5-5 5 5" /><path d="M4 14.5v4A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-4" /></svg>;
const ClipIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}><path d="m21 11.5-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2L9.8 17.5a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9" /></svg>;

export function UploadCard({ endpoint, headers, body, maxBytes = 50 * 1048576, accept, hint = 'Up to 50 MB · .zip .pdf .png .mp4', title = 'File Upload', demo = true, onComplete, onError, onCancel, className, style }: UploadCardProps) {
  const reduced = useReducedMotion();
  const [state, setState] = useState<State>('ready');
  const [view, setView] = useState<View>('drop');
  const [err, setErr] = useState<{ title: string; msg: string; retry: boolean } | null>(null);
  const [doneMeta, setDoneMeta] = useState('');
  const [sweepKey, setSweepKey] = useState(0);
  const [copied, setCopied] = useState('Copy link');
  const [over, setOver] = useState(false);
  const [, setFrame] = useState(0);
  const job = useRef<Job | null>(null), seq = useRef(0), raf = useRef(0), failedOnce = useRef(false), cancelTimer = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null), dropRef = useRef<HTMLDivElement>(null), pauseRef = useRef<HTMLButtonElement>(null), resumeRef = useRef<HTMLButtonElement>(null), retryRef = useRef<HTMLButtonElement>(null), backRef = useRef<HTMLButtonElement>(null);
  const cb = useRef({ endpoint, headers, body, maxBytes, onComplete, onError, onCancel });
  cb.current = { endpoint, headers, body, maxBytes, onComplete, onError, onCancel };

  const live = (id: number) => job.current?.id === id;
  const redraw = () => setFrame((f) => f + 1);
  const go = (s: State, v?: View) => { if (job.current) job.current.state = s; setState(s); if (v) setView(v); };

  /* ---------- engine ---------- */
  const fail = useCallback((t: string, msg: string, retry: boolean) => {
    cancelAnimationFrame(raf.current);
    if (job.current) job.current.state = 'error';
    setErr({ title: t, msg, retry }); setState('error'); setView('error');
    cb.current.onError?.(t, msg);
    requestAnimationFrame(() => (retry ? retryRef : backRef).current?.focus());
  }, []);

  const finish = useCallback(() => {
    const j = job.current!; const id = j.id;
    go('finishing');
    setTimeout(() => {
      if (!live(id)) return;
      const jj = job.current!;
      go('done', 'done');
      setDoneMeta(`${MB(jj.size)} · uploaded in ${((performance.now() - jj.t0) / 1000).toFixed(1)}s`);
      setSweepKey((k) => k + 1);
      if (jj.local) URL.revokeObjectURL(jj.local);
      jj.local = URL.createObjectURL(jj.file);           // the exact bytes that were uploaded
      cb.current.onComplete?.(jj.file, jj.remote, jj.reply);
    }, reduced ? 0 : 450);
  }, [reduced]);

  // simulated network: speed wanders between ~0.9 and 4.2 MB/s
  const tick = useCallback((now: number) => {
    const j = job.current; if (!j || j.state !== 'uploading') return;
    const dt = Math.min(0.1, (now - (j.last || now)) / 1000); j.last = now;
    j.target += (Math.random() - 0.5) * 0.25 * 1048576; j.target = Math.min(4.2, Math.max(0.9, j.target / 1048576)) * 1048576;
    j.rate += (j.target - j.rate) * Math.min(1, dt * 3);
    j.sent = Math.min(j.size, j.sent + j.rate * dt * (reduced ? 4 : 1) * j.boost);
    if (j.failAt && j.sent >= j.failAt) { j.failAt = 0; return fail('Connection lost', `Stopped at ${MB(j.sent)}. Your progress is kept — retry to continue.`, true); }
    redraw();
    if (j.sent >= j.size) return finish();
    raf.current = requestAnimationFrame(tick);
  }, [fail, finish, reduced]);

  // real network: POST with live progress. Progress is scaled to the file's bytes, whatever the body's encoding adds.
  const send = useCallback(() => {
    const j = job.current!; const id = j.id, xhr = new XMLHttpRequest(), { endpoint: url, headers: hs, body: build } = cb.current;
    j.xhr = xhr; j.sent = 0; j.rate = 0; let lastT = performance.now(), lastB = 0;
    xhr.upload.onprogress = (e) => {
      if (!live(id) || !e.lengthComputable) return;
      const loaded = (j.size * e.loaded) / e.total, now = performance.now(), dt = (now - lastT) / 1000;
      if (dt > 0.2) { const r = (loaded - lastB) / dt; j.rate = j.rate ? j.rate * 0.6 + r * 0.4 : r; lastT = now; lastB = loaded; }
      j.sent = Math.min(j.size, loaded); redraw();
    };
    xhr.onload = () => {
      if (!live(id)) return;
      let r: { url?: unknown; error?: { message?: unknown } } | null = null;
      try { r = JSON.parse(xhr.responseText || 'null'); } catch { /* plain-text reply is fine */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        if (r && typeof r.url === 'string') j.remote = r.url;
        j.reply = r; j.sent = j.size; redraw(); finish();
      } else {
        // the API's own message ("Import at most 500 rows…") beats a bare status code
        const m = r?.error?.message;
        fail('Upload failed', typeof m === 'string' && m ? m : `The server replied ${xhr.status}${xhr.statusText ? ' ' + xhr.statusText : ''}. Try again in a moment.`, true);
      }
    };
    xhr.onerror = () => { if (live(id)) fail('Connection lost', 'Couldn’t reach the server. Check your connection and retry.', true); };
    Promise.resolve()
      .then(() => { if (build) return build(j.file, j.name); const fd = new FormData(); fd.append('file', j.file, j.name); return fd; })
      .then((b) => {
        if (!live(id)) return;
        xhr.open('POST', url!);
        for (const [k, v] of Object.entries(hs ?? {})) xhr.setRequestHeader(k, v);
        xhr.send(b);
      }, () => { if (live(id)) fail('Upload failed', `Couldn’t read ${j.name}. Pick it again.`, false); });
  }, [fail, finish]);

  const abort = () => { const x = job.current?.xhr; if (x && x.readyState !== 4) { x.onload = x.onerror = null; x.abort(); } };

  const begin = useCallback(() => {
    const j = job.current!; j.last = 0; go('uploading', 'prog');
    if (j.real) send(); else raf.current = requestAnimationFrame(tick);
    redraw();
  }, [send, tick]);

  const start = useCallback((file: File | DemoFile) => {
    cancelAnimationFrame(raf.current); abort();
    const isDemo = 'demo' in file;
    if (!file.size && !isDemo) { job.current = null; return fail('Empty file', `${file.name} has no content to upload.`, false); }
    if (file.size > cb.current.maxBytes) { job.current = null; return fail('File too large', `${file.name} is ${MB(file.size)} — the limit is ${MB(cb.current.maxBytes)}.`, false); }
    const real = !!cb.current.endpoint && !isDemo;
    job.current = {
      id: ++seq.current, file: isDemo ? (file as DemoFile).blob : (file as File), name: file.name, size: file.size, sent: 0, rate: real ? 0 : 1.2 * 1048576, target: 1.6 * 1048576,
      state: 'checking', last: 0, boost: Math.max(1, file.size / (2.4 * 1048576) / 10), t0: performance.now(), real,
      failAt: isDemo && !failedOnce.current ? file.size * 0.42 : 0, remote: null, local: null, xhr: null, reply: null,
    };
    if (isDemo) failedOnce.current = true;
    setCopied('Copy link'); go('checking', 'prog');
    const id = job.current.id;
    setTimeout(() => { if (live(id) && job.current!.state === 'checking') begin(); }, reduced ? 0 : 700);
  }, [begin, fail, reduced]);

  /* ---------- controls ---------- */
  const pause = () => {
    const j = job.current; if (!j || j.state !== 'uploading' || j.real) return;
    cancelAnimationFrame(raf.current); go('paused'); redraw();
    requestAnimationFrame(() => resumeRef.current?.focus());
  };
  const resume = () => {
    const j = job.current; if (!j || j.state !== 'paused') return;
    j.last = 0; go('uploading'); raf.current = requestAnimationFrame(tick);
    requestAnimationFrame(() => pauseRef.current?.focus());
  };
  const cancel = () => {
    cancelAnimationFrame(raf.current); abort(); job.current = null;
    go('cancelled', 'drop'); cb.current.onCancel?.();
    clearTimeout(cancelTimer.current);
    cancelTimer.current = window.setTimeout(() => setState((s) => (s === 'cancelled' ? 'ready' : s)), 1800);
    requestAnimationFrame(() => dropRef.current?.focus());
  };
  const retry = () => { if (job.current) begin(); };
  const reset = () => {
    cancelAnimationFrame(raf.current); abort();
    if (job.current?.local) URL.revokeObjectURL(job.current.local);
    job.current = null; go('ready', 'drop');
    requestAnimationFrame(() => dropRef.current?.focus());
  };
  const pick = () => inputRef.current?.click();
  const tryDemo = () => start({ name: 'Project12_final_v2.zip', size: 50 * 1048576, blob: new Blob([DEMO_NOTE], { type: 'text/plain' }), demo: true });
  const openFile = () => { const u = job.current && (job.current.remote ?? job.current.local); if (u) window.open(u, '_blank', 'noopener'); };
  const copy = () => {
    const u = job.current?.remote; if (!u) return;
    const show = (t: string) => { setCopied(t); window.setTimeout(() => setCopied('Copy link'), 1300); };
    if (!navigator.clipboard) return show('Copy blocked');
    navigator.clipboard.writeText(u).then(() => show('Link copied'), () => show('Copy blocked'));
  };

  // unmount: stop the job (aborting a live request) and free the object URL
  useEffect(() => () => {
    cancelAnimationFrame(raf.current); abort(); clearTimeout(cancelTimer.current);
    if (job.current?.local) URL.revokeObjectURL(job.current.local);
    job.current = null;
  }, []);

  /* ---------- derived display ---------- */
  const j = job.current;
  const p = j && j.size ? j.sent / j.size : 0, on = Math.floor(p * 24);
  const pct = state === 'checking' ? '—' : Math.floor(p * 100) + '%';
  const speed = state === 'paused' ? 'Paused' : state === 'checking' ? 'Scanning…' : j?.rate ? ((j.rate * 8) / 1e6).toFixed(1) + 'Mbps' : '…';
  const eff = j ? j.rate * (j.real ? 1 : j.boost * (reduced ? 4 : 1)) : 0;   // bytes/s the bar really moves at
  const left = state === 'uploading' && j && eff ? Math.ceil((j.size - j.sent) / eff) : -1;
  const eta = left < 0 ? '' : left < 60 ? `${left}s left` : `${Math.floor(left / 60)}m ${left % 60}s left`;

  return (
    <section className={['up', className].filter(Boolean).join(' ')} data-s={state} data-v={view} aria-label={title} style={style}
      onPaste={(e) => { const f = e.clipboardData.files[0]; if (f && view === 'drop') { e.preventDefault(); start(f); } }}>
      <style>{CSS}</style>
      <div className="up-h"><UpIcon /><span>{title}</span><span className="state" aria-live="polite">{LABEL[state]}</span></div>
      <div className="panel">
        <div className="view v-drop">
          <div ref={dropRef} className={'drop' + (over ? ' over' : '')} role="button" tabIndex={0} aria-label={`Choose a file to upload. ${hint}`}
            onClick={pick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }}
            onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) start(f); }}>
            <span className="ico"><UpIcon /></span>
            <b>Drop a file here or <u>browse</u></b>
            <small>{hint}</small>
          </div>
          <div className="drop-note">
            {state === 'cancelled' ? 'Upload cancelled' : demo ? 'No file handy?' : ''}
            {demo && <>{state === 'cancelled' ? ' · ' : ' '}<button type="button" className="demo" onClick={tryDemo}>Try a demo file</button></>}
          </div>
          <input ref={inputRef} type="file" hidden accept={accept} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) start(f); }} />
        </div>
        <div className="view v-prog">
          <div className="row1">
            <div className="fname"><ClipIcon /><span>{j?.name}</span></div>
            <div className="pct">{pct}</div>
          </div>
          <div className="segs" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state === 'checking' ? undefined : Math.floor(p * 100)}>
            {SEGS.map((i) => <i key={i} className={i < on ? 'on' : i === on && state === 'uploading' && p < 1 ? 'edge' : undefined} />)}
          </div>
          <div className="stats">
            <span>{j ? `${MB(j.sent)} / ${MB(j.size)}` : ''}</span>
            <span className="r"><span className="eta">{eta}</span><span>{speed}</span></span>
          </div>
          <div className="actions">
            <button ref={pauseRef} type="button" className="btn" hidden={state === 'paused' || !!j?.real} disabled={state !== 'uploading'} onClick={pause}>Pause</button>
            <button ref={resumeRef} type="button" className="btn pri" hidden={state !== 'paused'} onClick={resume}>Resume</button>
            <button type="button" className="btn" onClick={cancel}>Cancel</button>
          </div>
        </div>
        <div className="view v-done">
          <div className="done">
            <span className="tick"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6fa0ff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>
            <span><b>{j?.name}</b><small>{doneMeta}</small></span>
            <div key={sweepKey} className="segs" aria-hidden>{SEGS.map((i) => <i key={i} style={{ animationDelay: i * 18 + 'ms' }} />)}</div>
          </div>
          <div className="actions">
            <button type="button" className="btn" onClick={openFile}>Open file</button>
            {j?.remote && <button type="button" className="btn" onClick={copy}>{copied}</button>}
            <button type="button" className="btn pri" onClick={reset}>Upload another</button>
          </div>
        </div>
        <div className="view v-error">
          <div className="err">
            <span className="bang" aria-hidden>!</span>
            <span role="alert"><b>{err?.title}</b><small>{err?.msg}</small></span>
          </div>
          <div className="actions">
            <button ref={backRef} type="button" className="btn" onClick={() => { reset(); pick(); }}>Choose another</button>
            {err?.retry && <button ref={retryRef} type="button" className="btn pri" onClick={retry}>Retry</button>}
          </div>
        </div>
      </div>
    </section>
  );
}
