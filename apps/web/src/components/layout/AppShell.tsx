import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { TopBar } from './TopBar.js';
import { AskPipelineWidget } from '../growth/AskPipelineWidget.js';

export const AppShell: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50/70 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      {/* Collapsible Sidebar */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(prev => !prev)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <TopBar onOpenMobileMenu={() => setIsMobileOpen(true)} unreadNotificationsCount={3} />

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl pb-12">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Floating Ask Your Pipeline AI Assistant */}
      <AskPipelineWidget />
    </div>
  );
};
