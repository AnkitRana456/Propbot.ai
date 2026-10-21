import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'mint' | 'gold' | 'rose' | 'slate' | 'outline';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'blue',
  size = 'md',
  icon,
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1 font-semibold',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-bold',
  };

  const variantStyles = {
    blue: 'bg-accent-soft text-accent border border-accent/25',
    mint: 'bg-success-soft text-success border border-success/25',
    gold: 'bg-brass-glow text-warning border border-brass/30',
    rose: 'bg-danger/10 text-danger border border-danger/25',
    slate: 'bg-surface-2 text-text-muted border border-border',
    outline: 'border border-border text-text-muted',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full transition-colors ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
};
