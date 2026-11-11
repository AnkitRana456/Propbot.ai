/** Motion tokens for the public site: every easing, duration and distance used by an animation. */

export const EASE = {
  /** GSAP eases. */
  out: 'power3.out',
  inOut: 'power2.inOut',
  /** The same curve for CSS transitions (also published as --mk-ease). */
  css: 'cubic-bezier(0.2, 0.8, 0.3, 1)',
  /** Framer Motion springs. */
  spring: { type: 'spring', stiffness: 420, damping: 32 } as const,
  springSoft: { type: 'spring', stiffness: 220, damping: 26 } as const,
};

/** Seconds. */
export const DUR = { fast: 0.25, base: 0.6, slow: 1.1, word: 0.7, stagger: 0.045 };

export const DIST = {
  /** Pixels a block rises as it reveals. */
  rise: 28,
  /** Share of the pointer offset a magnetic button follows. */
  magnet: 0.28,
  /** Degrees the dashboard leans back before it scrolls upright. */
  tilt: 10,
};

/** CSS custom properties for the tokens the stylesheet needs. */
export const motionCss = (): string => `.mkt{--mk-ease:${EASE.css};--mk-dur:${DUR.base}s;--mk-word:${DUR.word}s;--mk-stagger:${DUR.stagger}s;--mk-rise:${DIST.rise}px}`;
