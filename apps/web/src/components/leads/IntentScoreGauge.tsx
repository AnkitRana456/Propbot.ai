import React from 'react';
import { Flame, Thermometer, Snowflake, Info, CheckCircle2 } from 'lucide-react';
import type { IntentLabel } from '@propbot/shared';

interface IntentScoreGaugeProps {
  score: number;
  label: IntentLabel;
  reasons: string[];
  size?: 'sm' | 'md' | 'lg';
}

export const IntentScoreGauge: React.FC<IntentScoreGaugeProps> = ({
  score,
  label,
  reasons,
  size: _size = 'md',
}) => {
  const isHot = label === 'hot' || score >= 70;
  const isWarm = (label === 'warm' || score >= 35) && !isHot;

  const colorConfig = isHot
    ? {
        border: 'border-rose-200 dark:border-rose-900/60',
        bg: 'bg-rose-50/70 dark:bg-rose-950/40',
        text: 'text-rose-700 dark:text-rose-300',
        bar: 'bg-gradient-to-r from-orange-500 to-rose-600',
        badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200',
        icon: <Flame className="h-4 w-4 text-rose-600 animate-pulse" />,
      }
    : isWarm
      ? {
          border: 'border-amber-200 dark:border-amber-900/60',
          bg: 'bg-amber-50/70 dark:bg-amber-950/40',
          text: 'text-amber-700 dark:text-amber-300',
          bar: 'bg-gradient-to-r from-amber-400 to-amber-600',
          badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200',
          icon: <Thermometer className="h-4 w-4 text-amber-600" />,
        }
      : {
          border: 'border-slate-200 dark:border-slate-800',
          bg: 'bg-slate-50/70 dark:bg-slate-900/40',
          text: 'text-slate-700 dark:text-slate-300',
          bar: 'bg-gradient-to-r from-slate-400 to-blue-500',
          badge: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
          icon: <Snowflake className="h-4 w-4 text-blue-500" />,
        };

  return (
    <div className={`rounded-xl border ${colorConfig.border} ${colorConfig.bg} p-4 transition-all shadow-xs`}>
      {/* Header with Title and Score Pill */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {colorConfig.icon}
          <span className="text-xs font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
            Live Intent Score
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase ${colorConfig.badge}`}
        >
          {label}
        </span>
      </div>

      {/* Main Score & Progress Bar */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {score}
            <span className="text-sm font-semibold text-slate-400"> / 100</span>
          </span>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isHot ? '🔥 Ready to Buy' : isWarm ? '⚡ Highly Engaged' : '❄ Exploring'}
          </span>
        </div>

        {/* Bar */}
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className={`h-full rounded-full ${colorConfig.bar} transition-all duration-700 ease-out`}
            style={{ width: `${Math.min(100, Math.max(4, score))}%` }}
          />
        </div>
      </div>

      {/* Why This Score Card */}
      <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">
          <Info className="h-3.5 w-3.5 text-slate-400" />
          <span>Why this score (top signals)</span>
        </div>
        <ul className="space-y-1.5">
          {reasons && reasons.length > 0 ? (
            reasons.map((reason, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>{reason}</span>
              </li>
            ))
          ) : (
            <li className="text-xs text-slate-400 italic">Continuous signal analysis in progress</li>
          )}
        </ul>
      </div>
    </div>
  );
};
