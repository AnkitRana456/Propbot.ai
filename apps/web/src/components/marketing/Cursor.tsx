import React, { useEffect, useRef } from 'react';
import { gsap } from './scroll.js';
import { SITE } from './config.js';

/**
 * A ring that trails the pointer and names what you can do ("Drag", "Tap", "Book") over elements that carry
 * data-cursor. The system cursor stays visible, so nothing is harder to click. Fine pointers only.
 */
export const Cursor: React.FC<{ reduced: boolean }> = ({ reduced }) => {
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ring.current;
    if (!el || reduced || !SITE.cursor || typeof window.matchMedia !== 'function' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const x = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3.out' });
    const y = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3.out' });
    const move = (e: PointerEvent) => {
      x(e.clientX);
      y(e.clientY);
      const target = e.target instanceof Element ? e.target : null;
      const label = target?.closest('[data-cursor]')?.getAttribute('data-cursor') ?? '';
      el.dataset.on = '1';
      el.dataset.label = label;
      el.dataset.link = !label && target?.closest('a, button') ? '1' : '';
    };
    const leave = () => {
      el.dataset.on = '';
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, [reduced]);

  return <div ref={ring} aria-hidden className="mk-cursor" />;
};
