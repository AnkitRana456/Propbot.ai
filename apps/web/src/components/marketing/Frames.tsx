import React, { useEffect, useRef, useState } from 'react';

/** Fade-up on first view. Static (no animation, always visible) when the visitor prefers reduced motion. */
export const Reveal: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({ children, className = '', delay = 0 }) => {
  const ref = useRef<HTMLDivElement>(null);
  // Content is visible until we know it starts below the fold, so it never stays hidden if scripts or observers fail.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!el || reduce || typeof IntersectionObserver === 'undefined') return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    setHidden(true);
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setHidden(false);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ transitionDelay: hidden ? '0ms' : `${delay}ms` }} className={`transition duration-700 ease-out motion-reduce:transition-none ${hidden ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'} ${className}`}>
      {children}
    </div>
  );
};

interface ThemedImageProps {
  /** File stem under /images, e.g. "dashboard" resolves to dashboard-light.svg and dashboard-dark.svg. */
  name: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}

/** Light and dark variants; only the one matching the active theme is shown. */
export const ThemedImage: React.FC<ThemedImageProps> = ({ name, alt, width, height, priority = false, className = '' }) => {
  // React 18 only knows the lowercase attribute name for fetchpriority
  const common = { width, height, loading: priority ? ('eager' as const) : ('lazy' as const), decoding: 'async' as const, ...(priority ? { fetchpriority: 'high' } : {}) };
  return (
    <picture>
      <img src={`/images/${name}-light.svg`} alt={alt} {...common} className={`block h-auto w-full dark:hidden ${className}`} />
      <img src={`/images/${name}-dark.svg`} alt={alt} {...common} className={`hidden h-auto w-full dark:block ${className}`} />
    </picture>
  );
};

export const BrowserFrame: React.FC<{ children: React.ReactNode; url?: string; className?: string }> = ({ children, url = 'app.propbot.pro/leads', className = '' }) => (
  <div className={`overflow-hidden rounded-xl border border-border bg-surface shadow-float ${className}`}>
    <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
      <span aria-hidden className="flex gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
      </span>
      <span className="mx-auto max-w-[60%] truncate rounded-md bg-bg px-3 py-0.5 text-xs text-text-muted">{url}</span>
    </div>
    {children}
  </div>
);

export const PhoneFrame: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`rounded-[2.2rem] border-[6px] border-text/90 bg-text/90 p-0 shadow-float ${className}`}>
    <div className="overflow-hidden rounded-[1.7rem] bg-bg">{children}</div>
  </div>
);
