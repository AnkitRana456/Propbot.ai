/**
 * Every tweakable value of the public site lives here: colours, speeds, scroll lengths and 3D quality.
 * Easing, durations and distances are in motion.ts.
 */

/** Brand colours per theme. Teal means "AI / live"; brass is only for booked, sold and hot-lead moments. */
export const COLORS = {
  light: {
    teal: '15 118 110',
    brass: '180 107 14',
    /** Tower windows, by funnel stage: enquiry, qualified, site visit, booked. */
    stages: ['#9AA7B5', '#5BB8AE', '#0F766E', '#B46B0E'],
    grain: 0.05,
  },
  dark: {
    teal: '45 212 191',
    brass: '240 180 76',
    stages: ['#566475', '#2A8F84', '#2DD4BF', '#F0B44C'],
    grain: 0.07,
  },
} as const;

export const SITE = {
  /** 'auto' picks 'lite' on small or low-power devices; force 'full' or 'lite' to test. */
  quality: 'auto' as 'auto' | 'full' | 'lite',
  tower: {
    /** Degrees per frame while idle. */
    spinSpeed: 0.16,
    /** Milliseconds between two buyers moving a stage. */
    tickMs: 650,
    /** How far the tower leans toward the cursor, in degrees. */
    parallaxDeg: 5,
    /** Pixels the tower sinks (camera rises) as the hero scrolls away. */
    scrollRise: 140,
  },
  journey: {
    /** Length of the pinned journey, in viewport heights. */
    scrollVh: 300,
    /** Funnel counts shown at Enquiry, Qualified, Visit and Booked. */
    funnel: [149, 92, 52, 23],
  },
  /** Lenis smoothing: lower is floatier. */
  smoothLerp: 0.11,
  /** Custom cursor and magnetic buttons (fine pointers only). */
  cursor: true,
} as const;

/** Floors of the progress tower: one per section, top of the page first. */
export const FLOORS = [
  { id: 'top', label: 'Pipeline' },
  { id: 'journey', label: 'Journey' },
  { id: 'tour', label: 'Dashboard' },
  { id: 'compare', label: 'Before / after' },
  { id: 'showcase', label: 'Properties' },
  { id: 'explore', label: 'Products' },
  { id: 'use-cases', label: 'Use cases' },
  { id: 'features', label: 'Features' },
  { id: 'how', label: 'Setup' },
  { id: 'roi', label: 'ROI' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
  { id: 'demo', label: 'Demo' },
] as const;

/** True on phones and devices that report little memory or few cores. */
export function isLite(): boolean {
  if (SITE.quality !== 'auto') return SITE.quality === 'lite';
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return window.innerWidth < 640 || (nav.deviceMemory ?? 8) <= 2 || (nav.hardwareConcurrency ?? 8) <= 2;
}

/** The CSS that turns COLORS into variables on the page root. */
export const themeCss = (): string => {
  const block = (c: (typeof COLORS)['light' | 'dark']) =>
    `--accent-rgb:${c.teal};--brass-rgb:${c.brass};--brass:rgb(${c.brass});--grain:${c.grain};` + c.stages.map((s, i) => `--stage-${i + 1}:${s};`).join('');
  return `.mkt{${block(COLORS.light)}}:is(.dark,[data-theme='dark']) .mkt{${block(COLORS.dark)}}`;
};
