import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  PhoneCall,
  FileText,
  ShieldAlert,
  MessageSquare,
  Copy,
  Check,
  ChevronRight,
  RefreshCw,
  Zap,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { LeadItemResponse } from '@propbot/shared';
import {
  useCopilotSummary,
  useCopilotCallScript,
  useCopilotSuggestReply,
  useCopilotObjectionRebuttal,
} from '../../services/copilot.service.js';

interface AgentCopilotPanelProps {
  lead: LeadItemResponse;
}

export function AgentCopilotPanel({ lead }: AgentCopilotPanelProps) {
  const [activeFeature, setActiveFeature] = useState<'script' | 'summary' | 'replies' | 'rebuttals'>('script');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customObjection, setCustomObjection] = useState('Price is too high compared to nearby projects');

  const summaryMutation = useCopilotSummary(lead.id);
  const scriptMutation = useCopilotCallScript(lead.id);
  const replyMutation = useCopilotSuggestReply(lead.id);
  const rebuttalMutation = useCopilotObjectionRebuttal(lead.id);

  // Auto-generate active feature on mount or when lead changes
  useEffect(() => {
    if (activeFeature === 'script' && !scriptMutation.data && !scriptMutation.isPending && !scriptMutation.isError) {
      scriptMutation.mutate();
    }
  }, [lead.id]);

  const handleSelectFeature = (feature: 'script' | 'summary' | 'replies' | 'rebuttals') => {
    setActiveFeature(feature);
    if (feature === 'script' && !scriptMutation.data && !scriptMutation.isPending) {
      scriptMutation.mutate();
    } else if (feature === 'summary' && !summaryMutation.data && !summaryMutation.isPending) {
      summaryMutation.mutate();
    } else if (feature === 'replies' && !replyMutation.data && !replyMutation.isPending) {
      replyMutation.mutate({ tone: 'warm' });
    } else if (feature === 'rebuttals' && !rebuttalMutation.data && !rebuttalMutation.isPending) {
      rebuttalMutation.mutate({ objection: customObjection });
    }
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Copilot Header Banner */}
      <div className="rounded-xl border border-orange-200/60 bg-gradient-to-r from-orange-50/70 via-amber-50/40 to-slate-50 p-4 dark:border-orange-900/40 dark:from-orange-950/30 dark:via-slate-900 dark:to-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="rounded-lg bg-accent p-2 text-white shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                AI Agent Copilot
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-accent dark:bg-orange-950/60 dark:text-orange-300">
                  Real-time Intelligence
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Grounded real-time sales intelligence personalized to {lead.name}&apos;s Buyer DNA.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-accent dark:text-orange-400 flex items-center gap-1">
            <Zap className="h-3 w-3" /> Live Intent: {lead.intentScore}%
          </span>
        </div>

        {/* Feature Navigation Pills */}
        <div className="mt-3.5 flex flex-wrap gap-2">
          <button
            onClick={() => handleSelectFeature('script')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeFeature === 'script'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <PhoneCall className="h-3.5 w-3.5" />
            60s Call Script
          </button>
          <button
            onClick={() => handleSelectFeature('summary')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeFeature === 'summary'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Lead Summary
          </button>
          <button
            onClick={() => handleSelectFeature('replies')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeFeature === 'replies'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Suggest Reply
          </button>
          <button
            onClick={() => handleSelectFeature('rebuttals')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeFeature === 'rebuttals'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Objection Rebuttals
          </button>
        </div>
      </div>

      {/* Feature Content: 60s Call Script */}
      {activeFeature === 'script' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4.5 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <PhoneCall className="h-3.5 w-3.5 text-accent" /> Personalized Call Script
            </h5>
            <button
              onClick={() => scriptMutation.mutate()}
              disabled={scriptMutation.isPending}
              className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${scriptMutation.isPending ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
          </div>

          {scriptMutation.isPending && (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <span>Generating tailored call script from Buyer DNA...</span>
            </div>
          )}

          {scriptMutation.isError && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Could not generate script. Please try again.</span>
              </div>
              <button
                onClick={() => scriptMutation.mutate()}
                className="font-bold underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {scriptMutation.data && (
            <div className="space-y-3.5 text-xs">
              {/* Call Goal */}
              <div className="rounded-lg bg-orange-50/60 p-2.5 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/40">
                <span className="font-bold text-slate-900 dark:text-white">Call Goal: </span>
                <span className="text-slate-700 dark:text-slate-300">{scriptMutation.data.callGoal}</span>
              </div>

              {/* Opener */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">1. Suggested Opener:</span>
                  <button
                    onClick={() => handleCopy('opener', scriptMutation.data?.suggestedOpener || '')}
                    className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'opener' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    Copy
                  </button>
                </div>
                <p className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 font-medium">
                  &ldquo;{scriptMutation.data.suggestedOpener}&rdquo;
                </p>
              </div>

              {/* Qualifying Questions */}
              <div className="space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">2. Qualifying Questions:</span>
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 pl-1">
                  {scriptMutation.data.qualifyingQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>

              {/* Key Talking Points */}
              <div className="space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300">3. DNA Talking Points:</span>
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 pl-1">
                  {scriptMutation.data.talkingPoints.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>

              {/* Closing Hook */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">4. Closing Hook / Visit Ask:</span>
                  <button
                    onClick={() => handleCopy('hook', scriptMutation.data?.closingHook || '')}
                    className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'hook' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    Copy
                  </button>
                </div>
                <p className="rounded-lg bg-emerald-50/70 p-2.5 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-medium">
                  &ldquo;{scriptMutation.data.closingHook}&rdquo;
                </p>
              </div>
            </div>
          )}

          {!scriptMutation.data && !scriptMutation.isPending && !scriptMutation.isError && (
            <button
              onClick={() => scriptMutation.mutate()}
              className="w-full rounded-lg bg-accent py-2 text-xs font-bold text-white hover:bg-[#a1401d] transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>Generate 60s Call Script</span>
            </button>
          )}
        </div>
      )}

      {/* Feature Content: Executive Lead Summary */}
      {activeFeature === 'summary' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4.5 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-accent" /> Executive Buyer Brief
            </h5>
            <button
              onClick={() => summaryMutation.mutate()}
              disabled={summaryMutation.isPending}
              className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${summaryMutation.isPending ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {summaryMutation.isPending && (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <span>Synthesizing buyer brief and purchase signals...</span>
            </div>
          )}

          {summaryMutation.isError && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Could not generate summary. Please try again.</span>
              </div>
              <button
                onClick={() => summaryMutation.mutate()}
                className="font-bold underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {summaryMutation.data && (
            <div className="space-y-3 text-xs">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200/80 dark:border-slate-700">
                {summaryMutation.data.summary}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Key Requirements</span>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                    {summaryMutation.data.keyRequirements.map((r, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <ChevronRight className="h-3 w-3 text-accent shrink-0" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Stated Objections</span>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                    {summaryMutation.data.statedObjections.map((obj, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <ChevronRight className="h-3 w-3 text-amber-500 shrink-0" />
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800">
                <span className="font-bold text-emerald-900 dark:text-emerald-200 block mb-0.5">Next Best Action:</span>
                <span className="text-emerald-800 dark:text-emerald-300">{summaryMutation.data.recommendedAction}</span>
              </div>
            </div>
          )}

          {!summaryMutation.data && !summaryMutation.isPending && !summaryMutation.isError && (
            <button
              onClick={() => summaryMutation.mutate()}
              className="w-full rounded-lg bg-accent py-2 text-xs font-bold text-white hover:bg-[#a1401d] transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Generate 1-Click Executive Summary</span>
            </button>
          )}
        </div>
      )}

      {/* Feature Content: Strategic Reply Suggestions */}
      {activeFeature === 'replies' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4.5 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-accent" /> Strategic Reply Options
            </h5>
            <button
              onClick={() => replyMutation.mutate({ tone: 'warm' })}
              disabled={replyMutation.isPending}
              className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${replyMutation.isPending ? 'animate-spin' : ''}`} />
              Generate More
            </button>
          </div>

          {replyMutation.isPending && (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <span>Formulating strategic reply suggestions...</span>
            </div>
          )}

          {replyMutation.isError && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Could not generate reply options. Please try again.</span>
              </div>
              <button
                onClick={() => replyMutation.mutate({ tone: 'warm' })}
                className="font-bold underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {replyMutation.data && (
            <div className="space-y-3">
              {replyMutation.data.suggestions.map(sug => (
                <div
                  key={sug.id}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2 hover:border-orange-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-accent dark:text-orange-400">{sug.title}</span>
                    <span className="text-[10px] bg-orange-100 text-accent dark:bg-orange-950/60 dark:text-orange-300 px-2 py-0.5 rounded-full font-semibold">
                      {sug.strategy}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{sug.text}</p>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleCopy(sug.id, sug.text)}
                      className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === sug.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copiedKey === sug.id ? 'Copied' : 'Copy Message'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!replyMutation.data && !replyMutation.isPending && !replyMutation.isError && (
            <button
              onClick={() => replyMutation.mutate({ tone: 'warm' })}
              className="w-full rounded-lg bg-accent py-2 text-xs font-bold text-white hover:bg-[#a1401d] transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Suggest Strategic Replies</span>
            </button>
          )}
        </div>
      )}

      {/* Feature Content: Objection Rebuttals */}
      {activeFeature === 'rebuttals' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4.5 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-accent" /> Real Estate Objection Rebuttals
            </h5>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={customObjection}
              onChange={e => setCustomObjection(e.target.value)}
              placeholder="Enter stated buyer objection..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-accent"
            />
            <button
              onClick={() => rebuttalMutation.mutate({ objection: customObjection })}
              disabled={rebuttalMutation.isPending || !customObjection.trim()}
              className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#a1401d] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              {rebuttalMutation.isPending ? 'Generating...' : 'Get Rebuttal'}
            </button>
          </div>

          {rebuttalMutation.isPending && (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <span>Consulting objection playbook and strategies...</span>
            </div>
          )}

          {rebuttalMutation.isError && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Could not generate rebuttal. Please try again.</span>
              </div>
              <button
                onClick={() => rebuttalMutation.mutate({ objection: customObjection })}
                className="font-bold underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {rebuttalMutation.data && (
            <div className="space-y-3 pt-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Detected Category: {rebuttalMutation.data.detectedCategory.replace(/_/g, ' ')}
              </span>
              {rebuttalMutation.data.rebuttals.map((reb, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-accent dark:text-orange-400">
                      Framework: {reb.framework}
                    </span>
                    <button
                      onClick={() => handleCopy(`reb-${i}`, reb.text)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === `reb-${i}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">&ldquo;{reb.text}&rdquo;</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
