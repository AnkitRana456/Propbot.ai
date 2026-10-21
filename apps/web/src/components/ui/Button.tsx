import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'mint' | 'gold' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-5 py-3 gap-2.5 font-bold',
  };

  const variantStyles = {
    primary:
      'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-hover focus-visible:ring-accent shadow-sm',
    secondary:
      'bg-surface-2 text-text border border-border hover:bg-surface-3 active:bg-surface-3 focus-visible:ring-accent',
    outline:
      'border border-border bg-transparent text-text hover:bg-surface-2 focus-visible:ring-accent',
    ghost:
      'bg-transparent text-text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-accent',
    mint:
      'bg-success text-on-accent hover:opacity-90 focus-visible:ring-success shadow-sm',
    gold:
      'bg-brass text-slate-950 font-bold hover:opacity-90 focus-visible:ring-brass shadow-sm',
    danger:
      'bg-danger text-white hover:opacity-90 focus-visible:ring-danger shadow-sm',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      type={props.type ?? 'button'}
      aria-busy={isLoading || undefined}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg
          aria-hidden="true"
          className="animate-spin h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
