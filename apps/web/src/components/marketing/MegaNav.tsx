import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Compass, Menu, X, type LucideIcon } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { AUDIENCES, FEATURES, PRODUCTS, USE_CASES, featureHref, productHref, useCaseHref } from './content.js';

type MenuId = 'product' | 'usecases' | 'features';

interface MenuItem {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  href: string;
  badge?: string;
}
interface MenuDef {
  label: string;
  intro: string;
  /** Number of columns on wide screens. */
  cols: 2 | 3;
  items: MenuItem[];
  footer: Array<{ label: string; href: string }>;
}

export const MENUS: Record<MenuId, MenuDef> = {
  product: {
    label: 'Product',
    intro: 'Everything a real estate sales team needs, in one workspace.',
    cols: 3,
    items: PRODUCTS.map(p => ({ id: p.id, title: p.name, desc: p.short, icon: p.icon, href: productHref(p.id), badge: p.beta ? 'Beta' : undefined })),
    footer: [
      { label: 'Tour the dashboard', href: '#tour' },
      { label: 'See pricing', href: '#pricing' },
    ],
  },
  usecases: {
    label: 'Use cases',
    intro: 'From the first message to the site visit.',
    cols: 3,
    items: USE_CASES.map(u => ({ id: u.id, title: u.title, desc: u.body, icon: u.icon, href: useCaseHref(u.id) })),
    footer: [{ label: `Built for ${AUDIENCES.map(a => a.title.toLowerCase()).slice(0, 3).join(', ')} and more`, href: '#built-for' }],
  },
  features: {
    label: 'Features',
    intro: 'The details that make the difference.',
    cols: 3,
    items: FEATURES.map(f => ({ id: f.id, title: f.title, desc: f.body, icon: f.icon, href: featureHref(f.id) })),
    footer: [
      { label: 'Browse every product', href: '#explore' },
      { label: 'Book a demo', href: '#demo' },
    ],
  },
};

/** wide: only shown on extra-wide screens, so the bar never wraps on a laptop. */
export const NAV_ORDER: Array<{ type: 'link'; label: string; href: string; wide?: boolean } | { type: 'menu'; id: MenuId }> = [
  { type: 'link', label: 'Pipeline', href: '#top', wide: true },
  { type: 'menu', id: 'product' },
  { type: 'menu', id: 'usecases' },
  { type: 'menu', id: 'features' },
  { type: 'link', label: 'How it works', href: '#how', wide: true },
  { type: 'link', label: 'Pricing', href: '#pricing' },
  { type: 'link', label: 'FAQ', href: '#faq', wide: true },
];

/** Plain anchors scroll by themselves; product links also switch the product explorer to the right tab. */
export const followLink = (e: React.MouseEvent, href: string) => {
  if (!href.startsWith('#explore-')) return;
  e.preventDefault();
  if (window.location.hash === href) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = href;
};

const container = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8';
const btnPrimary = 'btn-sheen inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg';
const triggerCls = 'inline-flex h-10 items-center gap-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const MenuLink: React.FC<{ item: MenuItem; onPick: () => void; compact?: boolean }> = ({ item, onPick, compact }) => {
  const Icon = item.icon;
  return (
    <a
      href={item.href}
      onClick={e => {
        followLink(e, item.href);
        onPick();
      }}
      className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
    >
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-text">
          {item.title}
          {item.badge && <span className="rounded-full bg-brass/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brass">{item.badge}</span>}
        </span>
        <span className={`mt-0.5 block text-xs leading-snug text-text-muted ${compact ? 'line-clamp-2' : ''}`}>{item.desc}</span>
      </span>
    </a>
  );
};

export const MegaNav: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [openId, setOpenId] = useState<MenuId | null>(null);
  const [mobile, setMobile] = useState(false);
  const [mobileGroup, setMobileGroup] = useState<MenuId | null>(null);
  const root = useRef<HTMLElement>(null);
  const triggers = useRef<Partial<Record<MenuId, HTMLButtonElement | null>>>({});
  const baseId = useId();

  const close = useCallback(() => setOpenId(null), []);

  // Click outside and Escape close the open menu
  useEffect(() => {
    if (!openId) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && e.target instanceof Node && !root.current.contains(e.target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      triggers.current[openId]?.focus();
      close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openId, close]);

  useEffect(() => {
    if (!mobile) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobile(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobile]);

  const panelId = (id: MenuId) => `${baseId}-${id}`;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <nav ref={root} aria-label="Primary" className="relative">
        <div className={`${container} flex h-16 items-center justify-between gap-3`}>
          <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5 whitespace-nowrap font-bold text-text">
            <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent">
              <Compass className="h-[18px] w-[18px]" />
            </span>
            PropBot Pro
          </Link>

          <ul className="hidden h-full items-center gap-0.5 lg:flex">
            {NAV_ORDER.map(entry =>
              entry.type === 'link' ? (
                <li key={entry.href} className={entry.wide ? 'hidden xl:block' : undefined}>
                  <a href={entry.href} onClick={close} className={triggerCls}>
                    {entry.label}
                  </a>
                </li>
              ) : (
                <li key={entry.id} className="flex h-full items-center">
                  <button
                    ref={el => {
                      triggers.current[entry.id] = el;
                    }}
                    type="button"
                    aria-expanded={openId === entry.id}
                    aria-controls={panelId(entry.id)}
                    onClick={() => setOpenId(openId === entry.id ? null : entry.id)}
                    onMouseEnter={() => openId && openId !== entry.id && setOpenId(entry.id)}
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setOpenId(entry.id);
                        requestAnimationFrame(() => document.querySelector<HTMLElement>(`#${CSS.escape(panelId(entry.id))} a`)?.focus());
                      }
                    }}
                    className={`${triggerCls} ${openId === entry.id ? 'bg-surface-2 text-text' : ''}`}
                  >
                    {MENUS[entry.id].label}
                    <ChevronDown aria-hidden className={`h-4 w-4 transition-transform duration-200 ${openId === entry.id ? 'rotate-180' : ''}`} />
                  </button>

                  {openId === entry.id && (
                    <div className="pointer-events-none absolute inset-x-0 top-full">
                      <div className={`${container} pt-2`}>
                        <div id={panelId(entry.id)} role="group" aria-label={`${MENUS[entry.id].label} menu`} className="menu-panel pointer-events-auto max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-border bg-surface shadow-float">
                          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
                            <p className="text-sm font-semibold text-text">{MENUS[entry.id].label}</p>
                            <p className="text-xs text-text-muted">{MENUS[entry.id].intro}</p>
                          </div>
                          <div className="grid gap-1 p-3 sm:grid-cols-2 lg:grid-cols-3">
                            {MENUS[entry.id].items.map(item => (
                              <MenuLink key={item.id} item={item} onPick={close} compact={entry.id !== 'product'} />
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2/60 px-5 py-3">
                            <div className="flex flex-wrap gap-x-5 gap-y-1">
                              {MENUS[entry.id].footer.map(f => (
                                <a key={f.href} href={f.href} onClick={close} className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
                                  {f.label}
                                  <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                                </a>
                              ))}
                            </div>
                            <a href="#demo" onClick={close} data-burst="party" className={btnPrimary}>
                              Book a demo
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>

          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden xl:inline-flex" />
            {isAuthenticated ? (
              <Link to="/dashboard" className={btnPrimary}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden whitespace-nowrap px-3 text-sm font-semibold text-text hover:text-accent sm:inline">
                  Log in
                </Link>
                <a href="#demo" className={btnPrimary}>
                  Book a demo
                </a>
              </>
            )}
            <button type="button" className="rounded-lg p-2 text-text lg:hidden" aria-expanded={mobile} aria-controls="mobile-nav" aria-label={mobile ? 'Close menu' : 'Open menu'} onClick={() => setMobile(o => !o)}>
              {mobile ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobile && (
          <div id="mobile-nav" className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-border bg-surface lg:hidden">
            <ul className={`${container} space-y-1 py-3`}>
              {NAV_ORDER.map(entry =>
                entry.type === 'link' ? (
                  <li key={entry.href}>
                    <a href={entry.href} onClick={() => setMobile(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-text hover:bg-surface-2">
                      {entry.label}
                    </a>
                  </li>
                ) : (
                  <li key={entry.id}>
                    <button
                      type="button"
                      aria-expanded={mobileGroup === entry.id}
                      aria-controls={`m-${panelId(entry.id)}`}
                      onClick={() => setMobileGroup(mobileGroup === entry.id ? null : entry.id)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-text hover:bg-surface-2"
                    >
                      {MENUS[entry.id].label}
                      <ChevronDown aria-hidden className={`h-4 w-4 transition-transform ${mobileGroup === entry.id ? 'rotate-180' : ''}`} />
                    </button>
                    {mobileGroup === entry.id && (
                      <div id={`m-${panelId(entry.id)}`} className="mb-2 ml-2 border-l border-border pl-2">
                        {MENUS[entry.id].items.map(item => (
                          <MenuLink
                            key={item.id}
                            item={item}
                            compact
                            onPick={() => {
                              setMobile(false);
                              setMobileGroup(null);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </li>
                ),
              )}
              <li className="flex items-center justify-between px-3 pt-2">
                <Link to="/login" className="text-sm font-semibold text-accent">
                  Log in
                </Link>
                <ThemeToggle />
              </li>
            </ul>
          </div>
        )}
      </nav>
    </header>
  );
};
