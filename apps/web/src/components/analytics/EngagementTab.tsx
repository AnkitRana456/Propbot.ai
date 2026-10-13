import React from 'react';
import type { EngagementResponse } from '@propbot/shared';
import { PeakHoursHeatmap } from './PeakHoursHeatmap.js';

interface EngagementTabProps {
  engagement?: EngagementResponse;
  isLoading?: boolean;
}

export const EngagementTab: React.FC<EngagementTabProps> = ({ engagement, isLoading }) => {
  if (isLoading || !engagement) {
    return (
      <div className="h-72 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-800" />
    );
  }

  const { heatmap, messagesPerChat, dropOffSteps } = engagement;

  return (
    <div className="space-y-6">
      {/* 7x24 Peak Hours Heatmap */}
      <PeakHoursHeatmap heatmap={heatmap} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Messages Per Conversation Distribution */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Messages per Conversation
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Conversation depth and interaction length breakdown
          </p>

          <div className="space-y-3">
            {messagesPerChat.map(bucket => (
              <div key={bucket.bucket} className="text-xs">
                <div className="flex items-center justify-between font-medium mb-1">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">{bucket.bucket}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono">{bucket.count} chats</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono w-10 text-right">
                      {bucket.percentage}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.max(5, bucket.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Drop-off Stage Analysis */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Visitor Drop-off Turn Analysis
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            At which conversational step visitors typically abandon chat
          </p>

          <div className="space-y-3">
            {dropOffSteps.map(step => (
              <div key={step.step} className="text-xs">
                <div className="flex items-center justify-between font-medium mb-1">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">{step.step}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono">{step.count} abandoned</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400 font-mono w-10 text-right">
                      {step.percentage}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-rose-500"
                    style={{ width: `${Math.max(5, step.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
