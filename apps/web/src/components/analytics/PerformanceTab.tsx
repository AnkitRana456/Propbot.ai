import React from 'react';
import type { PerformanceResponse } from '@propbot/shared';
import { Globe, Phone } from 'lucide-react';

interface PerformanceTabProps {
  performance?: PerformanceResponse;
  isLoading?: boolean;
}

export const PerformanceTab: React.FC<PerformanceTabProps> = ({ performance, isLoading }) => {
  if (isLoading || !performance) {
    return (
      <div className="h-72 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-800" />
    );
  }

  const { points, channelShare } = performance;
  const maxConv = Math.max(1, ...points.map(p => p.conversations));

  return (
    <div className="space-y-6">
      {/* Top row: Volume chart & Channel Share */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Volume Bar Chart */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Daily Conversation & Lead Volume
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Total visitor chats and captured CRM leads over time
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-500" />
                Conversations
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                Leads
              </span>
            </div>
          </div>

          {/* SVG/Bar Chart */}
          <div className="h-52 flex items-end gap-1.5 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
            {points.map((pt, i) => {
              const convHeight = Math.max(4, Math.round((pt.conversations / maxConv) * 160));
              const leadHeight = Math.max(2, Math.round((pt.leads / maxConv) * 160));

              return (
                <div
                  key={pt.date}
                  title={`${pt.date}: ${pt.conversations} chats, ${pt.leads} leads (${pt.conversionRate}%)`}
                  className="flex-1 min-w-[18px] flex flex-col items-center gap-1 group relative cursor-pointer"
                >
                  <div className="w-full flex items-end justify-center gap-0.5 h-44">
                    <div
                      className="w-2 bg-blue-500/80 group-hover:bg-blue-600 rounded-t-xs transition-all"
                      style={{ height: `${convHeight}px` }}
                    />
                    <div
                      className="w-2 bg-emerald-500/90 group-hover:bg-emerald-600 rounded-t-xs transition-all"
                      style={{ height: `${leadHeight}px` }}
                    />
                  </div>
                  {i % Math.ceil(points.length / 7) === 0 && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {pt.date.slice(5)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Channel Share Card */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Traffic Channel Share
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Engagement ratio across web widget and WhatsApp
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <Globe className="w-4 h-4" />
                    Web Chatbot Widget
                  </span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {channelShare.web}%
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${channelShare.web}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <Phone className="w-4 h-4" />
                    WhatsApp AI Bot
                  </span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {channelShare.whatsapp}%
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${channelShare.whatsapp}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
