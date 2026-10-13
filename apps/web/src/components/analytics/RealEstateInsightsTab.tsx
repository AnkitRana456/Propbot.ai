import React from 'react';
import type { RealEstateInsightsResponse, AiQualityResponse } from '@propbot/shared';
import {
  MapPin,
  Home,
  IndianRupee,
  AlertTriangle,
  Zap,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface RealEstateInsightsTabProps {
  insights?: RealEstateInsightsResponse;
  aiQuality?: AiQualityResponse;
  isLoading?: boolean;
}

export const RealEstateInsightsTab: React.FC<RealEstateInsightsTabProps> = ({
  insights,
  aiQuality,
  isLoading,
}) => {
  if (isLoading || !insights) {
    return (
      <div className="h-72 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-800" />
    );
  }

  const {
    demandByLocality,
    demandByBhk,
    demandByBudget,
    mostAskedObjections,
    responseTimeVsConversion,
    speedToLeadMinutes,
  } = insights;

  return (
    <div className="space-y-6">
      {/* Demand Breakdown Rows */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* BHK Preferences */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Home className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Demand by BHK</h3>
          </div>
          <div className="space-y-2.5">
            {demandByBhk.map(item => (
              <div key={item.label} className="text-xs">
                <div className="flex justify-between font-medium mb-1">
                  <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{item.percentage}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Locality Preferences */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top Localities</h3>
          </div>
          <div className="space-y-2.5">
            {demandByLocality.map(item => (
              <div key={item.label} className="text-xs">
                <div className="flex justify-between font-medium mb-1">
                  <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{item.percentage}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Budget Bands */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <IndianRupee className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Budget Bands</h3>
          </div>
          <div className="space-y-2.5">
            {demandByBudget.map(item => (
              <div key={item.label} className="text-xs">
                <div className="flex justify-between font-medium mb-1">
                  <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{item.percentage}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Objections & Speed-to-lead */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Most Asked Objections */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Most Frequent Objections</h3>
          </div>
          <div className="space-y-3">
            {mostAskedObjections.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{item.objection}</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{item.percentage}%</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">{item.count} buyer mentions</div>
              </div>
            ))}
          </div>
        </div>

        {/* Response Time vs Conversion Cohorts */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Response Time vs Conversion</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            How speed-to-response directly impacts lead qualification rate
          </p>

          <div className="space-y-3">
            {responseTimeVsConversion.map(cohort => (
              <div key={cohort.bucket} className="text-xs">
                <div className="flex justify-between font-medium mb-1">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">{cohort.bucket}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {cohort.conversionRate}% converted
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${cohort.conversionRate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/40 dark:border-blue-900/30 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-blue-900 dark:text-blue-300">Hot-Lead Speed-to-Lead SLA</span>
              <p className="text-[11px] text-blue-700/80 dark:text-blue-400">
                Median time to first agent touchpoint after hot alert
              </p>
            </div>
            <span className="font-mono font-bold text-blue-700 dark:text-blue-300 text-sm">
              {speedToLeadMinutes.median} min
            </span>
          </div>
        </div>
      </div>

      {/* AI Cost and Quality Panel [v4] */}
      {aiQuality && (
        <div className="p-5 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-sm border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white">AI Cost & Quality Control Panel</h3>
            </div>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30">
              Platform Layer [v4]
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <div className="text-xs text-slate-400">LLM Cost / Lead</div>
              <div className="text-lg font-bold text-white mt-1">₹{aiQuality.llmCostPerLead}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Blended token router</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <div className="text-xs text-slate-400">Total Tokens Used</div>
              <div className="text-lg font-bold text-white mt-1">
                {aiQuality.totalTokensUsed.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Budget compliant</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <div className="text-xs text-slate-400">T2 Approvals Pending</div>
              <div className="text-lg font-bold text-white mt-1">
                {aiQuality.approvalQueueStats.pending}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {aiQuality.approvalQueueStats.approved} approved
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <div className="text-xs text-slate-400">Eval Accuracy Trend</div>
              <div className="text-lg font-bold text-emerald-400 mt-1">
                {aiQuality.evalAccuracyTrend[aiQuality.evalAccuracyTrend.length - 1]?.accuracyPercent}%
              </div>
              <div className="text-[10px] text-emerald-400/80 mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Grounded Knowledge
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
