import React, { useMemo, useRef, useState, useEffect } from 'react';
import { MousePointerClick, Pause, PartyPopper, Play, RotateCcw, RotateCw } from 'lucide-react';
import { Box, Scene3D, Tree, WindowGrid, prng, staticStates } from './Models3D.js';
import { useEmojiBurst } from './EmojiBurst.js';
import { useSpin } from './use-spin.js';
import { useInView } from '../../lib/use-in-view.js';
import { useReducedMotion } from '../../lib/use-reduced-motion.js';

/**
 * "Deal tower": every window is a buyer. Windows light up as an enquiry becomes qualified, books a visit and
 * books a unit. Click a window to book it yourself. Built from plain CSS 3D, draggable, keyboard operable and
 * pausable, and calm for visitors who prefer reduced motion. All people and units shown are fictional.
 */

const STAGES = [
  { label: 'Enquiry', key: 'new' },
  { label: 'Qualified', key: 'qualified' },
  { label: 'Site visit', key: 'site-visit' },
  { label: 'Booked', key: 'won' },
] as const;

const COLS = 4;
const FLOORS = 15;
const PER = COLS * FLOORS;
const TOTAL = PER * 4;
const W = 150;
const FLOOR_PX = 28;
const H = FLOORS * FLOOR_PX;
const WALL = 'color-mix(in srgb, var(--surface) 90%, var(--text))';

const initialStates = (): Uint8Array => {
  const r = prng(7);
  const a = new Uint8Array(TOTAL);
  for (let i = 0; i < TOTAL; i++) {
    const x = r();
    a[i] = x < 0.38 ? 0 : x < 0.62 ? 1 : x < 0.8 ? 2 : x < 0.92 ? 3 : 4;
  }
  return a;
};

const BHK = ['2 BHK', '3 BHK', '4 BHK', 'Plot'];
const AREA = ['Whitefield', 'Koramangala', 'Hebbal', 'HSR Layout', 'Indiranagar', 'Sarjapur'];
const NAMES = ['Aarav M.', 'Priya S.', 'Rohan M.', 'Neha K.', 'Vikram J.', 'Isha P.', 'Karan S.', 'Meera N.'];
const DAYS = ['Sat 11:00', 'Sun 10:30', 'Fri 4:00 pm', 'Sat 3:15 pm'];
const unitName = (i: number) => `${'ABCD'[Math.floor(i / PER) % 4]}-${String(Math.floor((i % PER) / COLS) + 1).padStart(2, '0')}0${(i % COLS) + 1}`;
const eventText = (stage: number, r: () => number): string => {
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
  if (stage === 1) return `${pick(NAMES)} asked about a ${pick(BHK)} in ${pick(AREA)}`;
  if (stage === 2) return `${pick(NAMES)} qualified · ₹${pick(['85 L', '1.2 Cr', '95 L', '2.4 Cr'])}`;
  if (stage === 3) return `${pick(NAMES)} booked a visit · ${pick(DAYS)}`;
  return `${pick(NAMES)} booked unit ${pick(['A', 'B', 'C'])}-${Math.floor(r() * 12 + 2)}0${Math.floor(r() * 4 + 1)}`;
};

interface FeedEvent {
  id: number;
  stage: number;
  text: string;
}

export const PipelineTower: React.FC = () => {
  const [states, setStates] = useState<Uint8Array>(initialStates);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [dancing, setDancing] = useState(false);
  const reduced = useReducedMotion();
  const [view, inView] = useInView<HTMLDivElement>();
  const { burst, burstFrom } = useEmojiBurst();

  const stage = useRef<HTMLDivElement>(null);
  const celebrateBtn = useRef<HTMLButtonElement>(null);
  const cur = useRef(states);
  const eventId = useRef(0);
  const rnd = useRef(prng(99));

  const running = inView && !paused && !reduced;
  const { rotate, spinUp, bind } = useSpin(stage, { initial: -32, speed: 0.16, tilt: 19, running });

  const small = useMemo(() => [staticStates(3 * 6 * 4, 3), staticStates(3 * 9 * 4, 5), staticStates(3 * 5 * 4, 11), staticStates(3 * 7 * 4, 17)], []);

  const pushEvent = (stage: number, text: string) => setEvents(ev => [{ id: ++eventId.current, stage, text }, ...ev].slice(0, 3));

  // Buyers move through the funnel
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const r = rnd.current;
      const next = cur.current.slice();
      let idx = Math.floor(r() * TOTAL);
      for (let tries = 0; tries < 12 && next[idx] === 4; tries++) idx = Math.floor(r() * TOTAL);
      if (next[idx] === 4) {
        // Tower is full: a new launch starts with a fresh set of windows
        for (let i = 0; i < TOTAL; i++) next[i] = r() < 0.2 ? 1 : 0;
      } else {
        // Later stages are rarer, so the building fills like a funnel
        const to = (next[idx] ?? 0) + 1;
        if (to >= 3 && r() < 0.45) return;
        next[idx] = to;
        pushEvent(to, eventText(to, r));
      }
      cur.current = next;
      setStates(next);
    }, 650);
    return () => window.clearInterval(id);
  }, [running]);

  const counts = useMemo(() => {
    const c = [0, 0, 0, 0];
    for (const s of states) for (let k = 1; k <= s; k++) c[k - 1]!++;
    return c;
  }, [states]);

  /** Books one window and celebrates. */
  const book = (index: number, at?: { x: number; y: number }) => {
    const next = cur.current.slice();
    next[index] = 4;
    cur.current = next;
    setStates(next);
    pushEvent(4, `You booked unit ${unitName(index)}`);
    setDancing(true);
    spinUp(3);
    if (at) burst({ x: at.x, y: at.y, set: 'party', count: 18, spread: 1.2 });
    else burstFrom(celebrateBtn.current, 'party', 20);
  };

  const onTap = (e: React.PointerEvent) => {
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const win = hit?.closest<HTMLElement>('.win[data-i]');
    if (win?.dataset.i !== undefined) {
      book(Number(win.dataset.i), { x: e.clientX, y: e.clientY });
      return;
    }
    setDancing(true);
    spinUp(2.5);
    burst({ x: e.clientX, y: e.clientY, set: 'tower', count: 12 });
  };

  const bookRandom = () => {
    const open = [];
    for (let i = 0; i < TOTAL; i++) if (cur.current[i] !== 4) open.push(i);
    const pick = open.length ? open[Math.floor(Math.random() * open.length)]! : 0;
    book(pick);
  };

  const grid = (n: number) => <WindowGrid states={states} offset={PER * n} cols={COLS} floors={FLOORS} interactive />;
  const smallGrid = (s: Uint8Array, cols: number, floors: number, n: number) => <WindowGrid states={s} offset={cols * floors * n} cols={cols} floors={floors} gap="6px 7px" pad="8px 9px" />;
  const block = (x: number, z: number, w: number, d: number, floors: number, s: Uint8Array) => (
    <Box
      key={`${x}${z}`}
      w={w}
      h={floors * FLOOR_PX}
      d={d}
      x={x}
      z={z}
      tone={WALL}
      faces={{ front: smallGrid(s, 3, floors, 0), back: smallGrid(s, 3, floors, 1), right: smallGrid(s, 3, floors, 2), left: smallGrid(s, 3, floors, 3) }}
    />
  );

  return (
    <div className="relative">
      <div
        ref={view}
        role="img"
        aria-label="A 3D apartment tower. Its windows light up as buyers move from enquiry to qualified, site visit and booked. Drag to turn it, or click a window to book it."
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'ArrowLeft') rotate(-12);
          if (e.key === 'ArrowRight') rotate(12);
        }}
        {...bind(onTap)}
        className="relative cursor-grab rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
      >
        <div aria-hidden className="tower-glow pointer-events-none absolute inset-x-0 bottom-0 h-3/4" />

        <Scene3D width={560} height={600} anchor={0.84} stageRef={stage} dancing={dancing} onDanceEnd={() => setDancing(false)}>
          <div className="tower-ground" />
          <Box w={198} h={12} d={198} tone="var(--m3d-concrete)" />
          <Box w={W} h={H} d={W} y={12} tone={WALL} faces={{ front: grid(0), back: grid(1), right: grid(2), left: grid(3) }} />
          {/* roof gear: tank, antenna and a blinking light */}
          <Box w={32} h={16} d={32} x={-34} y={12 + H} z={-30} tone="var(--m3d-concrete)" />
          <Box w={3} h={50} d={3} x={36} y={12 + H} z={34} tone="var(--m3d-concrete)" top={false} />
          <Box w={8} h={8} d={8} x={36} y={12 + H + 50} z={34} tone="#ff5a5a" className="m3d-led" />
          {block(-170, 90, 84, 84, 6, small[0]!)}
          {block(150, 110, 96, 90, 9, small[1]!)}
          {block(-150, -130, 80, 80, 5, small[2]!)}
          {block(170, -110, 90, 84, 7, small[3]!)}
          <Tree x={-118} z={-40} pine s={1.1} />
          <Tree x={110} z={-10} pine />
          <Tree x={60} z={150} s={0.9} />
          <Tree x={-60} z={140} pine s={0.9} />
        </Scene3D>

        <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-semibold text-text-muted shadow-sm">
          <MousePointerClick aria-hidden className="h-3.5 w-3.5 text-accent" />
          Click a window to book it
        </span>

        <ul aria-hidden className="pointer-events-none absolute left-2 top-3 hidden w-60 flex-col gap-2 md:flex">
          {events.map(ev => (
            <li key={ev.id} className="toast-in glass flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs shadow-float">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `var(--status-${STAGES[ev.stage - 1]!.key}-fg)` }} />
              <span className="font-medium text-text">{ev.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={() => rotate(-30)} aria-label="Rotate left" className="tower-btn"><RotateCcw aria-hidden className="h-4 w-4" /></button>
        <button type="button" onClick={() => setPaused(p => !p)} aria-pressed={paused} className="tower-btn px-3">
          {paused || reduced ? <Play aria-hidden className="h-4 w-4" /> : <Pause aria-hidden className="h-4 w-4" />}
          <span className="text-xs font-semibold">{paused ? 'Play' : 'Pause'}</span>
        </button>
        <button type="button" onClick={() => rotate(30)} aria-label="Rotate right" className="tower-btn"><RotateCw aria-hidden className="h-4 w-4" /></button>
        <button ref={celebrateBtn} type="button" onClick={bookRandom} className="tower-btn bg-accent px-3 text-on-accent hover:bg-accent-hover">
          <PartyPopper aria-hidden className="h-4 w-4" />
          <span className="text-xs font-semibold">Book a unit</span>
        </button>
      </div>

      <dl className="relative z-10 mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAGES.map((st, i) => (
          <div key={st.key} className="glass rounded-xl px-4 py-2.5">
            <dt className="flex items-center gap-2 text-xs font-medium text-text-muted">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--status-${st.key}-fg)` }} />
              {st.label}
            </dt>
            <dd className="mt-0.5 text-2xl font-bold tabular-nums text-text">{counts[i]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
