import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowRight, PhoneCall, MessageSquare, Sparkles, Bot, Activity, TrendingUp } from 'lucide-react';

export const PlatformHero: React.FC = () => {
  const [activeQuery, setActiveQuery] = useState('Show high-value 3BHK leads in Bandra & Pune');
  const [activeVoiceLanguage, setActiveVoiceLanguage] = useState<'Hindi' | 'Marathi' | 'English'>('Hindi');

  return (
    <section id="hero" className="relative pt-28 pb-20 lg:pt-36 lg:pb-28 overflow-hidden blueprint-grid border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Eyebrow Architectural Tag */}
        <div className="flex items-center gap-2 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--accent)] shadow-none">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            <span className="blueprint-label text-[11px] font-mono tracking-wider font-semibold">
              PropBot Copilot &bull; Architectural Real Estate Intelligence
            </span>
          </div>
        </div>

        {/* Hero Title & Story */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start mb-14">
          <div className="lg:col-span-8">
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[var(--text)] tracking-tight font-normal leading-[1.12] mb-6">
              Your real estate AI team that <em className="italic text-[var(--accent)] font-serif">never sleeps.</em>
            </h1>
            <p className="text-base sm:text-lg text-[var(--text-muted)] leading-relaxed max-w-2xl font-sans mb-8">
              PropBot qualifies property buyers, coaches your sales advisors in real time, and sequences exactly what to do next. Your brokerage does less administrative work and closes more inventory.
            </p>

            {/* CTAs adhering to Terracotta & Ink standards */}
            <div className="flex flex-wrap items-center gap-3.5">
              <Link
                to="/dashboard"
                className="btn-terracotta inline-flex items-center justify-center gap-2.5 px-6 py-3 text-sm tracking-wide"
              >
                <Compass className="w-4 h-4 stroke-[1.75]" />
                <span>See Copilot Live</span>
                <ArrowRight className="w-4 h-4 stroke-[1.75]" />
              </Link>
              <a
                href="#demo"
                className="btn-ink-outline inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium"
              >
                <span>Explore Architectural Workflows</span>
              </a>
              <Link
                to="/login"
                className="btn-ghost-editorial inline-flex items-center gap-1.5 px-4 py-3 text-sm"
              >
                <span>Sign In to CRM &rarr;</span>
              </Link>
            </div>
          </div>

          {/* Quick Ledger Stats separated by hairlines */}
          <div className="lg:col-span-4 bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-4">
            <div className="blueprint-label pb-2 border-b border-[var(--border)]">
              Real-Time Platform Ledger
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-[var(--text-muted)]">Verified Buyers</div>
                <div className="font-serif text-2xl text-[var(--text)] font-medium">14,280+</div>
                <div className="font-mono text-[11px] text-[var(--success)]">+22.4% MoM</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">Avg First Response</div>
                <div className="font-serif text-2xl text-[var(--text)] font-medium">18s</div>
                <div className="font-mono text-[11px] text-[var(--brass)]">WhatsApp & Web</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">Pipeline Value</div>
                <div className="font-serif text-2xl text-[var(--text)] font-medium">₹482 Cr</div>
                <div className="font-mono text-[11px] text-[var(--text-muted)]">Ledger Total</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">Hallucination SLA</div>
                <div className="font-serif text-2xl text-[var(--success)] font-medium">0.00%</div>
                <div className="font-mono text-[11px] text-[var(--success)]">RERA Guarded</div>
              </div>
            </div>
          </div>
        </div>

        {/* LIVE COPILOT DASHBOARD SHOWCASE (Sell.do style hero recreated in Terracotta & Ink) */}
        <div className="relative border border-[var(--border)] rounded-[10px] bg-[var(--surface)] shadow-[0_8px_30px_rgba(28,26,22,0.06)] overflow-hidden">
          {/* Mockup Window Titlebar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#D9645C] border border-[#A3302A]/30" />
              <span className="w-3 h-3 rounded-full bg-[#E0A53A] border-[#C58A1B]/30" />
              <span className="w-3 h-3 rounded-full bg-[#6FA593] border-[#2F5D50]/30" />
              <span className="ml-3 font-mono text-[11px] text-[var(--text-muted)]">
                app.propbot.pro/copilot
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="blueprint-label">Status: Active AI Dispatch</span>
              <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
            </div>
          </div>

          {/* Copilot Core Grid Layout */}
          <div className="p-5 lg:p-7 space-y-6">
            {/* Copilot Top Sub-header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="font-serif text-2xl text-[var(--text)] font-medium">
                    Jarvis Copilot &bull; Real Estate Revenue Engine
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-mono text-[10px] font-semibold">
                    Always On
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Autonomous lead triage, voice coaching, and predictive inventory matching.
                </p>
              </div>

              <Link
                to="/dashboard"
                className="btn-terracotta px-3.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Open in App</span>
              </Link>
            </div>

            {/* Natural Language Prompt & Next Best Action Box */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-8 space-y-4">
                {/* Natural Language Search Input */}
                <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[6px] p-3.5">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-2 font-mono">
                    <span className="flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-[var(--accent)]" />
                      Ask Copilot (Plain Language)
                    </span>
                    <span className="text-[10px]">Natural Language RAG</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-[6px] px-3.5 py-2.5">
                    <span className="text-xs font-mono text-[var(--text)]">
                      &ldquo;{activeQuery}&rdquo;
                    </span>
                    <button
                      onClick={() =>
                        setActiveQuery(
                          activeQuery.includes('Bandra')
                            ? 'Rank top 5 ready-to-move penthouses under ₹4.5 Cr'
                            : 'Show high-value 3BHK leads in Bandra & Pune'
                        )
                      }
                      className="text-[11px] font-mono text-[var(--accent)] hover:underline whitespace-nowrap"
                    >
                      Cycle Query
                    </button>
                  </div>

                  {/* Query Result Card */}
                  <div className="mt-3 bg-[var(--surface)] border border-[var(--border)] rounded-[6px] p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-medium text-[var(--text)]">
                        3 high-priority leads over ₹2.1 Cr &bull; Idle 4+ days
                      </span>
                      <span className="blueprint-label">Triage Priority</span>
                    </div>
                    <div className="space-y-1 text-xs text-[var(--text-muted)] font-mono">
                      <div className="flex justify-between py-0.5 border-b border-[var(--border)]/60">
                        <span>&bull; Sana Kapoor (3BHK Lakeview, Bandra West)</span>
                        <span className="text-[var(--text)]">₹2.8 Cr &bull; Idle 5d</span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-[var(--border)]/60">
                        <span>&bull; Rohit Malhotra (4BHK Duplex, Koregaon Park)</span>
                        <span className="text-[var(--text)]">₹3.4 Cr &bull; Idle 4d</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span>&bull; Iqbal Siddiqui (Commercial Office, BKC)</span>
                        <span className="text-[var(--text)]">₹5.2 Cr &bull; Idle 6d</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[var(--accent-soft)] text-[var(--accent)] font-mono text-[11px] font-medium">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Next best action: Call Sana Kapoor now — 94% Intent, viewed floorplan 3x
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Voice Agent Preview with Live Audio Waveform */}
                <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[6px] p-3.5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-[var(--success)]" />
                      <span className="font-mono font-medium text-[var(--text)]">
                        Autonomous AI Voice Agent
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#6FA593]/20 text-[var(--success)] font-mono text-[10px]">
                        Live Call 00:42
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-mono">
                      {(['Hindi', 'Marathi', 'English'] as const).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setActiveVoiceLanguage(lang)}
                          className={`px-2 py-0.5 rounded-[4px] transition-colors ${
                            activeVoiceLanguage === lang
                              ? 'bg-[var(--accent)] text-[var(--surface)]'
                              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[6px] p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[var(--danger)] animate-ping" />
                        <span className="font-serif font-medium text-[var(--text)]">Calling Rohit M.</span>
                        <span className="blueprint-label">
                          {activeVoiceLanguage} &bull; Auto-detected
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-[var(--success)]">Positive Sentiment</span>
                    </div>

                    {/* Simulated Audio Waveform Bar Spectrum */}
                    <div className="flex items-center gap-1 h-6 py-1">
                      {[12, 24, 18, 30, 16, 28, 22, 34, 18, 26, 32, 14, 28, 20, 30, 24, 16, 22, 18, 28, 32, 20, 14].map(
                        (h, i) => (
                          <div
                            key={i}
                            style={{ height: `${h}px` }}
                            className={`w-1 rounded-full ${
                              i % 2 === 0 ? 'bg-[var(--accent)]' : 'bg-[var(--brass)]'
                            } transition-all duration-300`}
                          />
                        )
                      )}
                    </div>

                    <div className="text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-2)] p-2 rounded-[4px]">
                      &ldquo;Haan ji, budget ₹2.2 Cr tak theek rahega. Kya Saturday morning 11 baje site visit confirm ho sakti hai?&rdquo;
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side Column: Lead Score Dial + Call Coaching Matrix */}
              <div className="lg:col-span-4 space-y-4">
                {/* AI Lead Score Card */}
                <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[6px] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="blueprint-label">AI Lead Score</span>
                    <span className="font-mono text-[10px] text-[var(--success)] font-semibold">
                      HIGH CONVERSION
                    </span>
                  </div>

                  <div className="flex items-center gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-[6px] p-3">
                    <div className="w-16 h-16 rounded-full border-4 border-[var(--success)] flex flex-col items-center justify-center shrink-0">
                      <span className="font-serif text-xl font-medium text-[var(--text)]">92</span>
                      <span className="text-[9px] font-mono text-[var(--success)] uppercase font-bold">
                        HOT
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-serif font-medium text-sm text-[var(--text)]">
                        Sana Kapoor
                      </div>
                      <div className="font-mono text-xs text-[var(--text-muted)]">
                        ₹2.1 Cr &bull; 3 BHK &bull; Baner
                      </div>
                    </div>
                  </div>

                  {/* Why Hot Ledger Breakdown */}
                  <div className="space-y-1.5 text-[11px] font-mono text-[var(--text-muted)]">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text)] font-semibold">
                      Conversion Evidence:
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                      <span>Opened cost sheet 3x in 24 hours</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                      <span>Spent 3m 40s in Shortlist Room</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                      <span>Replied on WhatsApp within 90 seconds</span>
                    </div>
                  </div>
                </div>

                {/* Call Coaching & Speech Analytics Card */}
                <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[6px] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="blueprint-label">Call Analysis &amp; Coaching</span>
                    <Activity className="w-3.5 h-3.5 text-[var(--brass)]" />
                  </div>

                  <div className="space-y-2 font-mono text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[var(--text)]">Rohan K. (Objection Handling)</span>
                        <span className="text-[var(--success)]">88%</span>
                      </div>
                      <div className="h-1.5 w-full bg-[var(--surface)] rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--success)] w-[88%]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[var(--text)]">Aarti D. (Value Pitching)</span>
                        <span className="text-[var(--brass)]">72%</span>
                      </div>
                      <div className="h-1.5 w-full bg-[var(--surface)] rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--brass)] w-[72%]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[var(--text)]">Vikram P. (Closing Urgency)</span>
                        <span className="text-[var(--accent)]">64%</span>
                      </div>
                      <div className="h-1.5 w-full bg-[var(--surface)] rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--accent)] w-[64%]" />
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] font-mono text-[var(--text-muted)] pt-1 border-t border-[var(--border)]">
                    Recommendation: Coach Vikram on payment milestone disclosures.
                  </div>
                </div>
              </div>
            </div>

            {/* Night Log Banner (Copilot worked overnight) */}
            <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[6px] p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                <span className="font-semibold text-[var(--text)]">Copilot Worked Overnight:</span>
                <span className="text-[var(--text-muted)]">
                  Scored 100% of yesterday’s inbound chats, re-ranked pipeline by purchase intent, and queued 12 next-best actions before 8:00 AM.
                </span>
              </div>
              <Link
                to="/dashboard"
                className="text-[var(--accent)] hover:underline whitespace-nowrap font-medium"
              >
                Review Night Triage &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Floating Quick Action Buttons on Bottom Right (Terracotta & Pine styling) */}
        <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2.5">
          <a
            href="https://wa.me/"
            target="_blank"
            rel="noopener noreferrer"
            title="Connect on WhatsApp"
            className="w-12 h-12 rounded-full bg-[#2F5D50] hover:bg-[#254b40] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(47,93,80,0.35)] transition-transform hover:scale-105 border border-[#6FA593]/40"
          >
            <MessageSquare className="w-5 h-5 stroke-[1.75]" />
          </a>
          <Link
            to="/appointments"
            title="Book Site Visit or Call"
            className="w-12 h-12 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(184,74,34,0.35)] transition-transform hover:scale-105 border border-[var(--surface)]/20"
          >
            <PhoneCall className="w-5 h-5 stroke-[1.75]" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PlatformHero;
