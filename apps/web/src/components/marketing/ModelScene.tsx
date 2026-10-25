import React, { useEffect, useRef, useState } from 'react';
import { MousePointerClick } from 'lucide-react';
import { Scene3D } from './Models3D.js';
import { useEmojiBurst, type EmojiSet } from './EmojiBurst.js';
import { useSpin } from './use-spin.js';
import { useInView } from '../../lib/use-in-view.js';
import { useReducedMotion } from '../../lib/use-reduced-motion.js';

interface ModelSceneProps {
  Model: React.FC<{ sold: boolean }>;
  emojis: EmojiSet;
  /** What the property is called, for assistive technology. */
  name: string;
  /** Word for the sold state, e.g. "Sold" or "Leased". */
  soldLabel?: string;
  width?: number;
  height?: number;
  anchor?: number;
  tilt?: number;
  /** Show the "Tap to sell" pill. */
  hint?: boolean;
  /** Flip to sold by itself the first time the scene scrolls into view. */
  autoSold?: boolean;
  className?: string;
}

/**
 * A property that turns slowly, can be dragged, and when pressed jumps, spins, flips its sign to "sold"
 * and throws emojis. Press Enter or Space for the same thing from the keyboard.
 */
export const ModelScene: React.FC<ModelSceneProps> = ({ Model, emojis, name, soldLabel = 'Sold', width = 520, height = 370, anchor = 0.8, tilt = 17, hint = true, autoSold = false, className = '' }) => {
  const [sold, setSold] = useState(false);
  const [dancing, setDancing] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const [view, inView] = useInView<HTMLDivElement>();
  const reduced = useReducedMotion();
  const { burst, burstFrom } = useEmojiBurst();
  const { bind, spinUp } = useSpin(stage, { running: inView && !reduced, initial: -28, speed: 0.2, tilt });
  const auto = useRef(false);

  const celebrate = (at?: { x: number; y: number }, next?: boolean) => {
    setSold(s => next ?? !s);
    setDancing(true);
    spinUp(3.5);
    if (at) burst({ x: at.x, y: at.y, set: emojis, count: 18, spread: 1.25 });
    else burstFrom(view.current, emojis, 18);
  };

  useEffect(() => {
    if (!autoSold || !inView || auto.current) return;
    auto.current = true;
    const id = window.setTimeout(() => celebrate(undefined, true), 900);
    return () => window.clearTimeout(id);
  }, [autoSold, inView]);

  return (
    <div
      ref={view}
      role="button"
      tabIndex={0}
      aria-pressed={sold}
      aria-label={`${name}. ${sold ? soldLabel : 'For sale'}. Press to ${sold ? 'put it back on the market' : `mark it ${soldLabel.toLowerCase()}`} and celebrate. Drag to turn it.`}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          celebrate();
        }
      }}
      {...bind(e => celebrate({ x: e.clientX, y: e.clientY }))}
      className={`relative cursor-grab focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent active:cursor-grabbing ${className}`}
    >
      <Scene3D width={width} height={height} anchor={anchor} stageRef={stage} dancing={dancing} onDanceEnd={() => setDancing(false)}>
        <Model sold={sold} />
      </Scene3D>
      {hint && (
        <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-semibold text-text-muted shadow-sm">
          <MousePointerClick aria-hidden className="h-3.5 w-3.5 text-accent" />
          {sold ? soldLabel : 'Tap to sell'}
        </span>
      )}
    </div>
  );
};
