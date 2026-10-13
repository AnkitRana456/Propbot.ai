import React, { useState } from 'react';
import {
  Send,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronUp,
  Edit3,
  Bot,
  User,
  Zap,
} from 'lucide-react';
import type { RagQueryResponse } from '@propbot/shared';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  responseMeta?: RagQueryResponse;
}

interface TestChatWidgetProps {
  onTestQuery: (query: string) => Promise<RagQueryResponse>;
  onCorrectAnswer: (question: string) => void;
  botName?: string;
}

export const TestChatWidget: React.FC<TestChatWidgetProps> = ({
  onTestQuery,
  onCorrectAnswer,
  botName = 'PropBot AI',
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: `Hello! I am ${botName}. Ask me anything about our residences, pricing, amenities, or RERA approvals to test the knowledge base.`,
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});

  const samplePrompts = [
    'What is the starting price?',
    'What is the clubhouse size?',
    'When is the possession date?',
    'What are the approved banks for home loans?',
  ];

  const toggleCitation = (msgId: string) => {
    setExpandedCitations(prev => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText ?? inputQuery).trim();
    if (!textToSend || isLoading) return;

    const userMsgId = String(Date.now());
    const newMessages: Message[] = [
      ...messages,
      { id: userMsgId, sender: 'user', text: textToSend },
    ];
    setMessages(newMessages);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await onTestQuery(textToSend);
      const botMsgId = String(Date.now() + 1);
      setMessages([
        ...newMessages,
        {
          id: botMsgId,
          sender: 'bot',
          text: response.answer,
          responseMeta: response,
        },
      ]);
      // Auto-expand citations if available
      if (response.citations && response.citations.length > 0) {
        setExpandedCitations(prev => ({ ...prev, [botMsgId]: true }));
      }
    } catch (err: unknown) {
      setMessages([
        ...newMessages,
        {
          id: String(Date.now() + 1),
          sender: 'bot',
          text: err instanceof Error ? err.message : 'Error retrieving grounded response.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'bot',
        text: `Hello! I am ${botName}. Ask me anything about our residences, pricing, amenities, or RERA approvals to test the knowledge base.`,
      },
    ]);
  };

  const getConfidenceBadge = (confidence: number, overrideApplied?: boolean) => {
    if (overrideApplied) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <Sparkles className="w-3 h-3 text-purple-600" />
          Override (100%)
        </span>
      );
    }
    const pct = Math.round(confidence * 100);
    if (pct >= 85) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          {pct}% Confidence
        </span>
      );
    }
    if (pct >= 65) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          {pct}% Moderate Confidence
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <AlertTriangle className="w-3 h-3 text-rose-600" />
        {pct}% Low Confidence
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-sm">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900">RAG Interactive Playground</h3>
            <p className="text-[10px] text-slate-500">Live test queries against verified chunks</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleReset}
          title="Reset conversation"
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/30">
        {messages.map(msg => {
          const isUser = msg.sender === 'user';
          const meta = msg.responseMeta;
          const isCitationOpen = expandedCitations[msg.id];

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
            >
              <div className="flex items-start gap-2 max-w-[92%]">
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                    isUser
                      ? 'bg-emerald-600 text-white rounded-tr-sm shadow-sm'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>

              {/* Bot response metadata & citations */}
              {!isUser && meta && (
                <div className="pl-9 space-y-2 w-full max-w-[92%]">
                  <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-500">
                    {getConfidenceBadge(meta.confidence, meta.overrideApplied)}
                    <span className="flex items-center gap-1 font-mono">
                      <Zap className="w-3 h-3 text-amber-500" />
                      {meta.latencyMs}ms
                    </span>
                    <span className="font-mono text-slate-400">
                      {meta.tokensUsed.total} tokens
                    </span>

                    {/* Correct button */}
                    <button
                      type="button"
                      onClick={() => {
                        // find the preceding user message
                        const lastUser = [...messages]
                          .reverse()
                          .find(m => m.sender === 'user');
                        onCorrectAnswer(lastUser?.text || '');
                      }}
                      className="text-emerald-700 hover:text-emerald-800 font-semibold hover:underline flex items-center gap-1 ml-auto"
                    >
                      <Edit3 className="w-3 h-3" />
                      Correct answer
                    </button>
                  </div>

                  {/* Citations section */}
                  {meta.citations && meta.citations.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                      <button
                        type="button"
                        onClick={() => toggleCitation(msg.id)}
                        className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-700 bg-slate-50/70 hover:bg-slate-100 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-emerald-600" />
                          {meta.citations.length} Grounded Source Citation
                          {meta.citations.length > 1 ? 's' : ''}
                        </span>
                        {isCitationOpen ? (
                          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>

                      {isCitationOpen && (
                        <div className="p-2.5 space-y-2 border-t border-slate-100 bg-white">
                          {meta.citations.map((cite, cIdx) => (
                            <div
                              key={cIdx}
                              className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] space-y-1"
                            >
                              <div className="flex items-center justify-between font-semibold text-slate-800">
                                <span>{cite.sourceTitle}</span>
                                <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                  {Math.round(cite.similarityScore * 100)}% match
                                </span>
                              </div>
                              {cite.sectionHeader && (
                                <p className="text-[10px] text-slate-500 font-medium">
                                  Section: {cite.sectionHeader}
                                </p>
                              )}
                              <p className="text-slate-600 text-[10px] italic line-clamp-3 bg-white p-1.5 rounded border border-slate-100">
                                "{cite.snippet}"
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 pl-9 text-xs text-slate-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-medium animate-pulse">
              Searching vector chunks & generating verified response...
            </span>
          </div>
        )}
      </div>

      {/* Suggested prompts */}
      <div className="p-3 border-t border-slate-100 bg-white">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
          Quick Test Questions
        </div>
        <div className="flex flex-wrap gap-1.5">
          {samplePrompts.map((prompt, pIdx) => (
            <button
              key={pIdx}
              type="button"
              onClick={() => handleSend(prompt)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition-colors border border-slate-200/60"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input query field */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask a test question (e.g. What is the carpet area?)..."
            value={inputQuery}
            onChange={e => setInputQuery(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isLoading}
            className="p-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-40 shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
