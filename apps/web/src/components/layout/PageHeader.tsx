import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Primary action(s) shown on the right (a Button, usually). */
  action?: React.ReactNode;
  /** Small chip next to the title, e.g. a count or status. */
  meta?: React.ReactNode;
  className?: string;
}

/** Title, description and a primary-action slot, shared by every dashboard page. */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, action, meta, className = '' }) => (
  <header className={`mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${className}`}>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-text">{title}</h1>
        {meta}
      </div>
      {description && <p className="mt-1 max-w-2xl text-sm text-text-muted">{description}</p>}
    </div>
    {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
  </header>
);
