import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

export const PlatformFooter: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 transition-colors">
      {/* Pre-Footer Action Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-8 sm:p-12 lg:p-16 text-white text-center shadow-2xl">
          {/* Subtle Background Pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

          <div className="relative max-w-2xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-semibold border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-blue-200" />
              Start Driving Site Visits Today
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              Your Next Property Lead Could Start With a Conversation.
            </h2>

            <p className="text-base sm:text-lg text-blue-100 leading-relaxed">
              Discover how PropBot Pro can help your real estate team engage buyers, organize opportunities, and deliver more personalized property journeys.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <a
                href="#demo"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold bg-white text-blue-700 hover:bg-blue-50 shadow-lg shadow-black/10 transition-all hover:scale-102"
              >
                Explore the Platform
                <ArrowRight className="w-4 h-4" />
              </a>
              <Link
                to="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold bg-blue-800/60 hover:bg-blue-800 text-white border border-white/20 transition-all"
              >
                Open Demo Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Multi-Column Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-100 dark:border-slate-800/80">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Info */}
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                PropBot<span className="text-blue-600">.ai</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-4">
              The AI platform for modern real estate builders, developers, and brokers. Grounded in RERA project disclosures with zero price hallucinations.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Multi-Tenant Architecture with PostgreSQL Row-Level Security</span>
            </div>
          </div>

          {/* Column 1: Platform */}
          <div>
            <div className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white mb-3">
              Platform
            </div>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li><a href="#hero" className="hover:text-blue-600 dark:hover:text-blue-400">Overview</a></li>
              <li><a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400">AI Concierge</a></li>
              <li><a href="#demo" className="hover:text-blue-600 dark:hover:text-blue-400">Buyer DNA Engine</a></li>
              <li><a href="#demo" className="hover:text-blue-600 dark:hover:text-blue-400">Shortlist Rooms</a></li>
              <li><Link to="/status" className="hover:text-blue-600 dark:hover:text-blue-400">System Status</Link></li>
            </ul>
          </div>

          {/* Column 2: Solutions */}
          <div>
            <div className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white mb-3">
              Solutions
            </div>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li><a href="#audience" className="hover:text-blue-600 dark:hover:text-blue-400">For Developers</a></li>
              <li><a href="#audience" className="hover:text-blue-600 dark:hover:text-blue-400">For Channel Partners</a></li>
              <li><a href="#audience" className="hover:text-blue-600 dark:hover:text-blue-400">For Luxury Brokerages</a></li>
              <li><a href="#audience" className="hover:text-blue-600 dark:hover:text-blue-400">Commercial Real Estate</a></li>
              <li><a href="#how-it-works" className="hover:text-blue-600 dark:hover:text-blue-400">Site Visit Engine</a></li>
            </ul>
          </div>

          {/* Column 3: CRM & Access */}
          <div>
            <div className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white mb-3">
              Quick Links
            </div>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li><Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400">Sign In to CRM</Link></li>
              <li><Link to="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400">Live Dashboard</Link></li>
              <li><Link to="/help" className="hover:text-blue-600 dark:hover:text-blue-400">Support & Helpdesk</Link></li>
              <li><Link to="/status" className="hover:text-blue-600 dark:hover:text-blue-400">Uptime & Latency</Link></li>
              <li><a href="#faq" className="hover:text-blue-600 dark:hover:text-blue-400">RERA Compliance FAQ</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>
            © {new Date().getFullYear()} PropBot Pro Technologies Inc. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <span>RERA Compliant Architecture</span>
            <span>•</span>
            <span>GDPR & DPDP Ready</span>
            <span>•</span>
            <Link to="/status" className="hover:text-blue-600">99.98% SLA</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
