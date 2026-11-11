import React, { useEffect, useRef, useState } from 'react';
import { useInView } from '../../lib/use-in-view.js';
import { DIST } from './motion.js';
import { SITE } from './config.js';

/** True from the first time the element is on screen. */
export function useSeen<T extends Element>(): [React.RefObject<T>, boolean] {
  const [ref, inView] = useInView<T>('-8% 0px');
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (inView) setSeen(true);
  }, [inView]);
  return [ref, seen];
}

/** Small mono label above a headline: "FIG. 03 — LEAD CAPTURE". */
export const Fig: React.FC<{ n: string; label: string; center?: boolean }> = ({ n, label, center }) => (
  <p className={`fig ${center ? 'center' : ''}`}>
    <b>FIG. {n}</b>
    <i aria-hidden />
    {label}
  </p>
);

/** Text whose words rise out of a mask when it scrolls into view. */
export const Words: React.FC<{ text: string; from?: number }> = ({ text, from = 0 }) => {
  const [ref, seen] = useSeen<HTMLSpanElement>();
  return (
    <span ref={ref} className={`words ${seen ? 'in' : ''}`}>
      {text.split(' ').map((w, i) => (
        <React.Fragment key={i}>
          <span className="w">
            <span style={{ '--i': from + i } as React.CSSProperties}>{w}</span>
          </span>{' '}
        </React.Fragment>
      ))}
    </span>
  );
};

/** A hairline that wipes in from the left; used between sections instead of a fade. */
export const Wipe: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [ref, seen] = useSeen<HTMLSpanElement>();
  return <span ref={ref} aria-hidden className={`wipe ${seen ? 'in' : ''} ${className}`} />;
};

/** Section heading: figure label, serif headline with a word reveal, optional lead. */
export const SectionHead: React.FC<{ id: string; n: string; label: string; title: string; lead?: string; center?: boolean; className?: string }> = ({ id, n, label, title, lead, center, className = '' }) => (
  <div className={`${center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'} ${className}`}>
    <Wipe className="mb-5" />
    <Fig n={n} label={label} center={center} />
    <h2 id={id} className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
      <Words text={title} />
    </h2>
    {lead && <p className={`mt-3 max-w-2xl text-base text-text-muted sm:text-lg ${center ? 'mx-auto' : ''}`}>{lead}</p>}
  </div>
);

const finePointer = () => typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Pulls its child a little toward the pointer. Does nothing on touch screens or with reduced motion. */
export const Magnetic: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || !SITE.cursor || !finePointer()) return;
    const r = el.getBoundingClientRect();
    el.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * DIST.magnet).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * DIST.magnet).toFixed(1)}px)`;
  };
  return (
    <span
      ref={ref}
      onPointerMove={move}
      onPointerLeave={() => ref.current && (ref.current.style.transform = '')}
      className={`inline-block transition-transform duration-300 ease-out ${className}`}
    >
      {children}
    </span>
  );
};

/** A number whose digits roll to the new value, like a car odometer. Screen readers get the plain text. */
export const Odometer: React.FC<{ value: string; className?: string }> = ({ value, className = '' }) => (
  <span className={className}>
    <span className="sr-only">{value}</span>
    <span aria-hidden className="odo">
      {[...value].map((ch, i) =>
        /\d/.test(ch) ? (
          // keyed from the right so the units digit stays the units digit when the length changes
          <span key={value.length - i} className="odo-d">
            <span style={{ transform: `translateY(-${Number(ch)}em)` }}>
              {'0123456789'.split('').map(d => (
                <i key={d}>{d}</i>
              ))}
            </span>
          </span>
        ) : (
          <span key={`c${value.length - i}`}>{ch === ' ' ? ' ' : ch}</span>
        ),
      )}
    </span>
  </span>
);
