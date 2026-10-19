import React from 'react';

export const Skeleton: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ className = '', style }) => {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700/60 ${className}`}
      style={style}
    />
  );
};
