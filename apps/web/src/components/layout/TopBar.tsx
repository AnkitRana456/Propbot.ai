import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  Menu,
  Shield,
  CheckCheck,
  ChevronDown,
} from 'lucide-react';
import type { UserRole } from '@propbot/shared';
import { useAuth } from '../../contexts/AuthContext.js';
import { useTheme } from '../../contexts/ThemeContext.js';
import { UserChip } from './UserChip.js';

interface TopBarProps {
  onOpenMobileMenu: () => void;
  unreadNotificationsCount?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenMobileMenu,
  unreadNotificationsCount = 3,
}) => {
  const navigate = useNavigate();
  const { user, company, logout, switchRole } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(unreadNotificationsCount);

  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const rolesList: { role: UserRole; label: string; desc: string }[] = [
    { role: 'company_admin', label: 'Company Admin', desc: 'Full agency permissions & approvals' },
    { role: 'sales_manager', label: 'Sales Manager', desc: 'Leads, team oversight & analytics' },
    { role: 'agent', label: 'Sales Agent', desc: 'Assigned chats, visits & contacts' },
    { role: 'viewer', label: 'Viewer', desc: 'Read-only access to CRM data' },
  ];

  const sampleNotifications = [
    {
      id: '1',
      title: 'High-Intent Lead Captured (92%)',
      message: 'Amit Patel requested 3BHK brochure on Prestige Lakeside.',
      time: '5m ago',
      unread: true,
    },
    {
      id: '2',
      title: 'Site Visit Confirmed',
      message: 'Rajesh Nambiar scheduled a physical site visit for Sat 11 AM.',
      time: '24m ago',
      unread: true,
    },
    {
      id: '3',
      title: 'Team Member Pending Approval',
      message: 'Neha Gupta joined Prestige Realty as an Agent.',
      time: '1h ago',
      unread: true,
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md dark:border-[#262626] dark:bg-[#1a1a1a] sm:px-6 lg:px-8">
      {/* Left Section: Mobile Hamburger & Global Search */}
      <div className="flex flex-1 items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none dark:text-[#a3a3a3] dark:hover:bg-[#222222] md:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Global Search Input */}
        <div className="relative w-full max-w-md">
          <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-[#8a8a8a]" />
          <input
            type="text"
            placeholder="Search leads, chatbots, properties... (Press '/' to focus)"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2 pr-12 pl-10 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-[#2a2a2a] dark:bg-[#1c1c1c] dark:text-[#e6e6e6] dark:placeholder:text-[#8a8a8a] dark:focus:border-[#4a8fe7] dark:focus:bg-[#1c1c1c] transition-all"
          />
          <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:border-[#2a2a2a] dark:bg-[#262626] dark:text-[#a3a3a3] hidden sm:inline-block">
            /
          </kbd>
        </div>
      </div>

      {/* Right Section: Theme Toggle + Notification Center + User Chip */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Live Tenant Chip */}
        <div className="hidden lg:flex items-center gap-2 rounded-xl border border-blue-200/80 bg-blue-50/70 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-[#2a2a2a] dark:bg-[#1c1c1c] dark:text-[#e6e6e6]">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{company?.name || 'Prestige Realty'}</span>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-[#2a2a2a] dark:bg-[#1f1f1f] dark:text-[#a3a3a3] dark:hover:bg-[#262626] dark:hover:text-[#f2f2f2] dark:shadow-none"
          aria-label="Toggle theme"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4 text-amber-400" />
          )}
        </button>

        {/* Notification Bell with Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(prev => !prev)}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-[#2a2a2a] dark:bg-[#1f1f1f] dark:text-[#a3a3a3] dark:hover:bg-[#262626] dark:hover:text-[#f2f2f2] dark:shadow-none"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#141414] animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Flyout */}
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-[#2a2a2a] dark:bg-[#181818]">
              <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2.5 px-1 dark:border-[#262626]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    Live Alerts
                  </span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-[#262626] dark:text-[#4ade80]">
                    {unreadCount} new
                  </span>
                </div>
                <button
                  onClick={() => setUnreadCount(0)}
                  className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-blue-600 dark:text-[#8a8a8a] dark:hover:text-[#f2f2f2]"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark read
                </button>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {sampleNotifications.map(n => (
                  <div
                    key={n.id}
                    className="flex flex-col gap-1 rounded-xl p-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-[#222222] border border-transparent hover:border-slate-200/50 dark:hover:border-[#2a2a2a]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">
                        {n.title}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-[#8a8a8a]">{n.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-[#8a8a8a]">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Chip & Account / RBAC Switcher Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(prev => !prev)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 sm:px-2.5 shadow-sm transition-all hover:bg-slate-50 dark:border-[#2a2a2a] dark:bg-[#1c1c1c] dark:hover:bg-[#222222]"
          >
            <UserChip name={user?.name || 'Administrator'} role={user?.role || 'company_admin'} />
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-[#8a8a8a]" />
          </button>

          {/* User Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-[#2a2a2a] dark:bg-[#181818]">
              {/* User Overview */}
              <div className="border-b border-slate-100 p-2.5 dark:border-[#262626]">
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {user?.name || 'Administrator'}
                </div>
                <div className="text-xs text-slate-500 dark:text-[#8a8a8a]">
                  {user?.email || 'admin@prestige.com'}
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-[#262626] dark:text-[#4ade80]">
                  <Shield className="h-3 w-3" />
                  <span>Active Role: {user?.role.replace('_', ' ')}</span>
                </div>
              </div>

              {/* RBAC Role Switcher (Live Test Feature) */}
              <div className="p-2">
                <span className="block px-1 pb-1.5 text-[10px] font-bold tracking-wider text-slate-400 dark:text-[#8a8a8a] uppercase">
                  🎭 Live RBAC Role Testing
                </span>
                <div className="space-y-1">
                  {rolesList.map(r => (
                    <button
                      key={r.role}
                      onClick={() => {
                        switchRole(r.role);
                        setIsMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs transition-colors ${
                        user?.role === r.role
                          ? 'bg-blue-600 text-white font-semibold dark:bg-[#292929] dark:text-[#f5f5f5]'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-[#a3a3a3] dark:hover:bg-[#222222] dark:hover:text-[#f2f2f2]'
                      }`}
                    >
                      <div>
                        <div>{r.label}</div>
                        <div
                          className={`text-[10px] ${
                            user?.role === r.role ? 'text-blue-100 dark:text-[#e6e6e6]' : 'text-slate-400 dark:text-[#8a8a8a]'
                          }`}
                        >
                          {r.desc}
                        </div>
                      </div>
                      {user?.role === r.role && <CheckCheck className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Logout Option */}
              <div className="border-t border-slate-100 pt-1 dark:border-[#262626]">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:text-[#f87171] dark:hover:bg-[#222222]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
