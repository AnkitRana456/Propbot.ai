import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trendText?: string;
  trendType?: 'positive' | 'neutral' | 'negative';
  accentColor?: 'blue' | 'emerald' | 'purple' | 'amber' | 'indigo' | 'rose';
}

const COLOR_MAP = {
  blue: {
    bg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60',
    ring: 'group-hover:border-blue-500/40',
  },
  emerald: {
    bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60',
    ring: 'group-hover:border-emerald-500/40',
  },
  purple: {
    bg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60',
    ring: 'group-hover:border-purple-500/40',
  },
  amber: {
    bg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60',
    ring: 'group-hover:border-amber-500/40',
  },
  indigo: {
    bg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60',
    ring: 'group-hover:border-indigo-500/40',
  },
  rose: {
    bg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60',
    ring: 'group-hover:border-rose-500/40',
  },
};

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  icon: Icon,
  trendText,
  trendType = 'positive',
  accentColor = 'blue',
}) => {
  const styles = COLOR_MAP[accentColor] || COLOR_MAP.blue;

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 ${styles.ring}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {title}
        </span>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles.bg}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>

        {trendText && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              trendType === 'positive'
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                : trendType === 'negative'
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {trendType === 'positive' && <TrendingUp className="h-3 w-3" />}
            {trendType === 'negative' && <TrendingDown className="h-3 w-3" />}
            <span>{trendText}</span>
          </span>
        )}
      </div>
    </div>
  );
};
