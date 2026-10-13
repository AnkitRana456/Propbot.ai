import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Building2, ShieldCheck, Sparkles } from 'lucide-react';
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
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-slate-200/90 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 shadow-sm md:static md:z-auto ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Building2 className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-bold tracking-tight text-slate-900 dark:text-white">
                    PropBot Pro
                  </span>
                  <span className="flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    <Sparkles className="h-2.5 w-2.5 text-blue-500" />
                    v4
                  </span>
                </div>
                <span className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                  {company?.name || 'Prestige Realty'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <nav className="flex flex-col gap-1.5">
            {visibleItems.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                    } ${isCollapsed ? 'justify-center px-2' : ''}`
                  }
                  title={isCollapsed ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-105 ${
                          isActive
                            ? 'text-white'
                            : 'text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-100'
                        }`}
                      />
                      {!isCollapsed && (
                        <div className="flex flex-1 items-center justify-between truncate">
                          <span className="truncate font-medium">{item.label}</span>
                          {item.path === '/approvals' && (pendingApprovalsCount ?? 0) > 0 ? (
                            <span
                              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isActive
                                  ? 'bg-amber-400 text-slate-900'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              }`}
                            >
                              {pendingApprovalsCount}
                            </span>
                          ) : item.badge ? (
                            <span
                              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                              }`}
                            >
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
          </nav>
        </div>

        {/* Footer: User Role Tag & Collapse Toggle */}
        <div className="shrink-0 border-t border-slate-200/80 p-3 dark:border-slate-800">
          {!isCollapsed && (
            <div className="mb-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-2 truncate">
                <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                  {currentRole.replace('_', ' ')}
                </span>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-400/20" />
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="flex w-full items-center justify-center gap-2 rounded-xl p-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
