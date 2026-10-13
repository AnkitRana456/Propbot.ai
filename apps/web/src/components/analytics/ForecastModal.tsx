import React, { useState } from 'react';
import { X, TrendingUp, Info } from 'lucide-react';
import { useForecast } from '../../services/analytics.service.js';

interface ForecastModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForecastModal: React.FC<ForecastModalProps> = ({ isOpen, onClose }) => {
  const [metric, setMetric] = useState<'conversations' | 'leads'>('leads');
  const { data: forecast, isLoading } = useForecast(metric);

  if (!isOpen) return null;

  const points = forecast?.points || [];
  const maxVal = Math.max(1, ...points.map(p => p.confidenceUpper));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-3xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  30-Day Predictive Forecast
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 uppercase">
                  Statistical Estimate
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Moving average projection with day-of-week cyclical seasonality and 80% confidence interval
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metric Selector & Projection Summary */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="inline-flex rounded-lg bg-slate-200/70 dark:bg-slate-800 p-0.5 text-xs font-semibold">
            <button
              onClick={() => setMetric('leads')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                metric === 'leads'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Leads Forecast
            </button>
            <button
              onClick={() => setMetric('conversations')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                metric === 'conversations'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Conversations Forecast
            </button>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-500 dark:text-slate-400">Projected 30-Day Total</span>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono">
              ~{forecast?.projectedTotal?.toLocaleString() ?? 0} {metric}
            </div>
          </div>
        </div>

        {/* Forecast Projection Chart */}
        <div className="p-5 flex-1">
          {isLoading ? (
            <div className="py-20 text-center text-xs text-slate-400">Calculating time-series projection...</div>
          ) : (
            <div className="space-y-4">
              <div className="h-56 flex items-end gap-1.5 pt-6 pb-2 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
                {points.map((pt, i) => {
                  const upperHeight = Math.max(8, Math.round((pt.confidenceUpper / maxVal) * 160));
                  const predHeight = Math.max(4, Math.round((pt.predictedValue / maxVal) * 160));

                  return (
                    <div
                      key={pt.date}
                      title={`${pt.date}: Predicted ${pt.predictedValue} (Range: ${pt.confidenceLower} - ${pt.confidenceUpper})`}
                      className="flex-1 min-w-[16px] flex flex-col items-center gap-1 group relative cursor-pointer"
                    >
                      <div className="w-full flex flex-col items-center justify-end h-44 relative">
                        {/* Confidence interval band bar */}
                        <div
                          className="w-2.5 rounded-t-xs bg-blue-100 dark:bg-blue-950/60 border-t border-blue-300 dark:border-blue-700 absolute bottom-0"
                          style={{ height: `${upperHeight}px` }}
                        />
                        {/* Predicted value bar */}
                        <div
                          className="w-1.5 rounded-t-xs bg-blue-600 z-10"
                          style={{ height: `${predHeight}px` }}
                        />
                      </div>
                      {i % 5 === 0 && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {pt.date.slice(5)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend & Methodology */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
                    <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
                    Predicted Value
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <span className="w-2.5 h-2.5 rounded-xs bg-blue-100 dark:bg-blue-950 border border-blue-300" />
                    80% Confidence Interval Band
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-500 flex items-start gap-2 mt-4">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Methodology:</strong> Calculated from your agency's past 30 days of actual traffic and lead qualification rates, weighted by 7-day day-of-week seasonality (e.g. accounting for typical weekend site visit spikes).
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
