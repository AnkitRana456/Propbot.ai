import React, { useState } from 'react';
import { Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { apiRequest } from '../../services/api-client.js';
import { useQueryClient } from '@tanstack/react-query';
import type { NextBestActionItem } from '@propbot/shared';

interface NextBestActionBannerProps {
  leadId: string;
  nba?: NextBestActionItem | null;
}

export const NextBestActionBanner: React.FC<NextBestActionBannerProps> = ({ leadId, nba }) => {
  const queryClient = useQueryClient();
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<string | null>(null);

  if (!nba) return null;

  const handleExecute = async () => {
    setIsExecuting(true);
    setExecutionResult(null);
    try {
      const res = await apiRequest<{ status: string; message: string }>(
        `/api/crm/leads/${leadId}/next-best-action/execute`,
        { method: 'POST' },
      );
      setExecutionResult(res.message || 'Action executed successfully');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approvals-count'] });
    } catch (err: unknown) {
      setExecutionResult((err as Error).message || 'Failed to execute action');
    } finally {
      setIsExecuting(false);
    }
  };

  const isT2 = nba.tier === 'T2';

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 p-4 dark:border-blue-900/60 dark:from-blue-950/40 dark:to-indigo-950/40 shadow-xs space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-950 dark:text-blue-100">
                Recommended Next Best Action
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isT2
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
              }`}>
                {nba.tier} {isT2 ? 'Approval Required' : 'Auto-Exec'}
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              {nba.title}
            </h4>
          </div>
        </div>

        {nba.status === 'executed' ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Executed
          </span>
        ) : (
          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isExecuting ? 'Processing...' : (
              <>
                <span>{isT2 ? 'Submit for Approval' : 'Execute Action'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        )}
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300">
        {nba.explanation}
      </p>

      {executionResult && (
        <div className="text-xs font-medium text-blue-800 dark:text-blue-300 bg-white/70 dark:bg-slate-900/70 p-2 rounded-lg border border-blue-200 dark:border-blue-800">
          {executionResult}
        </div>
      )}
    </div>
  );
};
