import React from 'react';
import type { CtaFunnelResponse, RealEstateFunnelResponse } from '@propbot/shared';

interface AnalyticsFunnelsProps {
  ctaFunnel?: CtaFunnelResponse;
  realEstateFunnel?: RealEstateFunnelResponse;
  isLoading?: boolean;
}

export const AnalyticsFunnels: React.FC<AnalyticsFunnelsProps> = ({
  ctaFunnel,
  realEstateFunnel,
  isLoading,
}) => {
  if (isLoading || !ctaFunnel || !realEstateFunnel) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="h-64 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-800" />
        <div className="h-64 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-800" />
      </div>
    );
  }

  const maxReCount = Math.max(1, realEstateFunnel.stages[0]?.count ?? 1);
  const maxCtaCount = Math.max(1, ctaFunnel.stages[0]?.count ?? 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      {/* 7-Stage Real Estate Funnel */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Real-Estate Conversion Funnel
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              From captured lead to booked unit, across every source
            </p>
          </div>
          <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
            {realEstateFunnel?.stages.length ?? 0} Stages
          </span>
        </div>

        <div className="space-y-2">
          {realEstateFunnel.stages.map((stage, idx) => {
            const widthPct = Math.max(12, Math.round((stage.count / maxReCount) * 100));
            return (
              <div key={stage.stage} className="text-xs">
                <div className="flex items-center justify-between font-medium mb-1">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    {stage.label}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {stage.count.toLocaleString()}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px] w-12 text-right">
                      {stage.conversionFromTopPercent}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>

                {idx < realEstateFunnel.stages.length - 1 && (
                  <div className="flex justify-end text-[10px] text-slate-400 mt-0.5 pr-1">
                    ↓ drop-off: {stage.dropOffPercent}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA Funnel */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Chatbot Widget CTA Funnel
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Chats that ended with the buyer's details captured
            </p>
          </div>
          <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800">
            Widget Flow
          </span>
        </div>

        <div className="space-y-3 pt-2">
          {ctaFunnel.stages.map(stage => {
            const widthPct = Math.max(12, Math.round((stage.count / maxCtaCount) * 100));
            const isFailed = stage.stage === 'failed';

            return (
              <div key={stage.stage} className="text-xs">
                <div className="flex items-center justify-between font-medium mb-1">
                  <span
                    className={`font-semibold flex items-center gap-1.5 ${
                      isFailed ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {stage.label}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {stage.count.toLocaleString()}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px] w-12 text-right">
                      {stage.conversionFromPrevPercent}%
                    </span>
                  </div>
                </div>

                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isFailed
                        ? 'bg-rose-500'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500'
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Chats that became leads</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            {`${ctaFunnel.stages.find(x => x.stage === 'completed')?.conversionFromTopPercent ?? 0}%`}
          </span>
        </div>
      </div>
    </div>
  );
};
