import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

interface SpinOptions {
  /** Starting angle in degrees. */
  initial?: number;
  /** Degrees added per frame while idle. */
  speed?: number;
  /** How far the camera looks down on the scene, in degrees. */
  tilt?: number;
  /** Whether to turn by itself (false when off screen, paused or reduced motion). */
  running: boolean;
}

/**
 * Turns a 3D stage: slowly on its own, by dragging, or by calling rotate(). The angle is written straight to
 * the element (no React render per frame) and published as --ry so billboards can face the viewer.
 */
export function useSpin(stage: RefObject<HTMLElement | null>, { initial = -30, speed = 0.16, tilt = 19, running }: SpinOptions) {
  const angle = useRef(initial);
  const drag = useRef<{ x: number; a: number; moved: number } | null>(null);
  const boost = useRef(0);

  const apply = useCallback(() => {
    const el = stage.current;
    if (!el) return;
    el.style.transform = `rotateX(${-tilt}deg) rotateY(${angle.current}deg)`;
    el.style.setProperty('--ry', `${angle.current}deg`);
    el.style.setProperty('--tilt', `${tilt}deg`);
  }, [stage, tilt]);

  useEffect(() => {
    apply();
  }, [apply]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      if (!drag.current) {
        angle.current += speed + boost.current;
        boost.current = boost.current > 0.02 ? boost.current * 0.93 : 0;
        apply();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, apply]);

  const rotate = useCallback(
    (deg: number) => {
      angle.current += deg;
      apply();
    },
    [apply],
  );

  /** A short extra spin, for when something is clicked. */
  const spinUp = useCallback((v = 4) => {
    boost.current = v;
  }, []);

  /** Pointer handlers for the element that should be draggable. onTap runs for a press that was not a drag. */
  const bind = useCallback(
    (onTap?: (e: ReactPointerEvent) => void) => ({
      onPointerDown: (e: ReactPointerEvent) => {
        drag.current = { x: e.clientX, a: angle.current, moved: 0 };
        try {
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        } catch {
          /* the pointer is gone (or synthetic); dragging still works without capture */
        }
      },
      onPointerMove: (e: ReactPointerEvent) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        d.moved = Math.max(d.moved, Math.abs(dx));
        if (d.moved > 4) {
          angle.current = d.a + dx * 0.45;
          apply();
        }
      },
      onPointerUp: (e: ReactPointerEvent) => {
        const d = drag.current;
        drag.current = null;
        if (d && d.moved <= 4) onTap?.(e);
      },
      onPointerCancel: () => {
        drag.current = null;
      },
    }),
    [apply],
  );

  return { angle, rotate, spinUp, bind, apply };
}
