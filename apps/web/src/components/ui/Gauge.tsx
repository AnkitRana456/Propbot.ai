import React from 'react';

export interface GaugeProps {
  score: number; // 0 to 100
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
}

export const Gauge: React.FC<GaugeProps> = ({
  score,
  label = 'Intent Score',
  size = 'md',
  showBadge = true,
}) => {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  // Aurora tier colors
  const getColor = (s: number) => {
    if (s >= 70) return { stroke: '#F5B942', text: 'text-amber-500', badge: 'Hot Lead' }; // Gold
    if (s >= 40) return { stroke: '#2563EB', text: 'text-blue-500', badge: 'Warm Lead' }; // Blue
    return { stroke: '#94A3B8', text: 'text-slate-400', badge: 'Cold Lead' }; // Slate
  };

  const { stroke, text, badge } = getColor(clampedScore);

  const dim = {
    sm: { size: 64, strokeWidth: 6, fontSize: 'text-sm' },
    md: { size: 88, strokeWidth: 8, fontSize: 'text-xl' },
    lg: { size: 120, strokeWidth: 10, fontSize: 'text-3xl' },
  }[size];

  const radius = (dim.size - dim.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center gap-1.5">
      <div className="relative inline-flex items-center justify-center">
        <svg
          width={dim.size}
          height={dim.size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={dim.size / 2}
            cy={dim.size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={dim.strokeWidth}
            className="text-slate-200 dark:text-slate-800"
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={dim.size / 2}
            cy={dim.size / 2}
            r={radius}
            stroke={stroke}
            strokeWidth={dim.strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center">
          <span className={`font-extrabold font-display ${dim.fontSize} text-slate-900 dark:text-white`}>
            {clampedScore}
          </span>
          <span className="text-[10px] uppercase font-bold text-slate-400">/ 100</span>
        </div>
      </div>

      {showBadge && (
        <span className={`text-xs font-bold ${text} uppercase tracking-wider`}>
          {badge}
        </span>
      )}

      {label && (
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {label}
        </span>
      )}
    </div>
  );
};
