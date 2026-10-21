import React, { useEffect, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { TopBar } from './TopBar.js';
import { Calendar, Compass, LayoutDashboard, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';
import { Skeleton } from '../common/Skeleton.js';

const COLLAPSE_KEY = 'propbot_sidebar_collapsed';
const MOBILE_TABS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/inbox', label: 'Inbox', icon: Compass },
  { to: '/appointments', label: 'Visits', icon: Calendar },
  { to: '/chatbots', label: 'Chatbots', icon: Sparkles },
];

export const AppShell: React.FC = () => {
  const { isInitialized } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, isCollapsed ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
  }, [isCollapsed]);

  if (!isInitialized) {
    return (
      <div className="flex h-screen w-full bg-bg" role="status" aria-label="Loading your workspace">
        <div className="hidden w-60 shrink-0 border-r border-border bg-surface p-3 md:block">
          <Skeleton className="mb-6 h-9 w-full" />
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="mb-2 h-9 w-full" />)}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="mb-6 h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg text-text">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-accent">
        Skip to content
      </a>

      <Sidebar isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(prev => !prev)} isMobileOpen={isMobileOpen} onCloseMobile={() => setIsMobileOpen(false)} />

      <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar onOpenMobileMenu={() => setIsMobileOpen(true)} />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto px-4 py-6 pb-20 focus:outline-none sm:px-6 md:pb-8 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      <nav aria-label="Quick navigation" className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-border bg-surface md:hidden">
        {MOBILE_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) => `flex min-w-14 flex-col items-center justify-center gap-0.5 py-1 text-[11px] ${isActive ? 'font-semibold text-accent' : 'text-text-muted hover:text-text'}`}
            >
              <Icon aria-hidden className="h-5 w-5" />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default AppShell;
