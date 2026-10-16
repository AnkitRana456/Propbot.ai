import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass' | 'subtle';
  radius?: 'xl' | '2xl';
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  radius = 'xl',
  hoverEffect = false,
  className = '',
  ...props
}) => {
  const radiusStyles = {
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
  };

  const variantStyles = {
    default:
      'bg-white border border-slate-200/90 shadow-sm dark:bg-slate-900 dark:border-slate-800 text-slate-900 dark:text-slate-100',
    elevated:
      'bg-white border border-slate-200/80 shadow-md dark:bg-slate-900 dark:border-slate-800/80 text-slate-900 dark:text-slate-100',
    glass:
      'bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-sm dark:bg-slate-900/70 dark:border-slate-800/60 text-slate-900 dark:text-slate-100',
    subtle:
      'bg-slate-50 border border-slate-200/60 dark:bg-slate-900/40 dark:border-slate-800/50 text-slate-900 dark:text-slate-100',
  };

  const hoverStyle = hoverEffect
    ? 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md'
    : '';

  return (
    <div
      className={`${radiusStyles[radius]} ${variantStyles[variant]} ${hoverStyle} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
