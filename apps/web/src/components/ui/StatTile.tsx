import React from 'react';
import { Card } from './Card.js';
import { Badge } from './Badge.js';

export interface StatTileProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  icon?: React.ReactNode;
  accentColor?: 'blue' | 'mint' | 'gold' | 'rose';
  className?: string;
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  subValue,
  trend,
  icon,
  accentColor = 'blue',
  className = '',
}) => {
  const accentGlow = {
    blue: 'border-l-4 border-l-blue-600',
    mint: 'border-l-4 border-l-teal-500',
    gold: 'border-l-4 border-l-amber-500',
    rose: 'border-l-4 border-l-rose-500',
  };

  return (
    <Card
      radius="xl"
      className={`p-5 transition-all duration-200 hover:shadow-md ${accentGlow[accentColor]} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-extrabold tracking-tight font-display text-slate-900 dark:text-white">
            {value}
          </p>
          {subValue && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{subValue}</p>
          )}
        </div>
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {icon}
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <Badge
            size="sm"
            variant={trend.isPositive ? 'mint' : 'rose'}
          >
            {trend.value}
          </Badge>
          {trend.label && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {trend.label}
            </span>
          )}
        </div>
      )}
    </Card>
  );
};
