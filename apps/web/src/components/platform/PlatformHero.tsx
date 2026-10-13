import React from 'react';
import {
  Sparkles,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Building,
  Flame,
  Bot,
  User,
  ExternalLink,
} from 'lucide-react';

export const PlatformHero: React.FC = () => {
  return (
    <section id="hero" className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Storytelling & CTAs */}
          <div className="lg:col-span-6 flex flex-col items-start text-left">
            {/* Eyebrow Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 mb-6 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                The AI Platform for Real Estate
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15] mb-6">
              Turn Every Property Conversation Into Your{' '}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 bg-clip-text text-transparent">
                Next Opportunity.
              </span>
            </h1>

            {/* Supporting Copy */}
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed mb-8 max-w-xl">
              Meet <strong className="font-semibold text-slate-900 dark:text-white">PropBot Pro</strong> — an AI-powered platform that helps real-estate teams engage buyers, understand their requirements, recommend relevant properties, and move qualified leads toward a site visit.
            </p>

            {/* CTA Group */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto mb-10">
              <a
                href="#demo"
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:-translate-y-0.5"
              >
                <Sparkles className="w-4 h-4" />
                Explore the Platform
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all hover:-translate-y-0.5"
              >
                See How It Works
              </a>
            </div>

            {/* Trust Highlights */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-200 dark:border-slate-800 w-full max-w-lg">
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">0%</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Price Hallucination</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">24/7</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Instant WhatsApp SLA</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">100%</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">RERA-Compliant Data</div>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Product Mockup Preview */}
          <div className="lg:col-span-6 relative">
            {/* Backdrop glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 via-indigo-500/20 to-purple-500/10 rounded-3xl blur-2xl -z-10" />

            {/* Composite Glassmorphic Showcase Stack */}
            <div className="relative rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 shadow-2xl p-5 sm:p-6 backdrop-blur-xl space-y-4">
              {/* Header Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    PB
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      Prestige Lakeside Concierge
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    </div>
                    <div className="text-[10px] text-slate-400">RERA Verified AI Assistant</div>
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Live Inquiry
                </span>
              </div>

              {/* Chat Dialogue Snippet */}
              <div className="space-y-2.5 text-xs">
                {/* User Bubble */}
                <div className="flex gap-2.5 items-start justify-end">
                  <div className="bg-blue-600 text-white px-3.5 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm leading-relaxed">
                    Looking for a lake-facing 3BHK in Whitefield around ₹2.2 Cr. Are units ready to move?
                  </div>
                  <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Bot Bubble */}
                <div className="flex gap-2.5 items-start">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3.5 py-2.5 rounded-2xl rounded-tl-sm max-w-[90%] leading-relaxed space-y-2">
                    <p>
                      Yes! In Tower B, <strong>Unit B-802</strong> (3BHK Lake View) is 1,850 sq.ft. carpet area at ₹2.10 Cr. All OC clearances received with zero GST.
                    </p>
                    <div className="pt-1 flex items-center gap-2 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      RERA: PRM/KA/RERA/1251/446/PR/171015/000452
                    </div>
                  </div>
                </div>
              </div>

              {/* Nested Cards Grid: Buyer DNA + Property Shortlist + Site Visit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Card 1: Live Buyer DNA */}
                <div className="rounded-xl border border-blue-200/70 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                      Live Buyer DNA
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                      <Flame className="w-3 h-3 text-red-500" /> 94% Hot Lead
                    </span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="text-slate-900 dark:text-white font-semibold truncate">Amit Patel (Verified Phone)</div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px]">Budget: ₹2.10 Cr – ₹2.50 Cr</div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px]">Pref: 3BHK / Lake Facing / Whitefield</div>
                  </div>
                </div>

                {/* Card 2: Site Visit Scheduled */}
                <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      VIP Site Visit Confirmed
                    </span>
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="text-slate-900 dark:text-white font-semibold truncate">Saturday, 11:00 AM</div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate">Prestige Lakeside Clubhouse</div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">Assigned: Rahul Sharma</div>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Pill: Shortlist Room Trigger */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Smart Shortlist Room #PR-99
                  </span>
                  <span className="text-[10px] text-slate-500 hidden sm:inline">• 3 Units Matched</span>
                </div>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                  Private Link Dispatched <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* Floating Mini Badge */}
            <div className="absolute -bottom-4 -left-4 sm:-bottom-5 sm:-left-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
                ✓
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Enterprise Tier RLS</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Zero Cross-Tenant Leakage</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
