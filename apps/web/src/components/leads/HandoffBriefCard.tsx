import React, { useState, useEffect } from 'react';
import { Flame, Copy, Check, Clock, PhoneCall, Sparkles, Building2 } from 'lucide-react';
import type { HandoffBrief } from '@propbot/shared';

interface HandoffBriefCardProps {
  brief: HandoffBrief;
  slaStartedAt?: string | null;
}

export const HandoffBriefCard: React.FC<HandoffBriefCardProps> = ({ brief, slaStartedAt }) => {
  const [copied, setCopied] = useState(false);
  const [slaElapsed, setSlaElapsed] = useState('00:00');

  useEffect(() => {
    if (!slaStartedAt) return;

    const start = new Date(slaStartedAt).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      const diffSecs = Math.max(0, Math.floor((now - start) / 1000));
      const mins = Math.floor(diffSecs / 60)
        .toString()
        .padStart(2, '0');
      const secs = (diffSecs % 60).toString().padStart(2, '0');
      setSlaElapsed(`${mins}:${secs}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [slaStartedAt]);

  const handleCopyOpener = () => {
    navigator.clipboard.writeText(brief.suggestedOpeningLine);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border-2 border-rose-300 bg-gradient-to-br from-rose-50/90 via-white to-orange-50/70 p-5 shadow-sm dark:border-rose-900 dark:from-rose-950/60 dark:via-slate-900 dark:to-orange-950/40">
      {/* Header with Hot Lead Badge & SLA Timer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-100 pb-3.5 dark:border-rose-900/60">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white shadow-xs">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
              AI Hot Lead Handoff Brief
            </h4>
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              High purchase readiness &bull; Instant agent brief
            </p>
          </div>
        </div>

        {/* SLA Timer */}
        {slaStartedAt && (
          <div className="flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 border border-rose-200 dark:bg-rose-900/60 dark:text-rose-200 dark:border-rose-800">
            <Clock className="h-3.5 w-3.5 text-rose-600 animate-spin" />
            <span>Speed-to-Lead: {slaElapsed}</span>
          </div>
        )}
      </div>

      {/* 3-Line Summary */}
      <div className="mt-3.5 space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
        <p>{brief.summary}</p>
      </div>

      {/* Matching Properties */}
      {brief.matchingProperties && brief.matchingProperties.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <span className="font-semibold">Top Inventory Matches: </span>
          <span className="truncate">{brief.matchingProperties.join(', ')}</span>
        </div>
      )}

      {/* Suggested Phone Opening Line */}
      <div className="mt-4 rounded-xl border border-rose-200/80 bg-white/90 p-3.5 shadow-xs dark:border-rose-900/60 dark:bg-slate-900/90">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Suggested Opening Line
          </span>
          <button
            onClick={handleCopyOpener}
            className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 transition-colors cursor-pointer"
            title="Copy suggested opening line"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Opener</span>
              </>
            )}
          </button>
        </div>
        <p className="text-xs sm:text-sm italic text-slate-800 dark:text-slate-200">
          "{brief.suggestedOpeningLine}"
        </p>
      </div>

      {/* Next Best Action Banner */}
      <div className="mt-3.5 flex items-center justify-between rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 px-4 py-2.5 text-white shadow-xs">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
          <PhoneCall className="h-4 w-4 shrink-0" />
          <span>Next Best Action: {brief.nextBestAction}</span>
        </div>
      </div>
    </div>
  );
};
