import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Compass,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { NAVIGATION_ITEMS, isNavVisible } from '../../config/navigation.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { usePendingApprovalsCount } from '../../services/approvals.service.js';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  const { user, company } = useAuth();
  const currentRole = user?.role || 'company_admin';
  const { data: pendingApprovalsCount } = usePendingApprovalsCount();

  const visibleItems = NAVIGATION_ITEMS.filter(item => isNavVisible(currentRole, item));

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[var(--text)]/30 backdrop-blur-sm md:hidden transition-opacity duration-300"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col sidebar-premium border-r border-[var(--border)] transition-all duration-300 md:static md:z-auto ${
          isCollapsed ? 'w-[68px]' : 'w-[252px]'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
      >
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-b from-[var(--accent)] to-[var(--accent-hover)] text-[var(--surface)] shadow-[var(--shadow-sm),inset_0_1px_0_rgba(255,255,255,0.15)]">
              <Compass className="h-[18px] w-[18px] stroke-[1.75]" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate animate-fade-in-up" style={{ animationDuration: '300ms' }}>
                <span className="font-serif text-[17px] font-medium tracking-tight text-[var(--text)]">
                  PropBot Pro
                </span>
                <span className="font-mono text-[10px] text-[var(--text-faint)] truncate tracking-wide uppercase">
                  {company?.name || 'Prestige Realty'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
          <nav className="flex flex-col gap-3">
            {(['CORE', 'ENGAGE', 'SELL', 'GROW', 'ADMIN'] as const).map(sectionKey => {
              const sectionItems = visibleItems.filter(item => item.section === sectionKey);
              if (sectionItems.length === 0) return null;

              return (
                <div key={sectionKey} className="flex flex-col gap-0.5">
                  {!isCollapsed && (
                    <div className="px-3 pt-2 pb-1.5 flex items-center gap-2">
                      <span className="font-mono text-[10px] font-semibold tracking-[0.1em] uppercase text-[var(--text-faint)]">
                        {sectionKey}
                      </span>
                      <div className="flex-1 h-px bg-gradient-to-r from-[var(--border)] to-transparent" />
                    </div>
                  )}

                  {sectionItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onCloseMobile}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-sans transition-all duration-200 rounded-[8px] ${
                            isActive
                              ? 'nav-item-active text-[var(--accent)] font-semibold'
                              : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] hover:shadow-[var(--shadow-xs)]'
                          } ${isCollapsed ? 'justify-center px-2' : ''}`
                        }
                        title={isCollapsed ? item.label : undefined}
                        style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              className={`h-[18px] w-[18px] shrink-0 stroke-[1.75] transition-all duration-200 ${
                                isActive
                                  ? 'text-[var(--accent)] drop-shadow-[0_0_4px_var(--accent-glow)]'
                                  : 'text-[var(--text-muted)] group-hover:text-[var(--text)] group-hover:scale-105'
                              }`}
                              style={{ transitionTimingFunction: 'var(--ease-spring)' }}
                            />
                            {!isCollapsed && (
                              <div className="flex flex-1 items-center justify-between truncate">
                                <span className="truncate">{item.label}</span>
                                {item.path === '/approvals' && (pendingApprovalsCount ?? 0) > 0 ? (
                                  <span className="ml-auto px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] text-[var(--surface)] shadow-[var(--shadow-xs)] animate-pulse-glow">
                                    {pendingApprovalsCount}
                                  </span>
                                ) : item.badge ? (
                                  <span className="ml-auto px-1.5 py-0.5 rounded-[4px] font-mono text-[9px] font-semibold bg-[var(--surface-2)] text-[var(--brass)] border border-[var(--border)] shadow-[var(--shadow-xs)]">
                                    {item.badge}
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              );
            })}

            {/* Public Showcase Link */}
            <div className="pt-3">
              <div className="divider-depth mb-3" />
              <NavLink
                to="/"
                className={() =>
                  `group flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-sans rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-all duration-200 ${
                    isCollapsed ? 'justify-center px-2' : ''
                  }`
                }
                title={isCollapsed ? 'Public Showcase' : undefined}
              >
                <ExternalLink className="h-[18px] w-[18px] shrink-0 stroke-[1.5] group-hover:scale-105 transition-transform" />
                {!isCollapsed && (
                  <div className="flex flex-1 items-center justify-between">
                    <span>Public Showcase</span>
                    <span className="flex items-center gap-1.5 text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] shadow-[0_0_6px_var(--success-soft)]" />
                      <span className="font-mono text-[var(--success)] font-semibold uppercase tracking-wider">Live</span>
                    </span>
                  </div>
                )}
              </NavLink>
            </div>
          </nav>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[var(--border)] p-3 space-y-2.5">
          {!isCollapsed && (
            <div className="flex items-center justify-between px-3 py-2 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border)] text-xs shadow-[var(--shadow-xs)]">
              <div className="flex items-center gap-2 truncate">
                <ShieldCheck className="h-4 w-4 text-[var(--brass)] shrink-0" />
                <span className="truncate font-mono text-[11px] font-medium text-[var(--text)]">
                  {currentRole.replace('_', ' ')}
                </span>
              </div>
              <span className="h-2 w-2 rounded-full bg-[var(--success)] shadow-[0_0_6px_var(--success-soft)]" />
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="flex w-full items-center justify-center gap-2 rounded-[8px] p-2 text-xs font-mono text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-all duration-200 border border-transparent hover:border-[var(--border)] hover:shadow-[var(--shadow-xs)]"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 stroke-[1.5]" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 stroke-[1.5]" />
                <span className="text-[11px]">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
