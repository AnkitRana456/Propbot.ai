/**
 * PricingTicket — a pricing plan as a ticket whose stub you tear off to claim it (React 18/19, no other deps).
 *  The ticket shows the plan (price, what you get, plan, seats, access) with a perforated stub on the right: the plan
 *  code, a code square and "Pull to claim". Drag the stub to the right and it rips along the perforation from the top
 *  down: it hinges on its bottom corner, the jagged paper edges open up, the ticket tugs back and every hole that gives
 *  clicks. Pull it past the end (or flick it) and the last bit snaps: a few paper bits drop, the ticket jolts and the
 *  stub flies off with a spin and gravity. Let go early and it springs back. A tap or Enter tears it in one pull.
 *  Torn: the ticket keeps its ripped edge, slides to the centre, a "Claimed" badge pops in, and "Print another" / the
 *  CTA appear; "Print another" feeds a fresh stub back in. Pills switch plans.
 *  PropBot: plans always come from the caller, a `current` plan's stub can't be torn, the date is this month, and the
 *  CTA shows once the plan has an `href` (e.g. a payment link that arrives after the claim).
 * Kit-ready: the CSS lives in this file (scoped under .pt) and starts with a small kit-shield block.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPE } from 'react';

export type Plan = { id: string; name: string; code: string; price: string; priceLabel: string; to: string; toLabel: string; plan: string; seats: string; access: string; cta: string; href: string; current?: boolean };

export type PricingTicketProps = {
  plans: Plan[];
  /** the plan shown first */
  start?: string;
  /** called when a stub is torn off */
  onClaim?: (plan: Plan) => void;
  /** a soft paper sound while tearing (made in the browser, no files) */
  sound?: boolean;
  /** the page around the ticket */
  backdrop?: boolean;
  /** the page colour (it also shows through the perforation holes), '#fff' */
  page?: string;
  loadFont?: boolean;
  className?: string;
  style?: CSSProperties;
};

const CSS = `/* kit-shield: undo Tailwind preflight inside the component (Kit) */
:where(.pt) { line-height: normal; color: CanvasText; tab-size: 8; font-feature-settings: normal; font-variation-settings: normal; -webkit-text-size-adjust: auto; -webkit-tap-highlight-color: initial; }
:where(.pt) :where(*), :where(.pt) :where(*)::before, :where(.pt) :where(*)::after { box-sizing: revert; margin: revert; padding: revert; border-width: revert; border-style: revert; border-color: revert; outline-color: revert; }
:where(.pt) :where(ol, ul, menu) { list-style: revert; }
:where(.pt) :where(h1, h2, h3, h4, h5, h6) { font-size: revert; font-weight: revert; }
:where(.pt) :where(a) { color: revert; text-decoration: revert; }
:where(.pt) :where(b, strong) { font-weight: revert; }
:where(.pt) :where(small, sub, sup) { font-size: revert; }
:where(.pt) :where(code, kbd, samp, pre) { font-family: revert; font-size: revert; font-feature-settings: revert; font-variation-settings: revert; }
:where(.pt) :where(img, svg, video, canvas, audio, iframe, embed, object) { display: revert; vertical-align: revert; }
:where(.pt) :where(img, video) { max-width: revert; height: revert; }
:where(.pt) :where(button, input, select, optgroup, textarea) { font: revert; letter-spacing: revert; color: revert; border-radius: revert; background-color: revert; opacity: revert; }
:where(.pt) :where(button, input[type="button"], input[type="reset"], input[type="submit"]) { appearance: revert; }
:where(.pt) :where(textarea) { resize: revert; }
:where(.pt) :where(table) { text-indent: revert; border-color: revert; border-collapse: revert; }
:where(.pt) :where(summary) { display: revert; }
:where(.pt) ::placeholder { color: revert; opacity: revert; }

.pt{--page:#fff;--card:#1c1c1d;--stub:#262628;--ink:#f4f4f5;--mute:#7a7a80;--line:#3a3a3d;position:relative;width:100%;font-family:'Inter Tight',Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;color:var(--ink);box-sizing:border-box;overflow:hidden;user-select:none;-webkit-user-select:none}
.pt *,.pt *::before,.pt *::after{box-sizing:border-box}
:where(.pt) button,:where(.pt) a{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;text-decoration:none}
.pt.bd{background:var(--page);min-height:100vh;display:grid;place-items:center;padding:24px 16px}
.pt-col{display:flex;flex-direction:column;align-items:center;gap:22px}
.pt-pills{display:flex;gap:4px;padding:4px;border-radius:999px;background:#f2f2f3;border:1px solid #e8e8ea}
.pt-pill{height:30px;padding:0 14px;border-radius:999px;font-size:13px;color:#77777d;transition:background .2s,color .2s}
.pt-pill:hover{color:#111}
.pt-pill.on{background:#1c1c1d;color:#fff}
.pt-stage{position:relative;width:var(--tw);height:var(--th)}
.pt-tk{position:absolute;left:0;top:0;width:100%;height:100%;transition:transform .55s cubic-bezier(.2,.8,.2,1)}
.pt-main{position:absolute;left:0;top:0;width:var(--mw);height:100%;padding:calc(var(--s) * .05) calc(var(--s) * .06);background:var(--card);border-radius:calc(var(--s) * .035) 0 0 calc(var(--s) * .035);display:flex;flex-direction:column;justify-content:space-between;transform-origin:0 50%}
.pt-top{display:flex;justify-content:space-between;align-items:center;font-size:calc(var(--s) * .028);font-weight:500;min-height:calc(var(--s) * .05)}
.pt-top span:last-child{color:var(--mute);font-weight:400}
.pt-badge{display:inline-flex;align-items:center;gap:6px;height:calc(var(--s) * .05);padding:0 calc(var(--s) * .022);border-radius:999px;background:#fff;color:#111;font-size:calc(var(--s) * .026);font-weight:500;animation:pt-pop .45s cubic-bezier(.2,.9,.25,1.2)}
.pt-badge svg{width:calc(var(--s) * .028);height:calc(var(--s) * .028)}
@keyframes pt-pop{from{opacity:0;transform:scale(.6);filter:blur(4px)}to{opacity:1;transform:none;filter:none}}
.pt-route{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:calc(var(--s) * .03)}
.pt-route b{display:block;font-weight:500;font-size:calc(var(--s) * .072);letter-spacing:-.02em;line-height:1}
.pt-route small{display:block;margin-top:calc(var(--s) * .012);font-size:calc(var(--s) * .024);color:var(--mute)}
.pt-route .r{text-align:right}
.pt-mid{position:relative;height:1px;background:var(--line);margin-top:calc(var(--s) * -.03)}
.pt-mid svg{position:absolute;left:50%;top:50%;width:calc(var(--s) * .04);height:calc(var(--s) * .04);transform:translate(-50%,-50%);color:#8d8d93;background:var(--card);padding:0 4px;box-sizing:content-box}
.pt-meta{display:grid;grid-template-columns:1fr auto auto;gap:calc(var(--s) * .07)}
.pt-meta div:nth-child(2){text-align:center}.pt-meta div:last-child{text-align:right}
.pt-meta small{display:block;font-size:calc(var(--s) * .022);color:var(--mute)}
.pt-meta b{display:block;margin-top:calc(var(--s) * .008);font-weight:500;font-size:calc(var(--s) * .03)}
.pt-swap{animation:pt-in .4s cubic-bezier(.2,.8,.2,1)}
@keyframes pt-in{from{opacity:0;filter:blur(4px);transform:translateY(4px)}to{opacity:1;filter:none;transform:none}}
.pt-stub{position:absolute;top:0;height:100%;padding:calc(var(--s) * .035) calc(var(--s) * .024) calc(var(--s) * .03) calc(var(--s) * .024 + var(--j));border-radius:0 calc(var(--s) * .035) calc(var(--s) * .035) 0;background:var(--stub);display:flex;flex-direction:column;align-items:center;justify-content:space-between;cursor:grab;touch-action:none;transform-origin:var(--j) 100%;outline:none;z-index:3;transition:background .2s;will-change:transform}
.pt-stub:hover{background:#2e2e31}
.pt-stub:active{cursor:grabbing}
.pt-stub[aria-disabled=true]{cursor:default}
/* the perforation: a row of small holes just inside the stub's edge */
.pt-perf{position:absolute;left:calc(var(--j) + 2px);top:calc(var(--s) * .03);bottom:calc(var(--s) * .03);width:2px;background:radial-gradient(circle,var(--page) 0 1px,transparent 1.3px) 0 0/2px 7px repeat-y;opacity:.85;pointer-events:none}
.pt-stub small{font-size:calc(var(--s) * .022);color:var(--mute)}
.pt-stub b{display:block;margin-top:2px;font-weight:600;font-size:calc(var(--s) * .046);letter-spacing:-.01em;line-height:1;text-align:center}
.pt-qr{width:78%;aspect-ratio:1;border-radius:4px;background:#fff;padding:5%}
.pt-qr svg{width:100%;height:100%;display:block}
.pt-pull{font-size:calc(var(--s) * .022);color:#8d8d93;white-space:nowrap;transition:color .2s}
.pt-stub:hover .pt-pull,.pt-stub:focus-visible .pt-pull{color:#fff}
.pt-stub:focus-visible{background:#2e2e31}
.pt-bit{position:absolute;width:3px;height:2px;border-radius:.5px;pointer-events:none;z-index:4}
.pt-acts{display:flex;gap:8px;height:34px}
.pt-b{height:34px;padding:0 16px;border-radius:999px;background:#fff;border:1px solid #e3e3e6!important;font-size:13px;color:#3a3a3e;display:inline-flex;align-items:center;gap:6px;animation:pt-in .4s cubic-bezier(.2,.8,.2,1) both;transition:background .15s,color .15s}
.pt-b:hover{background:#f4f4f5;color:#111}
.pt-b.go{background:#1c1c1d;color:#fff;border-color:#1c1c1d!important}
.pt-b.go:hover{background:#2f45e0;border-color:#2f45e0!important;color:#fff}
.pt-b svg{width:13px;height:13px}
.pt :focus-visible{outline:2px solid #2f45e0;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.pt *{animation:none!important;transition:none!important}}
`;

// a fixed code square (not a real QR): three finder squares and a seeded field
function Code({ seed }: { seed: string }) {
  const N = 21; let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  const rnd = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
  const finder = (x: number, y: number) => x < 8 && y < 8 || x > N - 9 && y < 8 || x < 8 && y > N - 9;
  const cells: string[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!finder(x, y) && rnd() > .52) cells.push(`M${x} ${y}h1v1h-1z`);
  const fp = (x: number, y: number) => `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`;
  return <svg viewBox={`0 0 ${N} ${N}`} shapeRendering="crispEdges" aria-hidden><path d={fp(0, 0) + fp(N - 7, 0) + fp(0, N - 7)} fill="#111" fillRule="evenodd" /><path d={cells.join('')} fill="#111" /></svg>;
}
const Spark = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18" /></svg>;
const Tick = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const Arrow = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

// the ripped seam: one seeded jagged line shared by both pieces (so they fit together), with a half-round notch
// at the top and bottom. Returns clip-paths for the ticket (left of the line) and the stub (right of it).
function seam(MW: number, H: number, J: number, R: number, seed: number) {
  let h = seed * 7919 + 17; const rnd = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
  const cx = MW - J / 2, pts: [number, number][] = [];
  for (let y = R; y < H - R; y += 2.6) {
    const big = rnd() > .86 ? (rnd() - .5) * J * .9 : 0;   // now and then a deeper fibre
    pts.push([cx + (rnd() - .5) * J * .55 + big, y]);
  }
  pts.push([cx, H - R]);
  const arc = (a0: number, a1: number, cy: number) => { const o: [number, number][] = []; for (let i = 0; i <= 8; i++) { const a = a0 + (a1 - a0) * i / 8; o.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); } return o; };
  const f = (p: [number, number][], dx: number) => p.map(([x, y]) => `${(x - dx).toFixed(1)}px ${y.toFixed(1)}px`).join(',');
  // ticket: down its left, along the top to the notch, round the notch, down the jagged line, round the bottom notch
  const main = `polygon(0 0,${f(arc(Math.PI, Math.PI / 2, 0), 0)},${f(pts, 0)},${f(arc(-Math.PI / 2, -Math.PI, H), 0)},0 ${H}px)`;
  const ox = MW - J;   // the stub's own left edge in ticket space
  const stub = `polygon(100% 0,100% 100%,${f(arc(0, -Math.PI / 2, H), ox)},${f(pts.slice().reverse(), ox)},${f(arc(Math.PI / 2, 0, 0), ox)})`;
  return { main, stub };
}

// a soft paper sound: short bursts of filtered noise (a click per hole, a rip when it snaps)
function useSound(on: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  const wake = () => { if (!on || ctx.current) return; try { const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; ctx.current = new C(); } catch { /* no audio */ } };
  const burst = (ms: number, freq: number, vol: number, crackle: boolean) => {
    const c = ctx.current; if (!on || !c) return;
    const n = Math.round(c.sampleRate * ms / 1000), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { const t = i / n, env = crackle ? (1 - t) ** 1.6 * (Math.random() > .82 ? 1 : .25) : (1 - t) ** 3; d[i] = (Math.random() * 2 - 1) * env; }
    const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = .8; g.gain.value = vol;
    src.buffer = buf; src.connect(bp); bp.connect(g); g.connect(c.destination); src.start();
  };
  return { wake, tick: () => burst(18, 3200 + Math.random() * 1400, .05, false), rip: () => burst(230, 2100, .11, true) };
}

export default function PricingTicket({ plans, start, onClaim, sound = true, backdrop = true, page = '#fff', loadFont = true, className, style }: PricingTicketProps) {
  const [pid, setPid] = useState(start && plans.some((p) => p.id === start) ? start : plans[0]!.id);
  const [torn, setTorn] = useState(false);
  const [gen, setGen] = useState(0);             // bumps on "Print another" so a fresh stub slides in
  const [W, setW] = useState(560);
  const rootRef = useRef<HTMLDivElement>(null), stubRef = useRef<HTMLDivElement>(null), mainRef = useRef<HTMLDivElement>(null), tkRef = useRef<HTMLDivElement>(null);
  const st = useRef({ drag: false, x0: 0, dx: 0, p: 0, vx: 0, lt: 0, lx: 0, raf: 0, flying: false, holes: 0, jit: 0 });
  const plan = plans.find((p) => p.id === pid) || plans[0]!;
  const onClaimRef = useRef(onClaim); onClaimRef.current = onClaim;
  const snd = useSound(sound);

  useEffect(() => {
    if (!loadFont || document.getElementById('pt-fonts')) return;
    const l = document.createElement('link'); l.id = 'pt-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap'; document.head.appendChild(l);
  }, [loadFont]);
  // the ticket scales to the width it gets (max 560); embedded (no backdrop), the host page owns the gutters and 6px a
  // side is left for the jolt
  useEffect(() => {
    const r = rootRef.current; if (!r) return;
    const fit = () => setW(Math.max(260, Math.min(560, r.clientWidth - (backdrop ? 32 : 12))));
    fit(); const ro = new ResizeObserver(fit); ro.observe(r); return () => ro.disconnect();
  }, [backdrop]);

  const S = W, MW = Math.round(S * .78), SW = S - MW, H = Math.round(S * .43), J = Math.max(4, Math.round(S * .009)), R = Math.round(S * .022);
  const clip = useMemo(() => seam(MW, H, J, R, gen + 1), [MW, H, J, R, gen]);
  const PULL = SW * 1.15;   // how far the pointer travels to rip the whole perforation

  // p = how much of the perforation has given way (0..1). The stub hinges on its bottom corner, so the gap opens from
  // the top down; the ticket leans a little towards the pull.
  const place = (p: number, jit = 0) => {
    const el = stubRef.current, m = mainRef.current;
    if (el) el.style.transform = `translateX(${p * 3}px) rotate(${p * 17 + jit}deg)`;
    if (m) m.style.transform = p ? `translateX(${p * 5}px) rotate(${p * .7}deg)` : '';
  };

  const bits = () => {
    const tk = tkRef.current; if (!tk || !tk.animate) return;
    for (let i = 0; i < 9; i++) {
      const b = document.createElement('span'); b.className = 'pt-bit';
      b.style.left = MW - J / 2 + 'px'; b.style.top = H - R - Math.random() * H * .35 + 'px'; b.style.background = i % 3 ? '#2a2a2d' : '#5c5c62';
      tk.appendChild(b);
      const dx = 10 + Math.random() * 40, dy = 50 + Math.random() * 90, r = (Math.random() - .5) * 720;
      b.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx * .5}px,${-8 - Math.random() * 12}px) rotate(${r * .4}deg)`, opacity: 1, offset: .25 }, { transform: `translate(${dx}px,${dy}px) rotate(${r}deg)`, opacity: 0 }],
        { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.3,0,.7,1)' }).onfinish = () => b.remove();
    }
  };

  // the last fibres give: paper bits drop, the ticket jolts, and the stub flies off with gravity and spin
  const snap = useCallback((vx = 700) => {
    const s = st.current; if (s.flying) return; s.flying = true; s.drag = false; cancelAnimationFrame(s.raf);
    snd.rip(); bits();
    const m = mainRef.current;
    if (m) { m.style.transform = ''; m.animate?.([{ transform: 'translateX(-6px) rotate(-.9deg)' }, { transform: 'translateX(3px) rotate(.35deg)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.7,.3,1)' }); }
    const reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const vr = 150 + vx * .1;
    let x = 3, y = 0, rot = 17, vy = -340, last = performance.now();
    vx = Math.max(520, Math.min(1600, vx));
    const lim = (window.innerHeight || 900) + 200;
    const fly = (now: number) => {
      const dt = Math.min(.04, (now - last) / 1000); last = now;
      vy += 2400 * dt; x += vx * dt; y += vy * dt; rot += vr * dt; vx *= .995;
      const el = stubRef.current; if (el) el.style.transform = `translate(${x}px,${y}px) rotate(${rot}deg)`;
      if (y < lim && !reduced) s.raf = requestAnimationFrame(fly);
      else { s.flying = false; s.p = 0; setTorn(true); onClaimRef.current?.(plan); }
    };
    s.raf = requestAnimationFrame(fly);
  }, [plan, snd, MW, H, J, R]);

  // set how far it has torn: a click for each hole that gives, a little catch as the fibres go
  const setP = (p: number) => {
    const s = st.current, holes = Math.floor(p * 16);
    if (holes > s.holes) { snd.tick(); s.jit = (Math.random() - .5) * 1.1; } else s.jit *= .8;
    s.holes = holes; s.p = p; place(p, s.jit * p);
  };

  const down = (e: RPE) => {
    if (torn || plan.current) return; const s = st.current; if (s.flying) return;
    snd.wake(); cancelAnimationFrame(s.raf);
    s.drag = true; s.x0 = e.clientX - s.dx; s.lt = performance.now(); s.lx = e.clientX; s.vx = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: RPE) => {
    const s = st.current; if (!s.drag) return;
    s.dx = Math.max(0, e.clientX - s.x0);
    const now = performance.now(), dt = Math.max(1, now - s.lt); s.vx = s.vx * .6 + (e.clientX - s.lx) / dt * 1000 * .4; s.lt = now; s.lx = e.clientX;
    // the paper holds for the first few px, then gives hole by hole
    const raw = s.dx / PULL, p = raw < .06 ? 0 : Math.min(1, (raw - .06) / .94);
    setP(p);
    if (p >= 1) snap(s.vx);
  };
  const springBack = () => {
    const s = st.current; let p = s.p, v = 0, last = performance.now();
    const back = (now: number) => {
      const dt = Math.min(.04, (now - last) / 1000); last = now;
      v += (-p * 300 - v * 20) * dt; p += v * dt; s.p = Math.max(-.04, p); place(s.p);
      if (Math.abs(p) > .002 || Math.abs(v) > .02) s.raf = requestAnimationFrame(back); else { s.p = 0; s.holes = 0; place(0); }
    };
    s.raf = requestAnimationFrame(back);
  };
  // one steady pull for a tap or a key
  const autoTear = () => {
    const s = st.current; if (s.flying || torn || plan.current) return; snd.wake(); cancelAnimationFrame(s.raf);
    const t0 = performance.now(), D = 520;
    const run = (now: number) => {
      const k = Math.min(1, (now - t0) / D); setP(k * k * (1.6 - .6 * k));
      if (k < 1) s.raf = requestAnimationFrame(run); else snap(900);
    };
    s.raf = requestAnimationFrame(run);
  };
  const up = () => {
    const s = st.current; if (!s.drag) return; s.drag = false;
    if (s.dx < 4) { s.dx = 0; autoTear(); return; }                       // a tap
    s.dx = 0;
    if (s.p > .62 || (s.vx > 900 && s.p > .15)) { snap(s.vx); return; }   // far enough, or flicked
    springBack();
  };

  const reprint = () => { const s = st.current; cancelAnimationFrame(s.raf); s.dx = 0; s.p = 0; s.holes = 0; s.flying = false; setTorn(false); setGen((g) => g + 1); };
  // a fresh stub feeds in from the right
  useEffect(() => {
    const el = stubRef.current; if (!el || torn) return;
    el.style.transition = 'none'; el.style.transform = gen ? `translateX(${SW * .9}px)` : ''; el.style.opacity = gen ? '0' : '1';
    if (!gen) return;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = 'transform .55s cubic-bezier(.2,.8,.2,1),opacity .35s,background .2s'; el.style.transform = ''; el.style.opacity = '1'; setTimeout(() => { if (el) el.style.transition = ''; }, 600); }));
  }, [gen, torn, SW]);
  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);

  const switchPlan = (id: string) => { if (id === pid) return; setPid(id); if (torn) reprint(); };

  return (
    <div ref={rootRef} className={['pt', backdrop ? 'bd' : '', className].filter(Boolean).join(' ')} style={{ ['--page' as string]: page, ...style } as CSSProperties}>
      <style>{CSS}</style>
      <div className="pt-col">
        <div className="pt-pills" role="tablist" aria-label="Plans">
          {plans.map((p) => <button key={p.id} role="tab" aria-selected={p.id === pid} className={'pt-pill' + (p.id === pid ? ' on' : '')} onClick={() => switchPlan(p.id)}>{p.name}</button>)}
        </div>
        <div className="pt-stage" style={{ ['--s' as string]: S + 'px', ['--tw' as string]: S + 'px', ['--th' as string]: H + 'px', ['--mw' as string]: MW + 'px', ['--j' as string]: J + 'px' } as CSSProperties}>
          <div ref={tkRef} className="pt-tk" style={{ transform: torn ? `translateX(${SW / 2}px)` : 'none' }}>
            <div ref={mainRef} className="pt-main" style={{ clipPath: clip.main, WebkitClipPath: clip.main }}>
              <div className="pt-top"><span>{plan.plan.toUpperCase()}</span>{torn ? <span className="pt-badge"><Tick />Claimed</span> : <span>{new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}</div>
              <div key={pid} className="pt-swap">
                <div className="pt-route">
                  <div><b>{plan.price}</b><small>{plan.priceLabel}</small></div>
                  <div className="pt-mid"><Spark /></div>
                  <div className="r"><b>{plan.to}</b><small>{plan.toLabel}</small></div>
                </div>
              </div>
              <div key={'m' + pid} className="pt-meta pt-swap">
                <div><small>Plan</small><b>{plan.plan}</b></div>
                <div><small>Seats</small><b>{plan.seats}</b></div>
                <div><small>Access</small><b>{plan.access}</b></div>
              </div>
            </div>
            {!torn && (
              <div key={'s' + gen} ref={stubRef} className="pt-stub" style={{ left: MW - J, width: SW + J, clipPath: clip.stub, WebkitClipPath: clip.stub }} role="button" tabIndex={0}
                aria-label={plan.current ? `${plan.plan} is your current plan` : `Pull to claim ${plan.plan}`} aria-disabled={plan.current || undefined}
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); autoTear(); } }}>
                <span className="pt-perf" aria-hidden />
                <div style={{ textAlign: 'center' }}><small>Plan</small><b>{plan.code}</b></div>
                <div className="pt-qr"><Code seed={plan.id + gen} /></div>
                <span className="pt-pull">{plan.current ? 'Your plan' : 'Pull to claim'}</span>
              </div>
            )}
          </div>
        </div>
        <div className="pt-acts" aria-live="polite">
          {torn && <><button className="pt-b" onClick={reprint}>Print another</button>{plan.href && <a className="pt-b go" href={plan.href} target="_blank" rel="noopener" style={{ animationDelay: '.08s' }}>{plan.cta}<Arrow /></a>}</>}
        </div>
      </div>
    </div>
  );
}
