import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Compass, ExternalLink, X } from 'lucide-react';
import { NAVIGATION_ITEMS, NAV_SECTION_LABEL, isNavVisible, type NavSection } from '../../config/navigation.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { usePendingApprovalsCount } from '../../services/approvals.service.js';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const SECTIONS: NavSection[] = ['CORE', 'ENGAGE', 'SELL', 'GROW', 'ADMIN'];
const STORAGE_KEY = 'propbot_nav_closed';

const readClosed = (): NavSection[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NavSection[]) : [];
  } catch {
    return [];
  }
};

/** 240px sidebar (64px icons when collapsed); a slide-over drawer under 768px. */
export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }) => {
  const { user, company } = useAuth();
  const role = user?.role || 'company_admin';
  const { data: pendingApprovalsCount } = usePendingApprovalsCount();
  const [closed, setClosed] = useState<NavSection[]>(readClosed);
  const visible = NAVIGATION_ITEMS.filter(item => isNavVisible(role, item));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(closed));
    } catch {
      /* storage unavailable */
    }
  }, [closed]);

  // Escape closes the drawer on small screens
  useEffect(() => {
    if (!isMobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseMobile();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobileOpen, onCloseMobile]);

  const toggleSection = (s: NavSection) => setClosed(c => (c.includes(s) ? c.filter(x => x !== s) : [...c, s]));
  // The drawer is always the full-width version; icons-only applies to the desktop rail
  const rail = isCollapsed;

  return (
    <>
      {isMobileOpen && <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm md:hidden" onClick={onCloseMobile} aria-hidden />}

      <aside
        id="app-sidebar"
        aria-label="Main navigation"
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-[240px] flex-col border-r border-border bg-surface transition-transform duration-300 md:static md:z-auto md:transition-[width] ${
          rail ? 'md:w-16' : 'md:w-[240px]'
        } ${isMobileOpen ? 'translate-x-0 shadow-float' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-3">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent">
              <Compass className="h-[18px] w-[18px]" />
            </span>
            <span className={`min-w-0 ${rail ? 'md:hidden' : ''}`}>
              <span className="block text-[15px] font-bold leading-tight text-text">PropBot</span>
              <span className="block truncate text-xs text-text-muted">{company?.name || 'Your agency'}</span>
            </span>
          </div>
          <button type="button" onClick={onCloseMobile} aria-label="Close navigation" className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2 md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3" aria-label="Sections">
          {SECTIONS.map(section => {
            const items = visible.filter(i => i.section === section);
            if (items.length === 0) return null;
            const isClosed = closed.includes(section) && !rail && section !== 'CORE';
            const listId = `nav-${section}`;
            return (
              <div key={section}>
                {section !== 'CORE' && (
                  <button
                    type="button"
                    onClick={() => toggleSection(section)}
                    aria-expanded={!isClosed}
                    aria-controls={listId}
                    className={`mb-1 flex w-full items-center justify-between rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted hover:text-text ${rail ? 'md:hidden' : ''}`}
                  >
                    {NAV_SECTION_LABEL[section]}
                    <ChevronDown aria-hidden className={`h-3.5 w-3.5 transition-transform ${isClosed ? '-rotate-90' : ''}`} />
                  </button>
                )}
                {rail && section !== 'CORE' && <div className="mx-3 mb-1 hidden border-t border-border md:block" />}
                <ul id={listId} hidden={isClosed} className="space-y-0.5">
                  {items.map(item => {
                    const Icon = item.icon;
                    const count = item.path === '/approvals' ? pendingApprovalsCount ?? 0 : 0;
                    return (
                      <li key={item.path}>
                        <NavLink
                          to={item.path}
                          onClick={onCloseMobile}
                          title={rail ? item.label : undefined}
                          className={({ isActive }) =>
                            `group flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${rail ? 'md:justify-center md:px-0' : ''} ${
                              isActive ? 'bg-accent-soft font-semibold text-accent' : 'text-text-muted hover:bg-surface-2 hover:text-text'
                            }`
                          }
                        >
                          <Icon aria-hidden className="h-[18px] w-[18px] shrink-0" />
                          <span className={`flex-1 truncate ${rail ? 'md:sr-only' : ''}`}>{item.label}</span>
                          {count > 0 ? (
                            <span className={`rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-accent ${rail ? 'md:hidden' : ''}`}>{count}</span>
                          ) : item.badge ? (
                            <span className={`rounded bg-surface-2 px-1.5 text-[10px] font-semibold text-success ${rail ? 'md:hidden' : ''}`}>{item.badge}</span>
                          ) : null}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          <div className="border-t border-border pt-2">
            <NavLink
              to="/"
              onClick={onCloseMobile}
              title={rail ? 'Public website' : undefined}
              className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-text-muted hover:bg-surface-2 hover:text-text ${rail ? 'md:justify-center md:px-0' : ''}`}
            >
              <ExternalLink aria-hidden className="h-[18px] w-[18px] shrink-0" />
              <span className={rail ? 'md:sr-only' : ''}>Public website</span>
            </NavLink>
          </div>
        </nav>

        <div className="hidden shrink-0 border-t border-border p-2 md:block">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-controls="app-sidebar"
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold text-text-muted hover:bg-surface-2 hover:text-text"
          >
            {rail ? <ChevronRight className="h-4 w-4" /> : (<><ChevronLeft className="h-4 w-4" /> Collapse</>)}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
