import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { scrollToId } from './scroll.js';
import { useReducedMotion } from '../../lib/use-reduced-motion.js';

/**
 * "Cascade Bloom Estate Hero" (from Cue / codegrid's FameEstate scroll): a pinned scroll moment on the landing page.
 * As you scroll, the living room zooms out, a brand-teal slit opens and fills the frame, four interiors bloom from a
 * point one after another, a headline grows over them, then the headline tears in two and slides away, showing the
 * line underneath. Runs on the page's own Lenis + GSAP ScrollTrigger (scroll.ts). With reduced motion: one still frame.
 */

const IMG = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1800&q=80`;
const BG = IMG('1618221195710-dd6b41faaea6');
const IMAGES = ['1493397212122-2b85dda8106b', '1489058535093-8f530d789c3b', '1724582586529-62622e50c0b3', '1600210491369-e753d80a41f3'].map(IMG);

const TAG = 'PropBot Pro — for developers & brokers';
const OUTRO = <>Every home you sell, answered<br />the moment a buyer asks</>;

export const EstateReveal: React.FC = () => {
  const reduced = useReducedMotion();
  const root = useRef<HTMLElement>(null), stage = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (reduced || !root.current || !stage.current) return;
    const q = gsap.utils.selector(stage.current);
    const ctx = gsap.context(() => {
      const imgs = q('.er-img');
      const tl = gsap.timeline({
        scrollTrigger: { trigger: stage.current, start: 'top top', end: () => `+=${window.innerHeight * 4}`, pin: true, scrub: true, invalidateOnRefresh: true },
      });
      tl.to(q('.er-bg'), { scale: 1, duration: 0.5, ease: 'none' }, 0);
      tl.to(q('.er-revealer'), { clipPath: 'polygon(49.5% 0%, 50.5% 0%, 50.5% 100%, 49.5% 100%)', duration: 0.2, ease: 'none' }, 0);
      tl.to(q('.er-revealer'), { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', duration: 0.3, ease: 'none' }, 0.2);
      // each interior overlaps the next (0.16 long, 0.04 apart), so the cascade reads as one bloom
      const start = 0.4, stagger = 0.04, dur = 0.16;
      imgs.forEach((img, i) => tl.to(img, { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', scale: 1, duration: dur, ease: 'none' }, start + i * stagger));
      tl.to(q('.er-outro'), { scale: 1, duration: dur, ease: 'none' }, start + imgs.length * stagger + stagger * 0.5);
      tl.set(q('.er-bg, .er-content, .er-revealer, .er-images'), { autoAlpha: 0 }, 0.7);
      // the headline tears in two and leaves; -/+200 so both halves are fully gone before the pin lets go
      tl.to(q('.er-outro.l'), { xPercent: -200, duration: 0.3, ease: 'none' }, 0.7);
      tl.to(q('.er-outro.r'), { xPercent: 200, duration: 0.3, ease: 'none' }, 0.7);
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={root} id="reveal" className={`er${reduced ? ' still' : ''}`} aria-label="Every home you sell, answered the moment a buyer asks">
      <style>{CSS}</style>
      <div ref={stage} className="er-stage">
        {/* what the torn headline uncovers */}
        <div className="er-end">
          <p className="er-kicker">Website · WhatsApp · Instagram · Voice</p>
          <h3>Answers in seconds. Visits on the calendar.</h3>
          <button type="button" className="er-cta" onClick={() => scrollToId('showcase')}>See what you can sell with it</button>
        </div>
        <div className="er-bg"><img src={BG} alt="" loading="lazy" referrerPolicy="no-referrer" /></div>
        <div className="er-content"><p className="er-tag">{TAG}</p></div>
        <div className="er-revealer" />
        <div className="er-images" aria-hidden>
          {IMAGES.map(src => <div key={src} className="er-img"><img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" /></div>)}
        </div>
        <div className="er-outro l"><h2>{OUTRO}</h2></div>
        <div className="er-outro r" aria-hidden><h2>{OUTRO}</h2></div>
      </div>
    </section>
  );
};

/* Cue's tokens with PropBot's colours: cream on a deep brand teal instead of red; Inter instead of DM Sans */
const CSS = `
.er { --er-cream: #f0f0e6; --er-brand: #0b4f4a; --er-ink: #0f0f0f; position: relative; }
.er-stage { position: relative; width: 100%; height: 100svh; overflow: hidden; }
.er-stage img { display: block; width: 100%; height: 100%; object-fit: cover; }
.er-bg, .er-content, .er-revealer, .er-images, .er-end { position: absolute; inset: 0; will-change: transform; }
.er-img, .er-outro { position: absolute; top: 50%; left: 50%; width: 100%; height: 100%; transform: translate(-50%, -50%) scale(0); will-change: transform; }
.er-bg { transform: scale(1.5); }
.er-content, .er-outro, .er-end { padding: 2rem; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
.er-tag { font-size: .95rem; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--er-ink); background: rgba(240,240,230,.82); padding: .55rem .9rem; border-radius: 999px; line-height: 1; }
.er-revealer { background: var(--er-brand); clip-path: polygon(49.5% 50%, 50.5% 50%, 50.5% 50%, 49.5% 50%); }
.er-img { clip-path: polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%); will-change: clip-path; }
.er-outro { background: var(--er-brand); color: var(--er-cream); }
.er-outro.l { clip-path: polygon(0% 0%, 50% 0%, 50% 100%, 0% 100%); }
.er-outro.r { clip-path: polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%); }
.er-outro h2 { width: 65%; margin: 0; font-size: clamp(1.75rem, 3.4vw, 3.6rem); font-weight: 600; line-height: 1.05; letter-spacing: -.01em; text-transform: uppercase; }
.er-end { background: var(--bg); color: var(--text); gap: 14px; }
.er-kicker { margin: 0; font-size: .8rem; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); }
.er-end h3 { margin: 0; max-width: 16ch; font-size: clamp(1.75rem, 3.2vw, 3rem); font-weight: 700; line-height: 1.1; letter-spacing: -.02em; }
.er-cta { margin-top: 8px; height: 44px; padding: 0 20px; border: 0; border-radius: 999px; background: var(--accent); color: var(--on-accent, #fff); font: inherit; font-weight: 600; cursor: pointer; }
.er-cta:hover { filter: brightness(1.08); }
.er-cta:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
@media (max-width: 1000px) { .er-outro h2 { width: 100%; } }
/* reduced motion: one still frame, the headline over the room, nothing pinned or hidden */
.er.still .er-bg { transform: none; }
.er.still .er-revealer, .er.still .er-images, .er.still .er-outro.r, .er.still .er-end, .er.still .er-content { display: none; }
.er.still .er-outro.l { transform: translate(-50%, -50%); clip-path: none; background: color-mix(in srgb, var(--er-brand) 82%, transparent); }
`;
