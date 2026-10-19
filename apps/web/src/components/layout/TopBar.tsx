import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, Sun, Moon, LogOut, Menu, ChevronRight, Settings } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext.js';
import { useTheme } from '../../contexts/ThemeContext.js';
import { CommandPalette } from '../ui/CommandPalette.js';

interface TopBarProps {
  onOpenMobileMenu: () => void;
  unreadNotificationsCount?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenMobileMenu,
  unreadNotificationsCount = 3,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, company, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [isCommandOpen, setIsCommandOpen] = useState(false);
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

  const sampleNotifications = [
    {
      id: '1',
      title: 'High-Intent Lead Captured (94%)',
      message: 'Amit Patel requested 3BHK brochure on Prestige Lakeside.',
      time: '5m ago',
      unread: true,
      icon: '🔥',
    },
    {
      id: '2',
      title: 'Site Visit Confirmed',
      message: 'Rajesh Nambiar scheduled a physical site visit for Sat 11 AM.',
      time: '24m ago',
      unread: true,
      icon: '📍',
    },
    {
      id: '3',
      title: 'Tier-2 Approval Queued',
      message: 'Quote revision requires partner verification.',
      time: '1h ago',
      unread: true,
      icon: '🛡️',
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Breadcrumb segment title
  const pathName = location.pathname.replace('/', '') || 'dashboard';
  const formattedPageName = pathName.charAt(0).toUpperCase() + pathName.slice(1);

  return (
    <>
      <header className="topbar-premium sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[var(--border)] px-4 sm:px-6 lg:px-8">
        {/* Left Section: Breadcrumb & Mobile Hamburger */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:shadow-[var(--shadow-sm)] transition-all duration-200 md:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
            <span className="text-[var(--text)] font-semibold truncate max-w-[120px] sm:max-w-none">
              {company?.name || 'Prestige Realty'}
            </span>
            <ChevronRight className="h-3 w-3 text-[var(--border)]" />
            <span className="text-[var(--accent)] font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] opacity-60" />
              {formattedPageName}
            </span>
          </nav>
        </div>

        {/* Center: Search (Cmd+K) */}
        <div
          onClick={() => setIsCommandOpen(true)}
          className="relative w-full max-w-sm mx-4 cursor-pointer group hidden sm:block"
        >
          <Search className="absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)] group-hover:text-[var(--accent)] transition-colors duration-200 stroke-[1.5]" />
          <input
            type="text"
            readOnly
            placeholder="Search leads, units, ledger... (Ctrl+K)"
            className="w-full cursor-pointer rounded-[10px] border border-[var(--border)] bg-[var(--surface)] py-2 pr-14 pl-10 text-xs font-mono text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none transition-all duration-200 group-hover:border-[var(--text-faint)] group-hover:shadow-[var(--shadow-sm)]"
          />
          <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-faint)] shadow-[var(--shadow-xs)]">
            ⌘K
          </kbd>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] hover:shadow-[var(--shadow-sm)] transition-all duration-200"
            aria-label="Toggle theme"
            title={`Switch to ${theme === 'light' ? 'Walnut Dark' : 'Limestone Light'}`}
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4 stroke-[1.5] transition-transform duration-300 hover:rotate-[-15deg]" />
            ) : (
              <Sun className="h-4 w-4 stroke-[1.5] text-[var(--brass)] transition-transform duration-300 hover:rotate-[45deg]" />
            )}
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotifOpen(prev => !prev)}
              className="relative flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] hover:shadow-[var(--shadow-sm)] transition-all duration-200"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4 stroke-[1.5]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] text-[8px] font-bold text-white shadow-[var(--shadow-sm)]">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {isNotifOpen && (
              <div className="dropdown-elevated absolute right-0 mt-2.5 w-[340px] p-3 z-50 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                  <span className="blueprint-label text-[var(--text-muted)]">Dispatch Ledger</span>
                  <button
                    onClick={() => setUnreadCount(0)}
                    className="text-[10px] font-mono text-[var(--accent)] hover:underline transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto stagger-children">
                  {sampleNotifications.map(n => (
                    <div
                      key={n.id}
                      className="p-3 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono space-y-1.5 transition-all duration-200 hover:border-[var(--accent-soft)] hover:shadow-[var(--shadow-xs)] cursor-pointer animate-fade-in-up"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{n.icon}</span>
                          <span className="text-[11px] font-semibold text-[var(--text)] leading-tight">{n.title}</span>
                        </div>
                        <span className="text-[10px] text-[var(--text-faint)] whitespace-nowrap">{n.time}</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed pl-6">
                        {n.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(prev => !prev)}
              className="flex items-center gap-2.5 p-1.5 rounded-[8px] border border-[var(--border)] hover:bg-[var(--surface-2)] hover:shadow-[var(--shadow-sm)] transition-all duration-200"
            >
              <div className="w-8 h-8 rounded-[6px] bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] text-[var(--surface)] flex items-center justify-center font-serif text-sm font-medium shadow-[var(--shadow-xs),inset_0_1px_0_rgba(255,255,255,0.15)]">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-serif font-medium text-[var(--text)] leading-none truncate max-w-[90px]">
                  {user?.name || 'Rahul V.'}
                </span>
                <span className="font-mono text-[9px] text-[var(--text-faint)] leading-tight uppercase tracking-wider">
                  Advisor
                </span>
              </div>
            </button>

            {/* User Dropdown */}
            {isMenuOpen && (
              <div className="dropdown-elevated absolute right-0 mt-2.5 w-52 p-2 z-50 space-y-1.5 font-mono text-xs">
                <div className="px-3 py-2 border-b border-[var(--border)]">
                  <div className="font-serif text-sm font-medium text-[var(--text)]">
                    {user?.name || 'Rahul Verma'}
                  </div>
                  <div className="text-[10px] text-[var(--text-faint)] mt-0.5">
                    {user?.email || 'advisor@propbot.pro'}
                  </div>
                </div>
                <button
                  onClick={() => navigate('/settings')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-all duration-200"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Settings</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-[var(--danger)] hover:bg-[var(--surface-2)] transition-all duration-200"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Command Palette */}
      {isCommandOpen && <CommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />}
    </>
  );
};

export default TopBar;
