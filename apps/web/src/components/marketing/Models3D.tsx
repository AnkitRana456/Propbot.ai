import React, { memo, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';

/**
 * Small CSS-3D toolkit for the public site: scenes, boxes, roofs, trees and signs.
 * Units are pixels in "design space"; Scene3D scales the whole scene to fit its container.
 * Y points up, so y is a height above the ground.
 */

export type FaceName = 'front' | 'back' | 'left' | 'right' | 'top';

// ───────────────────────────── scene

interface Scene3DProps {
  /** Design size of the scene at scale 1. */
  width: number;
  height: number;
  /** Where the ground origin sits, as a fraction of the height from the top. */
  anchor?: number;
  stageRef: RefObject<HTMLDivElement>;
  dancing?: boolean;
  onDanceEnd?: () => void;
  className?: string;
  children: ReactNode;
}

export const Scene3D: React.FC<Scene3DProps> = ({ width, height, anchor = 0.74, stageRef, dancing, onDanceEnd, className = '', children }) => {
  const outer = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);

  useEffect(() => {
    const el = outer.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setK(Math.min(1, (entry?.contentRect.width ?? width) / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={outer} className={`m3d m3d-scene ${className}`} style={{ height: Math.round(height * k), maxWidth: width }}>
      <div className="m3d-camera" style={{ top: `${anchor * 100}%`, transform: `scale(${k})` }}>
        <div
          className={`m3d-dancer ${dancing ? 'm3d-dance' : ''}`}
          onAnimationEnd={e => {
            if (e.target === e.currentTarget) onDanceEnd?.();
          }}
        >
          <div ref={stageRef} className="m3d-stage">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// ───────────────────────────── box

export interface BoxProps {
  w: number;
  h: number;
  d: number;
  /** Position of the centre of the base. */
  x?: number;
  y?: number;
  z?: number;
  /** Any CSS colour or variable; sets the wall colour. */
  tone?: string;
  className?: string;
  faces?: Partial<Record<FaceName, ReactNode>>;
  faceClass?: Partial<Record<FaceName, string>>;
  faceStyle?: Partial<Record<FaceName, CSSProperties>>;
  /** Draw the roof (top face). */
  top?: boolean;
}

export const Box: React.FC<BoxProps> = ({ w, h, d, x = 0, y = 0, z = 0, tone, className = '', faces, faceClass, faceStyle, top = true }) => {
  const style = {
    width: w,
    height: h,
    left: -w / 2,
    top: -h,
    transform: `translate3d(${x}px,${-y}px,${z}px)`,
    ...(tone ? { '--c': tone } : {}),
  } as CSSProperties;
  const face = (name: FaceName, size: CSSProperties, transform: string) => (
    <div className={`m3d-f ${faceClass?.[name] ?? ''}`} data-face={name} style={{ ...size, transform, ...faceStyle?.[name] }}>
      {faces?.[name]}
    </div>
  );
  return (
    <div className={`m3d-box ${className}`} style={style}>
      {face('front', { width: w, height: h }, `translateZ(${d / 2}px)`)}
      {face('back', { width: w, height: h }, `rotateY(180deg) translateZ(${d / 2}px)`)}
      {face('right', { width: d, height: h, left: (w - d) / 2 }, `rotateY(90deg) translateZ(${w / 2}px)`)}
      {face('left', { width: d, height: h, left: (w - d) / 2 }, `rotateY(-90deg) translateZ(${w / 2}px)`)}
      {top && face('top', { width: w, height: d, top: (h - d) / 2 }, `rotateX(90deg) translateZ(${h / 2}px)`)}
    </div>
  );
};

/** Positions its children relative to a point on the ground. */
export const Group: React.FC<{ x?: number; y?: number; z?: number; s?: number; children: ReactNode }> = ({ x = 0, y = 0, z = 0, s = 1, children }) => (
  <div className="m3d-box" style={{ left: 0, top: 0, width: 0, height: 0, transform: `translate3d(${x}px,${-y}px,${z}px)${s !== 1 ? ` scale3d(${s},${s},${s})` : ''}` }}>
    {children}
  </div>
);

// ───────────────────────────── roof

interface GableRoofProps {
  /** Length of the ridge (x) and the span it covers (z). */
  w: number;
  d: number;
  /** Height of the eaves above the ground. */
  y: number;
  /** How much higher the ridge is than the eaves. */
  rise: number;
  x?: number;
  z?: number;
  overhang?: number;
}

/** A pitched roof: two slopes and two triangular gable ends. */
export const GableRoof: React.FC<GableRoofProps> = ({ w, d, y, rise, x = 0, z = 0, overhang = 9 }) => {
  const half = d / 2;
  const k = 1 + overhang / half;
  const slopeLength = k * Math.hypot(half, rise);
  const angle = (Math.atan2(half, rise) * 180) / Math.PI; // from vertical
  const drop = (k - 1) * rise;
  const width = w + overhang * 2;
  const slope = (back: boolean): CSSProperties => ({
    width,
    height: slopeLength,
    left: -width / 2,
    top: -slopeLength,
    transform: back
      ? `translate3d(0,${drop}px,${-(half + overhang)}px) rotateY(180deg) rotateX(${angle}deg)`
      : `translate3d(0,${drop}px,${half + overhang}px) rotateX(${angle}deg)`,
  });
  return (
    <Group x={x} y={y} z={z}>
      <div className="m3d-slope" style={slope(false)} />
      <div className="m3d-slope" style={slope(true)} />
      <div className="m3d-gable" style={{ width: d, height: rise, left: -d / 2, top: -rise, transform: `translate3d(${w / 2}px,0,0) rotateY(90deg)` }} />
      <div className="m3d-gable" style={{ width: d, height: rise, left: -d / 2, top: -rise, transform: `translate3d(${-w / 2}px,0,0) rotateY(-90deg)` }} />
    </Group>
  );
};

// ───────────────────────────── ground, trees, signs

export const Disc: React.FC<{ r: number; x?: number; y?: number; z?: number; className: string; style?: CSSProperties }> = ({ r, x = 0, y = 0, z = 0, className, style }) => (
  <div className={`m3d-disc ${className}`} style={{ left: -r, top: -r, width: r * 2, height: r * 2, transform: `translate3d(${x}px,${-y}px,${z}px) rotateX(90deg)`, ...style }} />
);

/** A little floating island: grass on top, two layers of soil underneath. */
export const Island: React.FC<{ r: number }> = ({ r }) => (
  <>
    <Disc r={r * 0.9} y={-13} className="m3d-soil-lo" />
    <Disc r={r * 0.96} y={-6.5} className="m3d-soil" />
    <Disc r={r} y={0} className="m3d-grass" />
  </>
);

export const Shadow: React.FC<{ r: number; x?: number; z?: number }> = ({ r, x = 0, z = 0 }) => <Disc r={r} x={x} z={z} y={0.8} className="m3d-shadow" />;

export const Tree: React.FC<{ x: number; z: number; s?: number; pine?: boolean }> = ({ x, z, s = 1, pine = false }) => (
  <Group x={x} z={z} s={s}>
    <Box w={7} h={pine ? 14 : 24} d={7} tone="var(--m3d-trunk)" top={false} />
    {pine
      ? [0, 90].map(a => <span key={a} className="m3d-pine" style={{ transform: `translate3d(0,-12px,0) rotateY(${a}deg)` }} />)
      : [0, 60, 120].map(a => <span key={a} className="m3d-leaf" style={{ transform: `translate3d(0,-38px,0) rotateY(${a}deg)` }} />)}
  </Group>
);

/** A flat sprite that always faces the viewer. */
export const Billboard: React.FC<{ x?: number; y?: number; z?: number; bob?: boolean; children: ReactNode }> = ({ x = 0, y = 0, z = 0, bob = false, children }) => (
  <div className="m3d-bb" style={{ transform: `translate3d(${x}px,${-y}px,${z}px)` }}>
    <div className={bob ? 'm3d-bob' : undefined} style={{ transformStyle: 'preserve-3d' }}>
      <div className="m3d-bb-in">{children}</div>
    </div>
  </div>
);

export const Emoji: React.FC<{ children: string; size?: number }> = ({ children, size }) => (
  <span className="m3d-emoji" style={size ? { fontSize: size } : undefined}>
    {children}
  </span>
);

/** A "for sale" board on a post. It flips to "sold" when sold is true. */
export const SignPost: React.FC<{ x: number; z: number; sold: boolean; labels?: [string, string] }> = ({ x, z, sold, labels = ['FOR SALE', 'SOLD'] }) => (
  <Group x={x} z={z}>
    <Box w={4} h={40} d={4} tone="var(--m3d-trunk)" top={false} />
    <Billboard y={40}>
      <div className="m3d-board" data-sold={sold}>
        <span>{labels[0]}</span>
        <span>{labels[1]}</span>
      </div>
    </Billboard>
  </Group>
);

// ───────────────────────────── windows (shared by the tower and the apartment model)

export const Win = memo(({ s, i }: { s: number; i?: number }) => <span className="win" data-s={s} data-i={i} />);
Win.displayName = 'Win';

interface WindowGridProps {
  states: ArrayLike<number>;
  offset: number;
  cols: number;
  floors: number;
  /** Give each window an index so it can be clicked. */
  interactive?: boolean;
  gap?: string;
  pad?: string;
}
export const WindowGrid: React.FC<WindowGridProps> = ({ states, offset, cols, floors, interactive, gap, pad }) => (
  <div className="tower-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${floors}, 1fr)`, ...(gap ? { gap } : {}), ...(pad ? { padding: pad } : {}) }}>
    {Array.from({ length: cols * floors }, (_, n) => (
      <Win key={n} s={states[offset + n] ?? 0} i={interactive ? offset + n : undefined} />
    ))}
  </div>
);

/** Small deterministic PRNG so scenes look the same on every load. */
export const prng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

export const staticStates = (n: number, seed: number): Uint8Array => {
  const r = prng(seed);
  const a = new Uint8Array(n);
  for (let i = 0; i < n; i++) a[i] = r() < 0.45 ? 0 : r() < 0.5 ? 1 : r() < 0.6 ? 2 : 3;
  return a;
};
