import React, { useState } from 'react';
import { DEMO_PREVIEW_DATA } from '../../data/platformShowcase.js';
import {
  MessageSquare,
  UserCheck,
  Building,
  Kanban,
  CheckCircle2,
  ArrowRight,
  Send,
  User,
  Bot,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const PlatformInteractiveDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'dna' | 'shortlist' | 'crm'>('chat');

  const tabs = [
    { id: 'chat', label: '24/7 AI Chatbot', icon: MessageSquare, badge: 'Live Dialogue' },
    { id: 'dna', label: 'Buyer DNA & Intent', icon: UserCheck, badge: '0-100 Score' },
    { id: 'shortlist', label: 'Smart Shortlist Room', icon: Building, badge: 'Digital Portal' },
    { id: 'crm', label: 'CRM Kanban Pipeline', icon: Kanban, badge: '6 Stages' },
  ];

  return (
    <section id="demo" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-2)] text-[var(--accent)] border border-[var(--border)] text-xs font-mono mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
          <span>Interactive Architectural Showcase</span>
        </div>
        <h2 className="font-serif text-3xl sm:text-4xl text-[var(--text)] tracking-tight font-medium mb-4">
          Experience PropBot Pro in Action
        </h2>
        <p className="text-sm sm:text-base text-[var(--text-muted)] font-sans">
          Switch between the four core pillars of the platform below to see how customer conversations turn into structured Buyer DNA and closed property sales.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 mb-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-[6px] text-xs font-mono transition-all ${
                isActive
                  ? 'bg-[var(--accent)] text-[var(--surface)] border-b-2 border-[var(--accent-hover)] font-semibold'
                  : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 stroke-[1.75]" />
              <span>{tab.label}</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive
                    ? 'bg-[var(--surface)]/20 text-[var(--surface)]'
                    : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Preview Container */}
      <div className="rounded-[10px] bg-[var(--surface)] border border-[var(--border)] p-6 lg:p-8">
        {/* Tab 1: Live Chat Dialogue */}
        {activeTab === 'chat' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <h3 className="font-serif text-xl text-[var(--text)] font-medium">
                  RERA-Guarded Natural Language Conversation
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Answering pricing, OC status, and carpet area directly from verified builder brochures with 0% hallucination.
                </p>
              </div>
              <span className="pill-badge bg-[#2F5D50]/15 text-[var(--success)] font-mono text-[11px]">
                Grounding Active
              </span>
            </div>

            <div className="space-y-3 max-w-3xl mx-auto">
              {DEMO_PREVIEW_DATA.chat.messages.map((msg: { sender: string; text: string }, idx: number) => (
                <div
                  key={idx}
                  className={`flex gap-3 items-start ${
                    msg.sender === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.sender === 'bot' && (
                    <div className="w-7 h-7 rounded-[4px] bg-[var(--accent)] text-[var(--surface)] flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 stroke-[1.75]" />
                    </div>
                  )}
                  <div
                    className={`p-3.5 rounded-[6px] text-xs max-w-[85%] leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)]'
                        : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] space-y-1.5'
                    }`}
                  >
                    <div>{msg.text}</div>
                  </div>
                  {msg.sender === 'user' && (
                    <div className="w-7 h-7 rounded-[4px] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                      <User className="w-4 h-4 stroke-[1.75]" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[var(--border)] flex items-center gap-2 max-w-3xl mx-auto">
              <input
                type="text"
                readOnly
                value="Can I see the master layout and payment milestones for Tower B?"
                className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-[6px] px-3.5 py-2 text-xs font-mono text-[var(--text)] cursor-not-allowed"
              />
              <button
                disabled
                className="btn-terracotta px-4 py-2 text-xs inline-flex items-center gap-1.5 opacity-80"
              >
                <span>Send</span>
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Buyer DNA & Intent */}
        {activeTab === 'dna' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <h3 className="font-serif text-xl text-[var(--text)] font-medium">
                  Live Buyer DNA Extraction &amp; Intent Scoring
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  PropBot parses conversational cues into structured budget, bedroom, location, and timeline preferences.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="pill-badge bg-[var(--accent-soft)] text-[var(--accent)]">
                  Intent Score: {DEMO_PREVIEW_DATA.dna.intentScore}/100
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-4 rounded-[6px] bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
                <span className="blueprint-label">Contact Information</span>
                <div className="font-serif text-base text-[var(--text)]">
                  {DEMO_PREVIEW_DATA.dna.buyerName}
                </div>
                <div className="font-mono text-xs text-[var(--text-muted)]">
                  {DEMO_PREVIEW_DATA.chat.buyerPhone}
                </div>
                <div className="font-mono text-xs text-[var(--text-muted)]">
                  Verified Contact
                </div>
              </div>

              <div className="p-4 rounded-[6px] bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
                <span className="blueprint-label">Preference Profile</span>
                <div className="font-mono text-xs text-[var(--text)] space-y-1">
                  <div>Budget: <span className="font-semibold text-[var(--accent)]">{DEMO_PREVIEW_DATA.dna.budgetRange}</span></div>
                  <div>Typology: <span className="font-semibold">{DEMO_PREVIEW_DATA.dna.bhk}</span></div>
                  <div>Location: <span className="font-semibold">{DEMO_PREVIEW_DATA.dna.preferredLocality}</span></div>
                  <div>Timeline: <span className="font-semibold">{DEMO_PREVIEW_DATA.dna.timeline}</span></div>
                </div>
              </div>

              <div className="p-4 rounded-[6px] bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
                <span className="blueprint-label">Intent Signals</span>
                <div className="space-y-1.5 text-xs font-mono text-[var(--text-muted)]">
                  {DEMO_PREVIEW_DATA.dna.scoreBreakdown.map((sig: { reason: string; delta: string }, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
                        <span className="truncate">{sig.reason}</span>
                      </div>
                      <span className="text-[var(--success)] font-semibold">{sig.delta}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Smart Shortlist Room */}
        {activeTab === 'shortlist' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <h3 className="font-serif text-xl text-[var(--text)] font-medium">
                  Dynamic Client Shortlist Room
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  A personalized, secure link sent via WhatsApp containing filtered inventory matched to the buyer&apos;s budget.
                </p>
              </div>
              <Link
                to="/dashboard"
                className="btn-ink-outline px-3 py-1.5 text-xs font-mono inline-flex items-center gap-1.5"
              >
                <span>Preview Client Link</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {DEMO_PREVIEW_DATA.shortlist.units.map((unit: { unit: string; bhk: string; carpet: string; price: string; match: string; status: string }) => (
                <div
                  key={unit.unit}
                  className="p-4 rounded-[6px] bg-[var(--surface-2)] border border-[var(--border)] flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-medium text-base text-[var(--text)]">
                        {unit.unit}
                      </span>
                      <span className="pill-badge bg-[#2F5D50]/15 text-[var(--success)]">
                        {unit.status}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-[var(--text-muted)]">
                      {unit.bhk} &bull; {unit.carpet}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between">
                    <span className="font-serif text-lg font-medium text-[var(--accent)]">
                      {unit.price}
                    </span>
                    <button className="btn-terracotta px-3 py-1 text-xs">
                      Schedule Visit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: CRM Kanban Pipeline */}
        {activeTab === 'crm' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <h3 className="font-serif text-xl text-[var(--text)] font-medium">
                  Architectural Deal Pipeline
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Stages separated by 1px hairlines with days-in-stage indicators and ledger totals.
                </p>
              </div>
              <Link
                to="/leads"
                className="btn-terracotta px-3.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <span>Open Full Pipeline</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {DEMO_PREVIEW_DATA.crm.stages.map((st: { name: string; count: number; highlight: string }, i: number) => {
                const colors = ['border-t-[#B84A22]', 'border-t-[#A9822B]', 'border-t-[#2F5D50]', 'border-t-[#C58A1B]', 'border-t-[#2F5D50]', 'border-t-[#6B6355]'];
                return (
                  <div
                    key={i}
                    className={`p-3 rounded-[6px] bg-[var(--surface-2)] border border-[var(--border)] border-t-[3px] ${colors[i % colors.length]} space-y-1.5`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="blueprint-label text-[10px] truncate">{st.name}</span>
                      <span className="font-mono text-xs text-[var(--text)] font-semibold">
                        {st.count}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] truncate">
                      {st.highlight}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default PlatformInteractiveDemo;
