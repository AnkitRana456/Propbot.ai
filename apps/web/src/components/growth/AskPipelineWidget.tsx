import React, { useState } from 'react';
import {
  MessageSquareQuote,
  Send,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Calendar,
  X,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { apiRequest } from '../../services/api-client.js';

interface LeadCitation {
  id: string;
  name: string;
  stage: string;
  score: number;
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
        body: JSON.stringify({ query: textToSend }),
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
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-teal-500/25 transition-all duration-200 hover:scale-105 hover:shadow-2xl hover:shadow-teal-500/35 active:scale-95"
        >
          <Sparkles className="h-5 w-5 animate-pulse text-amber-300" />
          <span>Ask Your Pipeline</span>
          <span className="flex h-2 w-2 rounded-full bg-emerald-300 animate-ping" />
        </button>
      )}

      {/* Floating Chat Drawer */}
      {isOpen && (
        <div
          id="ask-pipeline-drawer"
          className="fixed bottom-6 right-6 z-50 flex h-[620px] w-[460px] flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl backdrop-blur-xl ring-1 ring-white/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-indigo-600 shadow-md">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100 flex items-center gap-2 text-sm">
                  Ask Your Pipeline
                  <span className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-medium text-teal-300">
                    AI CRM
                  </span>
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>RLS Enforced • Read-Only Tools</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
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
                      ? 'bg-indigo-600 text-white rounded-br-xs shadow-md'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Tool Badge */}
                  {msg.toolUsed && (
                    <div className="mt-2.5 flex items-center gap-1 text-[11px] text-teal-400">
                      <TrendingUp className="h-3 w-3" />
                      <span>Data queried via {msg.toolUsed}</span>
                    </div>
                  )}

                  {/* Guardrail Warning */}
                  {msg.guardrailTriggered && (
                    <div className="mt-2.5 flex items-center gap-1.5 rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-300">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>Prompt guardrail triggered: system prompt security active</span>
                    </div>
                  )}
                </div>

                {/* Citations / Lead Cards */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2.5 w-full space-y-2">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                      Referenced Leads ({msg.citations.length}):
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {msg.citations.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between rounded-xl border border-slate-700/80 bg-slate-950/60 p-2.5 hover:border-teal-500/50 transition"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300 font-bold text-xs">
                              {c.name.slice(0, 1)}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-200">{c.name}</div>
                              <div className="text-[10px] text-slate-400">
                                Stage: <span className="text-teal-400 capitalize">{c.stage}</span> • Score: <span className="font-bold text-emerald-400">{c.score}</span>
                              </div>
                            </div>
                          </div>
                          <a
                            href={`/leads`}
                            className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white transition"
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
              <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
                <span>Querying pipeline database under tenant RLS...</span>
              </div>
            )}
          </div>

          {/* Quick Prompts Bar */}
          <div className="border-t border-slate-800/80 bg-slate-950/40 p-2.5">
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  disabled={loading}
                  className="whitespace-nowrap rounded-lg border border-slate-700/60 bg-slate-800/60 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input Footer */}
          <div className="border-t border-slate-800 bg-slate-950/90 p-3">
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
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow hover:bg-teal-500 transition disabled:opacity-40"
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
