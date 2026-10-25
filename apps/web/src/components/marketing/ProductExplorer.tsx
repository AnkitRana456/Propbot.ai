import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { FEATURES, PRODUCTS, featureHref } from './content.js';
import { BrowserFrame, PhoneFrame, Reveal, ThemedImage, Tilt } from './Frames.js';
import { btnPrimary, btnSecondary, container, h2, lead, sectionPad } from './styles.js';
import { useReducedMotion } from '../../lib/use-reduced-motion.js';

/**
 * One tab per product. The Product menu in the navigation links here (#explore-voice and so on), so the
 * address always opens the right tab, even when it is shared.
 */
export const ProductExplorer: React.FC = () => {
  const [active, setActive] = useState(0);
  const section = useRef<HTMLElement>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    const apply = () => {
      const match = window.location.hash.match(/^#explore-([a-z]+)$/);
      if (!match) return;
      const index = PRODUCTS.findIndex(p => p.id === match[1]);
      if (index < 0) return;
      setActive(index);
      section.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [reduced]);

  const product = PRODUCTS[active]!;
  const Icon = product.icon;
  const related = FEATURES.filter(f => f.product === product.id);

  const move = (to: number) => {
    const next = (to + PRODUCTS.length) % PRODUCTS.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <section id="explore" ref={section} className={`${sectionPad} relative overflow-clip bg-surface`} aria-labelledby="explore-title">
      <div className={container}>
        <div className="max-w-2xl">
          <h2 id="explore-title" className={h2}>Everything your sales team needs, in one place</h2>
          <p className={lead}>Pick a product to see what it does. Every one of them works with the others.</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[17rem_1fr]">
          <div
            role="tablist"
            aria-label="Products"
            aria-orientation="vertical"
            onKeyDown={e => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                move(active + 1);
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                move(active - 1);
              } else if (e.key === 'Home') {
                e.preventDefault();
                move(0);
              } else if (e.key === 'End') {
                e.preventDefault();
                move(PRODUCTS.length - 1);
              }
            }}
            className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
          >
            {PRODUCTS.map((p, i) => {
              const TabIcon = p.icon;
              const on = i === active;
              return (
                <button
                  key={p.id}
                  ref={el => {
                    tabs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`explore-tab-${p.id}`}
                  aria-selected={on}
                  aria-controls="explore-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => setActive(i)}
                  className={`flex shrink-0 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    on ? 'border-accent bg-accent-soft text-accent shadow-sm lg:translate-x-1' : 'border-transparent text-text-muted hover:bg-bg hover:text-text'
                  }`}
                >
                  <TabIcon aria-hidden className="h-[18px] w-[18px] shrink-0" />
                  <span className="whitespace-nowrap lg:whitespace-normal">{p.name}</span>
                  {p.beta && <span className="rounded-full bg-brass/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brass">Beta</span>}
                </button>
              );
            })}
          </div>

          <div id="explore-panel" role="tabpanel" aria-labelledby={`explore-tab-${product.id}`} tabIndex={0} className="rounded-2xl border border-border bg-bg p-5 shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:p-7 lg:min-h-[31rem]">
            <div key={product.id} className="animate-fade-in-up">
              <div className="flex items-center gap-3">
                <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-on-accent shadow-float">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-bold text-text">
                    {product.name}
                    {product.beta && <span className="rounded-full bg-brass/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brass">Beta</span>}
                  </h3>
                  <p className="text-sm text-text-muted">{product.tagline}</p>
                </div>
              </div>

              <div className="mt-6 grid items-center gap-8 xl:grid-cols-[1fr_1.15fr]">
                <ul className="space-y-3">
                  {product.bullets.map(b => (
                    <li key={b} className="flex items-start gap-2.5 text-sm text-text">
                      <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {b}
                    </li>
                  ))}
                </ul>
                <Reveal>
                  {product.image.kind === 'phone' ? (
                    <div className="mx-auto w-52">
                      <Tilt max={7}>
                        <PhoneFrame>
                          <ThemedImage key={product.id} name={product.image.name} alt={product.image.alt} width={390} height={800} />
                        </PhoneFrame>
                      </Tilt>
                    </div>
                  ) : (
                    <Tilt max={4}>
                      <BrowserFrame url={`app.propbot.pro/${product.id}`}>
                        <ThemedImage key={product.id} name={product.image.name} alt={product.image.alt} width={1200} height={750} />
                      </BrowserFrame>
                    </Tilt>
                  )}
                </Reveal>
              </div>

              {related.length > 0 && (
                <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <span className="text-xs font-semibold text-text-muted">Related features</span>
                  {related.map(f => (
                    <a key={f.id} href={featureHref(f.id)} className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text hover:border-accent hover:text-accent">
                      {f.title}
                    </a>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <a href="#demo" data-burst="party" className={btnPrimary}>
                  Book a demo <ArrowRight aria-hidden className="h-4 w-4" />
                </a>
                <Link to="/register" className={btnSecondary}>
                  Start free trial
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
