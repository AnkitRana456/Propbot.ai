import React, { useMemo, useRef, useState } from 'react';
import { Box, Scene3D, prng } from './Models3D.js';
import { useEmojiBurst } from './EmojiBurst.js';

/**
 * A row of buildings that leans with the pointer. The parent publishes the pointer position in --px (-1 to 1),
 * so this component needs no scripting of its own. Decorative, so hidden from assistive technology.
 */
export const Skyline3D: React.FC = () => {
  const stage = useRef<HTMLDivElement>(null);
  const towers = useMemo(() => {
    const r = prng(23);
    return Array.from({ length: 13 }, (_, i) => ({
      x: -560 + i * 94 + (r() - 0.5) * 16,
      z: (r() - 0.5) * 120,
      w: 56 + r() * 30,
      d: 56 + r() * 30,
      h: 70 + r() * 170,
    }));
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[260px] overflow-clip">
      <Scene3D width={1240} height={260} anchor={0.96} stageRef={stage}>
        <div
          className="m3d-skyline"
          style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, transformStyle: 'preserve-3d', transform: 'rotateX(-10deg) rotateY(calc(var(--px, 0) * 14deg))', transition: 'transform 0.25s ease-out' }}
        >
          {towers.map((t, i) => (
            <Box
              key={i}
              w={t.w}
              h={t.h}
              d={t.d}
              x={t.x}
              z={t.z}
              tone="color-mix(in srgb, var(--accent) 22%, var(--surface))"
              faceClass={{ front: 'm3d-city', back: 'm3d-city', left: 'm3d-city', right: 'm3d-city' }}
            />
          ))}
        </div>
      </Scene3D>
    </div>
  );
};

/** A big "for sale" sign that turns to "sold" and throws a party when pressed. */
export const FlipSign: React.FC = () => {
  const [sold, setSold] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const { burstFrom } = useEmojiBurst();
  const face = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' } as const;
  return (
    <div className="mt-8">
      <button
        ref={button}
        type="button"
        aria-pressed={sold}
        aria-label={sold ? 'Sold. Press to put it back on the market.' : 'For sale. Press to sell it.'}
        onClick={() => {
          setSold(s => !s);
          burstFrom(button.current, 'party', 24);
        }}
        className="group block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        style={{ perspective: 900 }}
      >
        <span aria-hidden className="mx-auto block h-3 w-[86%] rounded-t bg-text/70" />
        <span className="relative block h-32 w-72 transition-transform duration-700 ease-out group-hover:-translate-y-1 sm:w-80" style={{ transformStyle: 'preserve-3d', transform: `rotateX(${sold ? 180 : 0}deg)`, transformOrigin: '50% 0' }}>
          <span style={face} className="flex flex-col items-center justify-center rounded-2xl border-4 border-text bg-surface text-text shadow-float">
            <span className="text-3xl font-extrabold tracking-wide">FOR SALE</span>
            <span className="mt-1 text-xs font-semibold uppercase tracking-widest text-text-muted">Your next listing</span>
          </span>
          <span style={{ ...face, transform: 'rotateX(180deg)' }} className="flex flex-col items-center justify-center rounded-2xl border-4 border-accent-hover bg-accent text-on-accent shadow-float">
            <span className="text-4xl font-extrabold tracking-wide">SOLD</span>
            <span className="mt-1 text-xs font-semibold uppercase tracking-widest opacity-90">Booked with PropBot</span>
          </span>
        </span>
      </button>
      <p className="mt-3 text-xs text-text-muted">Press the sign. It is a small preview of how this goes.</p>
    </div>
  );
};
