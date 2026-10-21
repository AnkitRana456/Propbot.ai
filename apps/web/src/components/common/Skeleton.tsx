import React from 'react';

export const Skeleton: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ className = '', style }) => {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-surface-3 ${className}`}
      style={style}
    />
  );
};
