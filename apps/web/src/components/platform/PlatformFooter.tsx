import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowRight, ShieldCheck } from 'lucide-react';

export const PlatformFooter: React.FC = () => {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)] transition-colors">
      {/* Pre-Footer Action Banner in Editorial Terracotta */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="relative rounded-[10px] overflow-hidden bg-[var(--accent)] p-8 sm:p-12 lg:p-16 text-[var(--surface)] text-center border-b-4 border-[var(--accent-hover)] shadow-none">
          <div className="relative max-w-2xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface)]/15 text-[var(--surface)] text-xs font-mono">
              <Compass className="w-3.5 h-3.5 stroke-[1.75]" />
              <span>Architectural Intelligence for Real Estate</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight leading-tight">
              Your next verified property buyer starts with a conversation.
            </h2>

            <p className="text-sm sm:text-base opacity-90 leading-relaxed font-sans">
              Discover how PropBot Pro helps your sales team qualify buyer DNA, organize property shortlists, and deliver tailored site visits.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
              <Link
                to="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-[6px] font-semibold bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-all"
              >
                <span>Launch CRM Platform</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-[6px] font-medium bg-transparent text-[var(--surface)] border border-[var(--surface)]/30 hover:bg-[var(--surface)]/10 transition-all"
              >
                <span>Advisor Sign In</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Multi-Column Ledger Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-[var(--border)]">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Info */}
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[6px] bg-[var(--accent)] flex items-center justify-center text-[var(--surface)]">
                <Compass className="w-4 h-4 stroke-[1.75]" />
              </div>
              <span className="font-serif text-xl font-medium text-[var(--text)]">
                PropBot Pro
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-sm leading-relaxed font-sans">
              AI-native CRM and conversation platform tailored for real estate developers, brokerages, and property consultants.
            </p>
            <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
              <ShieldCheck className="w-4 h-4 text-[var(--success)]" />
              <span>RERA-Guarded Grounded RAG</span>
            </div>
          </div>

          {/* Solutions Column */}
          <div className="space-y-2">
            <div className="blueprint-label">Platform</div>
            <ul className="space-y-2 text-xs text-[var(--text-muted)] font-mono">
              <li><Link to="/dashboard" className="hover:text-[var(--text)]">Dashboard</Link></li>
              <li><Link to="/leads" className="hover:text-[var(--text)]">Lead CRM</Link></li>
              <li><Link to="/properties" className="hover:text-[var(--text)]">Property Inventory</Link></li>
              <li><Link to="/appointments" className="hover:text-[var(--text)]">Site Visits</Link></li>
            </ul>
          </div>

          {/* AI Tools Column */}
          <div className="space-y-2">
            <div className="blueprint-label">AI Intelligence</div>
            <ul className="space-y-2 text-xs text-[var(--text-muted)] font-mono">
              <li><Link to="/chatbots" className="hover:text-[var(--text)]">Chatbot Wizard</Link></li>
              <li><Link to="/whatsapp" className="hover:text-[var(--text)]">WhatsApp Cloud</Link></li>
              <li><Link to="/approvals" className="hover:text-[var(--text)]">Safety Queue</Link></li>
              <li><Link to="/analytics" className="hover:text-[var(--text)]">Conversion Ledger</Link></li>
            </ul>
          </div>

          {/* Legal / Access */}
          <div className="space-y-2">
            <div className="blueprint-label">Account</div>
            <ul className="space-y-2 text-xs text-[var(--text-muted)] font-mono">
              <li><Link to="/login" className="hover:text-[var(--text)]">Sign In</Link></li>
              <li><Link to="/register" className="hover:text-[var(--text)]">Register Agency</Link></li>
              <li><Link to="/status" className="hover:text-[var(--text)]">System Health</Link></li>
              <li><Link to="/help" className="hover:text-[var(--text)]">Documentation</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[var(--text-muted)]">
          <div>
            &copy; {new Date().getFullYear()} PropBot Pro. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <span>Limestone &amp; Walnut Architectural Engine</span>
            <span>v4.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default PlatformFooter;
