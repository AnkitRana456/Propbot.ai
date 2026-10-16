import React, { useState } from 'react';
import {
  Send,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  X,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { apiRequest } from '../../services/api-client.js';

interface LeadCitation {
  id: string;
  name: string;
  stage?: string;
  status?: string;
  score?: number;
  intentScore?: number;
  intentLabel?: string;
  budgetMin?: number;
  budgetMax?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolUsed?: string;
  citations?: LeadCitation[];
  guardrailTriggered?: boolean;
}

export const AskPipelineWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am your Pipeline Assistant. Ask me anything about your active leads, conversion statistics, site visit bookings, or marketing source performance.',
    },
  ]);

  const quickPrompts = [
    'Who are my hottest leads?',
    'Lead volume by source this month',
    'Show leads with budget above 1 Cr',
    'Site visits scheduled this week',
  ];

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!queryText) setInput('');
    setLoading(true);

    try {
      const response = await apiRequest<{
        answer: string;
        toolUsed?: string;
        citations?: LeadCitation[];
        guardrailTriggered?: boolean;
      }>('/api/growth/ask-pipeline', {
        method: 'POST',
        body: JSON.stringify({ question: textToSend, query: textToSend }),
      });

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        toolUsed: response.toolUsed,
        citations: response.citations,
        guardrailTriggered: response.guardrailTriggered,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to query pipeline';
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Error: ${errorMsg}. Please try rephrasing your question.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          id="ask-pipeline-launcher"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white dark:bg-none dark:bg-[#1f1f1f] dark:border dark:border-[#2a2a2a] dark:text-[#e6e6e6] dark:hover:bg-[#262626] dark:hover:text-white dark:shadow-none"
        >
          <span className="h-3.5 w-3.5 rounded-full flex-none bg-emerald-400 dark:bg-[radial-gradient(circle_at_35%_35%,#b388ff_0%,#7c4dff_50%,#4a148c_100%)] dark:shadow-[0_0_10px_rgba(124,77,255,0.5)] flex items-center justify-center">
            <Sparkles className="h-2.5 w-2.5 text-white dark:hidden" />
          </span>
          <span>Ask Pipeline AI</span>
        </button>
      )}

      {/* Floating Chat Drawer */}
      {isOpen && (
        <div
          id="ask-pipeline-drawer"
          className="fixed bottom-6 right-6 z-50 flex h-[580px] w-[420px] flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 dark:border-[#282828] dark:bg-[#181818] dark:ring-0 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-5 py-3.5 dark:border-[#262626] dark:bg-[#1a1a1a]">
            <div className="flex items-center gap-2.5">
              <span className="h-4 w-4 rounded-full flex-none bg-[radial-gradient(circle_at_35%_35%,#b388ff_0%,#7c4dff_50%,#4a148c_100%)] shadow-[0_0_10px_rgba(124,77,255,0.5)]" />
              <div>
                <h3 className="font-semibold text-slate-100 flex items-center gap-2 text-xs">
                  Ask Pipeline AI
                  <span className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[9px] font-medium text-teal-300 dark:bg-[#262626] dark:text-[#a3a3a3]">
                    AI CRM
                  </span>
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-[#8a8a8a]">
                  <ShieldCheck className="h-3 w-3 text-emerald-400 dark:text-[#4ade80]" />
                  <span>RLS Enforced • Read-Only</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition dark:text-[#8a8a8a] dark:hover:bg-[#222222] dark:hover:text-[#f2f2f2]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-xs shadow-md dark:bg-[#292929] dark:text-[#f5f5f5] dark:border dark:border-[#383838]'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-bl-xs dark:bg-[#1c1c1c] dark:text-[#e6e6e6] dark:border-[#2a2a2a]'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Tool Badge */}
                  {msg.toolUsed && (
                    <div className="mt-2.5 flex items-center gap-1 text-[11px] text-teal-400 dark:text-[#4a8fe7]">
                      <TrendingUp className="h-3 w-3" />
                      <span>Data queried via {msg.toolUsed}</span>
                    </div>
                  )}

                  {/* Guardrail Warning */}
                  {msg.guardrailTriggered && (
                    <div className="mt-2.5 flex items-center gap-1.5 rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-300 dark:bg-amber-950/40 dark:text-amber-400">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>Prompt guardrail triggered: system prompt security active</span>
                    </div>
                  )}
                </div>

                {/* Citations / Lead Cards */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2.5 w-full space-y-2">
                    <span className="text-[11px] font-medium text-slate-400 dark:text-[#8a8a8a] uppercase tracking-wider">
                      Referenced Leads ({msg.citations.length}):
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {msg.citations.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between rounded-xl border border-slate-700/80 bg-slate-950/60 p-2.5 hover:border-teal-500/50 transition dark:border-[#2a2a2a] dark:bg-[#1c1c1c] dark:hover:border-[#4a8fe7]"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300 font-bold text-xs dark:bg-[#262626] dark:text-[#4a8fe7]">
                              {c.name.slice(0, 1)}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-200 dark:text-[#e6e6e6]">{c.name}</div>
                              <div className="text-[10px] text-slate-400 dark:text-[#8a8a8a]">
                                Stage: <span className="text-teal-400 dark:text-[#4a8fe7] capitalize">{c.stage || c.status || 'Active'}</span> • Score: <span className="font-bold text-emerald-400 dark:text-[#4ade80]">{c.score ?? c.intentScore ?? 0}</span>
                              </div>
                            </div>
                          </div>
                          <a
                            href={`/leads`}
                            className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white transition dark:bg-[#262626] dark:text-[#a3a3a3] dark:hover:text-white"
                          >
                            <span>View</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-slate-400 dark:text-[#8a8a8a] text-xs py-2">
                <Loader2 className="h-4 w-4 animate-spin text-teal-400 dark:text-[#b388ff]" />
                <span>Querying pipeline database under tenant RLS...</span>
              </div>
            )}
          </div>

          {/* Quick Prompts Bar */}
          <div className="border-t border-slate-800/80 bg-slate-950/40 p-2.5 dark:border-[#262626] dark:bg-[#181818]">
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  disabled={loading}
                  className="whitespace-nowrap rounded-lg border border-slate-700/60 bg-slate-800/60 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-50 dark:border-[#2a2a2a] dark:bg-[#1f1f1f] dark:text-[#a3a3a3] dark:hover:bg-[#262626] dark:hover:text-[#f2f2f2]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input Footer */}
          <div className="border-t border-slate-800 bg-slate-950/90 p-3 dark:border-[#262626] dark:bg-[#181818]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                id="ask-pipeline-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about pipeline, scores, visits, or sources..."
                disabled={loading}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50 dark:border-[#2a2a2a] dark:bg-[#1c1c1c] dark:text-[#e6e6e6] dark:placeholder:text-[#8a8a8a] dark:focus:border-[#4a8fe7]"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow hover:bg-teal-500 transition disabled:opacity-40 dark:bg-[#292929] dark:hover:bg-[#333333] dark:text-white dark:shadow-none"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
