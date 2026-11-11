import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../../lib/use-reduced-motion.js';
import { Glyph, type GlyphName } from './icons.js';

/** Confetti families for the different parts of the page: small line icons, never emoji. */
export const EMOJI_SETS = {
  party: ['key', 'spark', 'tile', 'check'],
  home: ['key', 'tile', 'spark'],
  tower: ['tile', 'key', 'spark'],
  land: ['pin', 'spark', 'check'],
  shop: ['bag', 'coin', 'spark'],
  money: ['coin', 'spark', 'check'],
  chat: ['chat', 'spark', 'check'],
  calendar: ['cal', 'check', 'spark'],
  spark: ['spark'],
} as const satisfies Record<string, readonly GlyphName[]>;
export type EmojiSet = keyof typeof EMOJI_SETS;

export interface BurstOptions {
  /** Viewport coordinates of the burst centre. */
  x: number;
  y: number;
  set?: EmojiSet | readonly string[];
  count?: number;
  /** 1 is a small pop, 2 fills a good part of the screen. */
  spread?: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  emoji: GlyphName;
  brass: boolean;
  dx: number;
  dy: number;
  dur: number;
  delay: number;
  size: number;
  beat: number;
}

interface BurstApi {
  burst: (o: BurstOptions) => void;
  /** Bursts from the middle of an element (for keyboard users, who have no pointer position). */
  burstFrom: (el: Element | null, set?: EmojiSet | readonly string[], count?: number) => void;
}

const Ctx = createContext<BurstApi>({ burst: () => undefined, burstFrom: () => undefined });
export const useEmojiBurst = (): BurstApi => useContext(Ctx);

const MAX_PARTICLES = 90;

const pickSet = (set: BurstOptions['set']): readonly string[] => (Array.isArray(set) ? set : EMOJI_SETS[(set as EmojiSet) ?? 'party'] ?? EMOJI_SETS.party);

/**
 * Renders a full-screen layer where small icons fly out of a click, turn in 3D and flutter as they fall.
 * Also lets any element opt in with data-burst="party" (or a set name). Does nothing for visitors who
 * ask their system for reduced motion.
 */
export const EmojiBurstProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const reduced = useReducedMotion();
  const [particles, setParticles] = useState<Particle[]>([]);
  const nextId = useRef(1);

  const burst = useCallback(
    ({ x, y, set = 'party', count = 14, spread = 1 }: BurstOptions) => {
      if (reduced || typeof window === 'undefined') return;
      const pool = pickSet(set);
      const made: Particle[] = Array.from({ length: count }, (_, i) => {
        const emoji = (pool[Math.floor(Math.random() * pool.length)] ?? 'spark') as GlyphName;
        // fan upwards, a little sideways, with some variation in how far each one flies
        const angle = -Math.PI * (0.08 + 0.84 * Math.random());
        const dist = (90 + Math.random() * 190) * spread;
        return {
          id: nextId.current++,
          x,
          y,
          emoji,
          brass: Math.random() < 0.4,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          dur: 1500 + Math.random() * 1000,
          delay: i * 18 + Math.random() * 120,
          size: 14 + Math.random() * 12,
          beat: 0.34 + Math.random() * 0.34,
        };
      });
      setParticles(prev => [...prev, ...made].slice(-MAX_PARTICLES));
    },
    [reduced],
  );

  const burstFrom = useCallback<BurstApi['burstFrom']>(
    (el, set = 'party', count = 16) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      burst({ x: r.left + r.width / 2, y: r.top + r.height / 2, set, count, spread: 1.15 });
    },
    [burst],
  );

  // Any element can ask for a burst: <button data-burst="home">
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target.closest('[data-burst]') : null;
      if (!target) return;
      const name = target.getAttribute('data-burst') ?? 'party';
      const set = name in EMOJI_SETS ? (name as EmojiSet) : name.split(',');
      const keyboard = e.clientX === 0 && e.clientY === 0;
      if (keyboard) burstFrom(target, set, 12);
      else burst({ x: e.clientX, y: e.clientY, set, count: 12 });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [burst, burstFrom]);

  const api = useMemo<BurstApi>(() => ({ burst, burstFrom }), [burst, burstFrom]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="emoji-layer" aria-hidden>
            {particles.map(p => (
              <span
                key={p.id}
                className="emoji-p"
                style={
                  {
                    left: p.x,
                    top: p.y,
                    color: p.brass ? 'var(--brass)' : 'var(--accent)',
                    '--dx': `${p.dx}px`,
                    '--dy': `${p.dy}px`,
                    '--dur': `${p.dur}ms`,
                    '--delay': `${p.delay}ms`,
                    '--beat': `${p.beat}s`,
                  } as React.CSSProperties
                }
                onAnimationEnd={e => {
                  if (e.target === e.currentTarget) setParticles(prev => prev.filter(q => q.id !== p.id));
                }}
              >
                <span className="emoji-dance">
                  <Glyph name={p.emoji} size={p.size} />
                </span>
              </span>
            ))}
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
};
