import React from 'react';

export type LeadStatusKey = 'new' | 'contacted' | 'qualified' | 'site-visit' | 'negotiation' | 'won' | 'lost';

/** Maps the API's lead statuses onto the seven pill colours. */
const STATUS_MAP: Record<string, { key: LeadStatusKey; label: string }> = {
  new: { key: 'new', label: 'New' },
  contacted: { key: 'contacted', label: 'Contacted' },
  qualified: { key: 'qualified', label: 'Qualified' },
  site_visit_scheduled: { key: 'site-visit', label: 'Site visit' },
  site_visit_done: { key: 'site-visit', label: 'Visited' },
  negotiation: { key: 'negotiation', label: 'Negotiation' },
  booked: { key: 'won', label: 'Booked' },
  converted: { key: 'won', label: 'Won' },
  lost: { key: 'lost', label: 'Lost' },
};

export const STATUS_KEYS: LeadStatusKey[] = ['new', 'contacted', 'qualified', 'site-visit', 'negotiation', 'won', 'lost'];

export const statusInfo = (status: string) => STATUS_MAP[status] ?? { key: 'new' as LeadStatusKey, label: status.replace(/_/g, ' ') };

export const StatusBadge: React.FC<{ status: string; className?: string; as?: 'span' | 'button'; onClick?: () => void }> = ({ status, className = '', as = 'span', onClick }) => {
  const { key, label } = statusInfo(status);
  const style = { backgroundColor: `var(--status-${key}-bg)`, color: `var(--status-${key}-fg)` } as React.CSSProperties;
  const cls = `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`;
  const dot = <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />;
  if (as === 'button') {
    return (
      <button type="button" onClick={onClick} style={style} className={`${cls} cursor-pointer hover:brightness-95`}>
        {dot}
        {label}
      </button>
    );
  }
  return (
    <span style={style} className={cls}>
      {dot}
      {label}
    </span>
  );
};
