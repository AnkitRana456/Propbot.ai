import React, { useEffect, useRef, useState } from 'react';
import { FLOORS } from './config.js';
import { scrollToId } from './scroll.js';

/**
 * The page as a building. A slim tower on the right edge gains a lit floor for every section scrolled past;
 * the last floor (the demo form) is the brass one. Click a floor to go there. On small screens it is a thin
 * bar under the header instead.
 */
export const ProgressTower: React.FC = () => {
  const [active, setActive] = useState(0);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const calc = () => {
      raf = 0;
      const mid = window.innerHeight * 0.5;
      let a = 0;
      FLOORS.forEach((f, i) => {
        const el = document.getElementById(f.id);
        if (el && el.getBoundingClientRect().top <= mid) a = i;
      });
      setActive(a);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(calc);
    };
    calc();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
    };
  }, []);

  return (
    <>
      <div aria-hidden className="pbar lg:hidden">
        <div ref={bar} />
      </div>
      <nav aria-label="Page sections" className="ptower hidden lg:flex">
        <span aria-hidden className="ptower-roof" />
        <ol>
          {FLOORS.map((f, i) => (
            <li key={f.id}>
              <button
                type="button"
                data-lit={i <= active}
                data-last={i === FLOORS.length - 1}
                aria-current={i === active ? 'true' : undefined}
                aria-label={`Go to ${f.label}`}
                onClick={() => scrollToId(f.id)}
              >
                <span aria-hidden>{f.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
};
