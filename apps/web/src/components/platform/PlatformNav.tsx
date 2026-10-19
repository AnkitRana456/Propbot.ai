import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Compass,
  ArrowRight,
  Menu,
  X,
  Sun,
  Moon,
  Search,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';
import { useTheme } from '../../contexts/ThemeContext.js';

export const PlatformNav: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Products', href: '#products' },
    { label: 'Solutions', href: '#solutions' },
    { label: 'Platform', href: '#platform' },
    { label: 'Intelligence', href: '#demo' },
    { label: 'Pricing', href: '#pricing' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        isScrolled
          ? 'bg-[var(--surface)] border-b border-[var(--border)] shadow-[0_2px_8px_rgba(28,26,22,0.06)]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Architectural Brand Wordmark */}
          <Link to="/" className="flex items-center gap-3.5 group">
            <div className="w-9 h-9 rounded-[6px] bg-[var(--accent)] flex items-center justify-center text-[var(--surface)] border-b-2 border-[var(--accent-hover)] transition-transform group-hover:scale-105">
              <Compass className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-serif text-xl font-medium tracking-tight text-[var(--text)]">
                  PropBot Pro
                </span>
                <span className="blueprint-label px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--accent)] border border-[var(--border)]">
                  AI CRM
                </span>
              </div>
              <span className="text-[11px] font-mono tracking-wide text-[var(--text-muted)] uppercase">
                Architectural Real Estate Platform
              </span>
            </div>
          </Link>

          {/* Editorial Nav Items */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Quick Search, Theme Toggle & Login CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {/* Search Pill */}
            <a
              href="#demo"
              className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] text-xs font-mono hover:text-[var(--text)] hover:border-[var(--text-muted)] transition-colors"
              title="Search intelligence engine"
            >
              <Search className="w-3.5 h-3.5 stroke-[1.5]" />
              <span>Search</span>
              <kbd className="px-1 py-0.2 bg-[var(--surface-2)] border border-[var(--border)] rounded text-[10px]">
                Ctrl K
              </kbd>
            </a>

            {/* Theme Toggle (Limestone / Walnut) */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={`Switch to ${theme === 'light' ? 'Walnut Dark' : 'Limestone Light'}`}
              className="p-2 rounded-[6px] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 stroke-[1.5]" />
              ) : (
                <Sun className="w-4 h-4 stroke-[1.5] text-[var(--brass)]" />
              )}
            </button>

            {/* Login / Auth Option on Side */}
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="btn-terracotta inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wide"
              >
                <span>Dashboard ({user?.name?.split(' ')[0] || 'Advisor'})</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[1.75]" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="btn-ink-outline inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium"
                >
                  <LogIn className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>Login</span>
                </Link>
                <Link
                  to="/dashboard"
                  className="btn-terracotta inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold"
                >
                  <span>Launch Platform</span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[1.75]" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger & Theme Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-[6px] border border-[var(--border)] text-[var(--text-muted)]"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-[6px] border border-[var(--border)] text-[var(--text)]"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 px-3 border-t border-[var(--border)] bg-[var(--surface)] rounded-b-[10px] shadow-[0_8px_20px_rgba(28,26,22,0.1)]">
            <nav className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)] rounded-[6px]"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-3 mt-2 border-t border-[var(--border)] flex flex-col gap-2">
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="btn-ink-outline w-full text-center py-2 text-xs font-medium"
                >
                  Sign In
                </Link>
                <Link
                  to="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="btn-terracotta w-full text-center py-2.5 text-xs font-semibold"
                >
                  Launch CRM Platform
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default PlatformNav;
