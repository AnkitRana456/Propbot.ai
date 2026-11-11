import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { SITE } from './config.js';
import { DIST, EASE } from './motion.js';

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;
const HEADER = 72;

/** Smooth-scrolls to a section; falls back to the browser when smooth scrolling is off. */
export function scrollToId(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -HEADER });
  else el.scrollIntoView({ block: 'start' });
}

/**
 * Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger and Lenis share one clock, plus the
 * page-level scroll effects (hero and dashboard). Everything is off for visitors who prefer reduced motion.
 */
export function usePageMotion(reduced: boolean): void {
  useEffect(() => {
    if (reduced) return;
    const l = new Lenis({ lerp: SITE.smoothLerp, anchors: { offset: -HEADER } });
    lenis = l;
    l.on('scroll', ScrollTrigger.update);
    const tick = (t: number) => l.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px)', () => {
      // Hero: as it scrolls away the camera rises along the facade and the headline slides back into its mask.
      // The page is never pinned or slowed here.
      const hero = { trigger: '#top', start: 'top top', end: 'bottom top', scrub: true };
      gsap.to('[data-hero-tower]', { y: SITE.tower.scrollRise, ease: 'none', scrollTrigger: hero });
      // explicit start values: reading them from the DOM would capture the intro animation mid-flight
      gsap.fromTo('#hero-title .w > span', { y: 0, yPercent: 0 }, { yPercent: -115, ease: 'none', stagger: 0.06, immediateRender: false, scrollTrigger: { ...hero, start: 'top+=120 top', end: 'top+=560 top' } });

      // Hero: the tower leans a little toward the cursor, with damping
      const par = document.querySelector<HTMLElement>('[data-hero-parallax]');
      const top = document.getElementById('top');
      if (par && top) {
        const rx = gsap.quickTo(par, 'rotationX', { duration: 0.9, ease: EASE.out });
        const ry = gsap.quickTo(par, 'rotationY', { duration: 0.9, ease: EASE.out });
        gsap.set(par, { transformPerspective: 1400 });
        const move = (e: PointerEvent) => {
          const r = top.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 2 * SITE.tower.parallaxDeg);
          rx(-((e.clientY - r.top) / r.height - 0.5) * 2 * SITE.tower.parallaxDeg * 0.6);
        };
        top.addEventListener('pointermove', move);
        return () => top.removeEventListener('pointermove', move);
      }
      return undefined;
    });
    mm.add('(min-width: 768px)', () => {
      // Dashboard: starts leaning back and stands upright as it scrolls into place
      gsap.fromTo('[data-tour-frame]', { rotationX: DIST.tilt, y: 40, transformPerspective: 1600, transformOrigin: '50% 100%' }, { rotationX: 0, y: 0, ease: 'none', scrollTrigger: { trigger: '[data-tour-frame]', start: 'top 95%', end: 'top 35%', scrub: true } });
    });

    return () => {
      mm.revert();
      gsap.ticker.remove(tick);
      l.destroy();
      lenis = null;
    };
  }, [reduced]);
}

export { gsap, ScrollTrigger };
