import React from 'react';
import type { PeakHourItem } from '@propbot/shared';

interface PeakHoursHeatmapProps {
  heatmap: PeakHourItem[];
}

export const PeakHoursHeatmap: React.FC<PeakHoursHeatmapProps> = ({ heatmap }) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Map data to lookup: `${dow}_${hour}` -> count
  const countMap = new Map<string, number>();
  let maxCount = 1;

  for (const item of heatmap) {
    countMap.set(`${item.dayOfWeek}_${item.hour}`, item.count);
    if (item.count > maxCount) maxCount = item.count;
  }

  const getColorClass = (count: number) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800/60';
    const ratio = count / maxCount;
    if (ratio < 0.25) return 'bg-blue-100 dark:bg-blue-950/80 text-blue-700';
    if (ratio < 0.5) return 'bg-blue-300 dark:bg-blue-800 text-blue-900';
    if (ratio < 0.75) return 'bg-blue-500 dark:bg-blue-600 text-white';
    return 'bg-blue-700 dark:bg-blue-500 text-white font-bold';
  };

  return (
    <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Peak Conversation Hours Heatmap
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Traffic volume by day of week and hour of day (Asia/Kolkata)
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span>Low</span>
          <span className="w-3 h-3 rounded-xs bg-slate-100 dark:bg-slate-800 border" />
          <span className="w-3 h-3 rounded-xs bg-blue-100 dark:bg-blue-950" />
          <span className="w-3 h-3 rounded-xs bg-blue-300 dark:bg-blue-800" />
          <span className="w-3 h-3 rounded-xs bg-blue-500" />
          <span className="w-3 h-3 rounded-xs bg-blue-700" />
          <span>High</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Hour labels */}
          <div className="grid grid-cols-[48px_repeat(24,1fr)] gap-1 mb-1 text-[10px] text-slate-400 text-center font-mono">
            <span />
            {hours.map(h => (
              <span key={h} className={h % 3 === 0 ? 'font-semibold text-slate-600 dark:text-slate-300' : ''}>
                {h % 3 === 0 ? `${h}h` : ''}
              </span>
            ))}
          </div>

          {/* Days rows */}
          {days.map((dayName, dow) => (
            <div key={dayName} className="grid grid-cols-[48px_repeat(24,1fr)] gap-1 mb-1 items-center">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{dayName}</span>
              {hours.map(h => {
                const count = countMap.get(`${dow}_${h}`) ?? 0;
                return (
                  <div
                    key={h}
                    title={`${dayName} at ${h}:00 - ${count} conversations`}
                    className={`h-6 rounded-xs flex items-center justify-center text-[10px] transition-transform hover:scale-125 cursor-pointer ${getColorClass(
                      count,
                    )}`}
                  >
                    {count > 0 && count >= maxCount * 0.75 ? count : ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
