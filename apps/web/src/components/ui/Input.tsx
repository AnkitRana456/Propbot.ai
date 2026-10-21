import React, { useId } from 'react';

interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  id: string;
  children: React.ReactNode;
  className?: string;
}

/** Label, control, hint and error wired together for screen readers. */
export const FieldShell: React.FC<FieldShellProps> = ({ label, hint, error, id, children, className = '' }) => (
  <div className={className}>
    {label && (
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-text">
        {label}
      </label>
    )}
    {children}
    {error ? (
      <p id={`${id}-error`} className="mt-1 text-xs text-danger" role="alert">
        {error}
      </p>
    ) : hint ? (
      <p id={`${id}-hint`} className="mt-1 text-xs text-text-muted">
        {hint}
      </p>
    ) : null}
  </div>
);

export const controlClass =
  'w-full rounded-lg border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-faint transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, hint, error, leftIcon, className = '', id, ...props }, ref) => {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={className}>
      <div className="relative">
        {leftIcon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint">{leftIcon}</span>}
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={`${controlClass} ${error ? 'border-danger' : 'border-border hover:border-text-faint'} ${leftIcon ? 'pl-9' : ''}`}
          {...props}
        />
      </div>
    </FieldShell>
  );
});
Input.displayName = 'Input';
