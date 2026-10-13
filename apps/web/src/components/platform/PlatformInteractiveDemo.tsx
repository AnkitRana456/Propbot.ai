import React, { useState } from 'react';
import { DEMO_PREVIEW_DATA } from '../../data/platformShowcase.js';
import {
  MessageSquare,
  UserCheck,
  Building,
  Kanban,
  CheckCircle2,
  Sparkles,
  Flame,
  ArrowRight,
  Send,
} from 'lucide-react';

export const PlatformInteractiveDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'dna' | 'shortlist' | 'crm'>('chat');

  const tabs = [
    { id: 'chat', label: '24/7 AI Chatbot', icon: MessageSquare, badge: 'Live Dialogue' },
    { id: 'dna', label: 'Buyer DNA & Intent', icon: UserCheck, badge: '0-100 Score' },
    { id: 'shortlist', label: 'Smart Shortlist Room', icon: Building, badge: 'Digital Portal' },
    { id: 'crm', label: 'CRM Kanban Pipeline', icon: Kanban, badge: '8 Stages' },
  ];

  return (
    <section id="demo" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          Interactive Product Demo
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
          Experience PropBot Pro in Action
        </h2>
        <p className="text-base text-slate-600 dark:text-slate-300">
          Switch between the four core pillars of the platform below to see how customer conversations turn into structured Buyer DNA and closed property sales.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all shadow-sm ${
                isActive
                  ? 'bg-blue-600 text-white shadow-blue-500/25 shadow-md scale-102'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-blue-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Interactive Mockup Display Canvas */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xl p-6 sm:p-8 overflow-hidden min-h-[480px]">
        {/* TAB 1: AI Chatbot Dialogue */}
        {activeTab === 'chat' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  PB
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {DEMO_PREVIEW_DATA.chat.project} Concierge
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Chatting with {DEMO_PREVIEW_DATA.chat.buyerName}
                  </div>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                Grounded RAG Mode
              </span>
            </div>

            {/* Conversation Flow */}
            <div className="space-y-3 pt-2">
              {DEMO_PREVIEW_DATA.chat.messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'bot' && (
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shrink-0 mt-0.5">
                      AI
                    </div>
                  )}
                  <div
                    className={`px-4 py-3 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm border border-slate-200/50 dark:border-slate-700/50'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Simulated Input */}
            <div className="pt-4 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800">
              <input
                type="text"
                disabled
                placeholder="Buyer replies in English, Hindi, or Hinglish..."
                className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-400 cursor-not-allowed"
              />
              <button disabled className="p-2.5 bg-blue-600 text-white rounded-xl opacity-60 cursor-not-allowed">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Buyer DNA & Intent Score */}
        {activeTab === 'dna' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-900">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Buyer Profile Extracted via Chat
                </div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {DEMO_PREVIEW_DATA.dna.buyerName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Phone Verified • WhatsApp Opt-in Confirmed
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-black text-red-600 dark:text-red-400 flex items-center gap-1 justify-end">
                    <Flame className="w-6 h-6 text-red-500 fill-red-500" />
                    {DEMO_PREVIEW_DATA.dna.intentScore}/100
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 tracking-wider">
                    {DEMO_PREVIEW_DATA.dna.intentLabel}
                  </div>
                </div>
              </div>
            </div>

            {/* Extracted DNA Fields */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div className="text-slate-400 text-[11px] font-medium">Budget Range</div>
                <div className="font-bold text-slate-900 dark:text-white mt-1">{DEMO_PREVIEW_DATA.dna.budgetRange}</div>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div className="text-slate-400 text-[11px] font-medium">Configuration</div>
                <div className="font-bold text-slate-900 dark:text-white mt-1">{DEMO_PREVIEW_DATA.dna.bhk}</div>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div className="text-slate-400 text-[11px] font-medium">Locality</div>
                <div className="font-bold text-slate-900 dark:text-white mt-1">{DEMO_PREVIEW_DATA.dna.preferredLocality}</div>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div className="text-slate-400 text-[11px] font-medium">Timeline</div>
                <div className="font-bold text-slate-900 dark:text-white mt-1">{DEMO_PREVIEW_DATA.dna.timeline}</div>
              </div>
            </div>

            {/* Score Breakdown Reasons */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="text-xs font-bold text-slate-900 dark:text-white mb-2.5">
                Algorithmic Intent Score Breakdown:
              </div>
              <div className="space-y-2 text-xs">
                {DEMO_PREVIEW_DATA.dna.scoreBreakdown.map((sb, i) => (
                  <div key={i} className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      {sb.reason}
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{sb.delta}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Smart Shortlist Room */}
        {activeTab === 'shortlist' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Client Portal • Tokenized Link
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {DEMO_PREVIEW_DATA.shortlist.roomTitle}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>Dwell: <strong>{DEMO_PREVIEW_DATA.shortlist.dwellTime}</strong></span>
                <span>•</span>
                <span>Views: <strong>{DEMO_PREVIEW_DATA.shortlist.views} times</strong></span>
              </div>
            </div>

            {/* Matched Units Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {DEMO_PREVIEW_DATA.shortlist.units.map((u, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-850 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {u.match}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">{u.status}</span>
                    </div>
                    <div className="text-base font-bold text-slate-900 dark:text-white">{u.unit}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{u.bhk}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{u.carpet} Carpet</div>
                  </div>

                  <div className="pt-3 mt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">{u.price}</span>
                    <button className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 flex items-center gap-1">
                      View Tour <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: CRM Pipeline */}
        {activeTab === 'crm' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Developer Real-Estate Pipeline (Live Kanban)
              </div>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                Total Active: 55 Leads
              </span>
            </div>

            {/* Stages Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {DEMO_PREVIEW_DATA.crm.stages.map((st, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-850 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 truncate">{st.name}</div>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                      {st.count}
                    </div>
                  </div>
                  <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-400 truncate">
                    {st.highlight}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between">
              <span>Automated routing active: Hot leads automatically notify sales manager Sarah Jenkins on WhatsApp.</span>
              <span className="font-bold underline cursor-pointer">View CRM Rules</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
