import React, { useEffect, useRef, useState } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { EASE } from './motion.js';
import { useInView } from '../../lib/use-in-view.js';
import { useReducedMotion } from '../../lib/use-reduced-motion.js';

const COLS = ['New', 'Qualified', 'Site visit', 'Booked'] as const;

interface Card {
  id: number;
  name: string;
  want: string;
  col: number;
  fresh?: boolean;
}

const START: Card[] = [
  { id: 1, name: 'Aarav M.', want: '2 BHK · ₹85 L', col: 0 },
  { id: 2, name: 'Isha P.', want: 'Plot · ₹60 L', col: 0 },
  { id: 3, name: 'Priya S.', want: '3 BHK · ₹1.2 Cr', col: 1 },
  { id: 4, name: 'Rohan M.', want: 'Villa · ₹2.4 Cr', col: 1 },
  { id: 5, name: 'Neha K.', want: '3 BHK · ₹1.1 Cr', col: 2 },
  { id: 6, name: 'Vikram J.', want: '4 BHK · ₹1.9 Cr', col: 3 },
];
const INCOMING = [
  ['Karan S.', '2 BHK · ₹92 L'],
  ['Meera N.', '3 BHK · ₹1.3 Cr'],
  ['Dev R.', 'Shop · ₹75 L'],
] as const;

/**
 * A working slice of the pipeline: drag a buyer between columns (or focus a card and use the arrow keys).
 * New leads arrive on their own and glow brass for a moment. All people are made up.
 */
export const PipelineBoard: React.FC = () => {
  const [cards, setCards] = useState<Card[]>(START);
  const cols = useRef<Array<HTMLDivElement | null>>([]);
  const next = useRef(0);
  const reduced = useReducedMotion();
  const [view, inView] = useInView<HTMLDivElement>();

  // A new lead lands in "New" every few seconds while the board is on screen
  useEffect(() => {
    if (!inView || reduced) return;
    const id = window.setInterval(() => {
      const [name, want] = INCOMING[next.current++ % INCOMING.length]!;
      setCards(cs => {
        const kept = cs.length >= 9 ? cs.filter(c => c !== cs.find(x => x.col === 3)) : cs;
        return [{ id: Date.now(), name, want, col: 0, fresh: true }, ...kept.map(c => ({ ...c, fresh: false }))];
      });
    }, 5200);
    return () => window.clearInterval(id);
  }, [inView, reduced]);

  const move = (id: number, col: number) => setCards(cs => cs.map(c => (c.id === id ? { ...c, col: Math.max(0, Math.min(COLS.length - 1, col)), fresh: false } : c)));

  const drop = (id: number, x: number) => {
    const hit = cols.current.findIndex(el => {
      const r = el?.getBoundingClientRect();
      return r && x >= r.left && x <= r.right;
    });
    if (hit >= 0) move(id, hit);
  };

  return (
    <div ref={view} className="bg-bg p-3 sm:p-5" data-cursor="Drag">
      <p className="mk-mono mb-3 text-text-muted">Pipeline · drag a buyer to the next stage</p>
      <LayoutGroup>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {COLS.map((col, ci) => (
            <div
              key={col}
              ref={el => {
                cols.current[ci] = el;
              }}
              className="min-h-[15rem] rounded-lg border border-border bg-surface p-1.5 sm:min-h-[19rem] sm:p-2.5"
            >
              <p className="mb-2 flex items-center justify-between text-[11px] font-semibold text-text-muted sm:text-xs">
                {col}
                <span className="tabular-nums">{cards.filter(c => c.col === ci).length}</span>
              </p>
              <ul className="space-y-2">
                {cards
                  .filter(c => c.col === ci)
                  .map(c => (
                    <motion.li
                      key={c.id}
                      layout={!reduced}
                      layoutId={String(c.id)}
                      transition={EASE.spring}
                      drag={!reduced}
                      dragSnapToOrigin
                      dragElastic={0.18}
                      whileDrag={{ scale: 1.05, rotate: -2, zIndex: 20, boxShadow: '0 22px 40px -12px rgb(0 0 0 / 0.55)' }}
                      onDragEnd={(_, info) => drop(c.id, info.point.x)}
                      tabIndex={0}
                      aria-label={`${c.name}, ${c.want}, in ${col}. Use left and right arrows to move.`}
                      onKeyDown={e => {
                        if (e.key === 'ArrowRight') move(c.id, c.col + 1);
                        if (e.key === 'ArrowLeft') move(c.id, c.col - 1);
                      }}
                      className={`relative cursor-grab touch-none select-none rounded-md border bg-bg p-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing ${ci === 3 ? 'border-brass/60' : 'border-border'} ${c.fresh ? 'brass-glow' : ''}`}
                    >
                      <p className="truncate text-xs font-semibold text-text sm:text-sm">{c.name}</p>
                      <p className="truncate text-[11px] text-text-muted">{c.want}</p>
                    </motion.li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
};

export default PipelineBoard;
