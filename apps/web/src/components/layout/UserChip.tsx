import React from 'react';
import type { UserRole } from '@propbot/shared';

interface UserChipProps {
  name: string;
  role: UserRole;
  avatarUrl?: string;
  className?: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  company_admin: 'Company Admin',
  sales_manager: 'Sales Manager',
  agent: 'Sales Agent',
  viewer: 'Viewer',
};

export const UserChip: React.FC<UserChipProps> = ({ name, role, className = '' }) => {
  const initials = name
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20 dark:bg-primary/20">
        {initials}
      </div>
      <div className="flex flex-col text-left">
        <span className="text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100">
          {name}
        </span>
        <span className="text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400">
          {ROLE_LABELS[role] || role}
        </span>
      </div>
    </div>
  );
};
