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
    default: 'bg-surface border border-border shadow-sm text-text',
    elevated: 'bg-surface border border-border shadow-md text-text',
    glass: 'bg-surface/70 backdrop-blur-md border border-border/60 shadow-sm text-text',
    subtle: 'bg-surface-2 border border-border/60 text-text',
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
