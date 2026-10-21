import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, LogOut, Menu, Search, Settings } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext.js';
import { breadcrumbFor } from '../../config/navigation.js';
import { useMarkNotificationsRead, useNotificationCentre } from '../../services/controls.service.js';
import { CommandPalette } from '../ui/CommandPalette.js';
import { ThemeToggle } from '../ui/ThemeToggle.js';

interface TopBarProps {
  onOpenMobileMenu: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  'ps-owner': 'Platform owner',
  company_admin: 'Agency admin',
  sales_manager: 'Sales manager',
  agent: 'Agent',
  viewer: 'Viewer',
};

/** Closes a popover on outside click and on Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};

export const TopBar: React.FC<TopBarProps> = ({ onOpenMobileMenu }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, company, logout } = useAuth();
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const notif = usePopover();
  const menu = usePopover();
  const { data: centre } = useNotificationCentre();
  const markRead = useMarkNotificationsRead();
  const unread = centre?.unreadCount ?? 0;
  const crumbs = breadcrumbFor(location.pathname);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <header className="topbar-premium sticky top-0 z-30 flex h-16 w-full items-center gap-3 border-b border-border px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:text-text md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>

        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex items-center gap-1.5 text-sm text-text-muted">
            <li className="hidden max-w-[160px] truncate font-semibold text-text sm:block">{company?.name || 'Your agency'}</li>
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
                  <ChevronRight aria-hidden className={`h-3.5 w-3.5 shrink-0 text-text-faint ${i === 0 ? 'hidden sm:block' : ''}`} />
                  {c.to && !last ? (
                    <Link to={c.to} className="truncate hover:text-text">{c.label}</Link>
                  ) : (
                    <span aria-current={last ? 'page' : undefined} className={`truncate ${last ? 'font-semibold text-accent' : ''}`}>{c.label}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <button
          type="button"
          onClick={() => setIsCommandOpen(true)}
          className="hidden w-full max-w-xs items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm text-text-muted transition-colors hover:border-text-faint sm:flex"
          aria-label="Search leads, pages and actions"
        >
          <Search aria-hidden className="h-4 w-4 text-text-faint" />
          <span className="flex-1 truncate">Search leads, pages…</span>
          <kbd className="rounded border border-border bg-surface-2 px-1.5 text-[11px] text-text-faint">Ctrl K</kbd>
        </button>
        <button
          type="button"
          onClick={() => setIsCommandOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:text-text sm:hidden"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />

          <div className="relative" ref={notif.ref}>
            <button
              type="button"
              onClick={() => notif.setOpen(o => !o)}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
              aria-haspopup="dialog"
              aria-expanded={notif.open}
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent">{unread > 9 ? '9+' : unread}</span>}
            </button>
            {notif.open && (
              <div role="dialog" aria-label="Notifications" className="dropdown-elevated absolute right-0 z-50 mt-2 w-[min(340px,calc(100vw-2rem))] p-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-sm font-semibold text-text">Notifications</span>
                  <button type="button" disabled={unread === 0 || markRead.isPending} onClick={() => markRead.mutate(undefined)} className="text-xs font-semibold text-accent disabled:opacity-40">Mark all read</button>
                </div>
                <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
                  {(centre?.items ?? []).slice(0, 8).map(n => (
                    <li key={n.id} className={`rounded-lg border p-2.5 text-xs ${n.isRead ? 'border-border' : 'border-accent/30 bg-accent-soft/40'}`}>
                      <div className="flex justify-between gap-2"><span className="font-semibold text-text">{n.title}</span><span className="shrink-0 text-text-faint">{ago(n.createdAt)}</span></div>
                      <p className="mt-0.5 text-text-muted">{n.message}</p>
                      {n.linkUrl && <Link to={n.linkUrl} onClick={() => notif.setOpen(false)} className="mt-1 inline-block font-semibold text-accent">Open</Link>}
                    </li>
                  ))}
                  {(centre?.items ?? []).length === 0 && <li className="py-6 text-center text-xs text-text-muted">You are all caught up.</li>}
                </ul>
                <Link to="/controls" onClick={() => notif.setOpen(false)} className="mt-2 block border-t border-border pt-2 text-center text-xs font-semibold text-text-muted hover:text-text">Manage alerts</Link>
              </div>
            )}
          </div>

          <div className="relative" ref={menu.ref}>
            <button
              type="button"
              onClick={() => menu.setOpen(o => !o)}
              className="flex items-center gap-2 rounded-lg border border-border p-1 pr-2 transition-colors hover:bg-surface-2"
              aria-haspopup="menu"
              aria-expanded={menu.open}
              aria-label="Account menu"
            >
              <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-semibold text-on-accent">{user?.name ? user.name.charAt(0).toUpperCase() : 'A'}</span>
              <span className="hidden text-left lg:block">
                <span className="block max-w-[110px] truncate text-xs font-semibold leading-tight text-text">{user?.name ?? 'Account'}</span>
                <span className="block text-[11px] leading-tight text-text-muted">{ROLE_LABEL[user?.role ?? ''] ?? 'Team member'}</span>
              </span>
            </button>
            {menu.open && (
              <div role="menu" className="dropdown-elevated absolute right-0 z-50 mt-2 w-60 p-1.5 text-sm">
                <div className="border-b border-border px-3 py-2">
                  <p className="truncate font-semibold text-text">{user?.name ?? 'Account'}</p>
                  <p className="truncate text-xs text-text-muted">{user?.email}</p>
                  <p className="mt-1 text-xs text-text-muted">{company?.name ?? 'Your agency'} · {ROLE_LABEL[user?.role ?? ''] ?? 'Team member'}</p>
                </div>
                <div className="px-3 py-2 sm:hidden"><ThemeToggle /></div>
                <button type="button" role="menuitem" onClick={() => { menu.setOpen(false); navigate('/settings'); }} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-text-muted hover:bg-surface-2 hover:text-text">
                  <Settings className="h-4 w-4" /> Settings
                </button>
                <button type="button" role="menuitem" onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-danger hover:bg-surface-2">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {isCommandOpen && <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />}
    </>
  );
};

export default TopBar;
