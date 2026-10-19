import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { TopBar } from './TopBar.js';
import {
  LayoutDashboard,
  Users,
  Building,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';

export const AppShell: React.FC = () => {
  const { isInitialized } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (!isInitialized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--bg)] text-[var(--text)]">
        <div className="flex flex-col items-center gap-4 animate-fade-in-scale">
          <div className="relative">
            <div className="h-10 w-10 rounded-[10px] bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] shadow-[var(--shadow-lg)] flex items-center justify-center animate-float-soft">
              <Sparkles className="h-5 w-5 text-white/90" />
            </div>
            <div className="absolute inset-0 rounded-[10px] bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] blur-xl opacity-30 animate-pulse" />
          </div>
          <p className="font-mono text-xs text-[var(--text-faint)] tracking-wide">
            Loading PropBot Architectural Engine...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
      {/* Ambient Background Glow — subtle gradient orbs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-[300px] -right-[200px] w-[600px] h-[600px] rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-[200px] -left-[150px] w-[500px] h-[500px] rounded-full opacity-[0.025]"
          style={{ background: 'radial-gradient(circle, var(--brass) 0%, transparent 70%)' }}
        />
      </div>

      {/* Sidebar */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(prev => !prev)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="relative z-10 flex h-full flex-1 flex-col overflow-hidden">
        <TopBar onOpenMobileMenu={() => setIsMobileOpen(true)} unreadNotificationsCount={3} />

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 pb-20 md:pb-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-[var(--border)] bg-[var(--surface)] backdrop-blur-sm md:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        {[
          { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
          { to: '/leads', label: 'Leads', icon: Users },
          { to: '/properties', label: 'Inventory', icon: Building },
          { to: '/appointments', label: 'Visits', icon: Calendar },
          { to: '/chatbots', label: 'AI Bot', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-mono transition-all duration-200 ${
                  isActive
                    ? 'text-[var(--accent)] font-semibold scale-105'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`
              }
            >
              <Icon className="h-4.5 w-4.5 stroke-[1.75]" />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default AppShell;
