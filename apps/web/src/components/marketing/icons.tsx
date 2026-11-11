import React from 'react';

/** The public site's own icon set: 24px grid, 1.75 stroke, round joins. Used for scene markers and confetti. */
const PATHS = {
  key: 'M8 19a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM10.9 12.1 20 3M16 7l3 3M13.5 9.5l2 2',
  pin: 'M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10zM12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  spark: 'M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6-5.6-1.9 5.6-1.9z',
  bag: 'M6 8h12l1 12H5zM9 8V6a3 3 0 0 1 6 0v2',
  coin: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM9.5 8.5h5M9.5 11.5h5M10 8.5c3 0 3 5.5 0 5.5l3.5 3.5',
  tile: 'M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chat: 'M5 6h14v10h-9l-4 3.5V16H5z',
  cal: 'M5 6h14v14H5zM5 10h14M8.5 4v4M15.5 4v4',
} as const;

export type GlyphName = keyof typeof PATHS;

export const Glyph: React.FC<{ name: GlyphName; size?: number; className?: string }> = ({ name, size = 20, className }) => (
  <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={PATHS[name]} />
  </svg>
);
