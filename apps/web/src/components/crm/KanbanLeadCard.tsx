import React from 'react';
import {
  Clock,
  Flame,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  User,
} from 'lucide-react';
import type { LeadItemResponse } from '@propbot/shared';

interface KanbanLeadCardProps {
  lead: LeadItemResponse;
  onClick: () => void;
  onMoveStage?: (targetStage: string) => void;
}

export const KanbanLeadCard: React.FC<KanbanLeadCardProps> = ({
  lead,
  onClick,
}) => {
  const isHot = lead.intentScore >= 70;
  const isWarm = lead.intentScore >= 35 && !isHot;

  const intentColor = isHot
    ? 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/50 dark:border-rose-900'
    : isWarm
      ? 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-900'
      : 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-800';

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs transition-all hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-blue-500/50"
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="truncate text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {lead.name}
            </h4>
            {lead.phoneVerified && (
              <span title="Phone verified">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {lead.phone}
          </p>
        </div>

        {/* Intent Score Badge */}
        <div
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${intentColor}`}
        >
          {isHot && <Flame className="h-3 w-3 animate-pulse text-rose-500" />}
          <span>{lead.intentScore}%</span>
        </div>
      </div>

      {/* Property Preferences / Budget Chip */}
      {(lead.buyerDna?.budgetMax || (lead.buyerDna?.bhk && lead.buyerDna.bhk.length > 0)) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-600 dark:text-slate-300">
          {lead.buyerDna.bhk && lead.buyerDna.bhk.length > 0 && (
            <span className="rounded-md bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              {lead.buyerDna.bhk.join(', ')}
            </span>
          )}
          {lead.buyerDna.budgetMax && (
            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              ₹{(lead.buyerDna.budgetMax / 10000000).toFixed(1)} Cr
            </span>
          )}
        </div>
      )}

      {/* Tags Chips */}
      {lead.tags && lead.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.tags.slice(0, 3).map((tag, idx) => (
            <span
              key={idx}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            >
              #{tag}
            </span>
          ))}
          {lead.tags.length > 3 && (
            <span className="text-[9px] text-slate-400">+{lead.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Next Follow-up or SLA timer */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          {lead.nextFollowUpAt ? (
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
              <Calendar className="h-3 w-3" />
              {new Date(lead.nextFollowUpAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(lead.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}

          {lead.slaBreachedAt && (
            <span
              title="Speed-to-lead SLA breached"
              className="flex items-center gap-0.5 text-rose-600 font-bold"
            >
              <AlertTriangle className="h-3 w-3" /> SLA
            </span>
          )}
        </div>

        {/* Assigned Agent Avatar / Name */}
        <div className="flex items-center gap-1">
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-[8px] font-bold text-slate-700 dark:text-slate-200">
            {lead.assignedAgentName ? lead.assignedAgentName[0]?.toUpperCase() : <User className="h-2.5 w-2.5" />}
          </div>
          <span className="truncate max-w-[80px]">
            {lead.assignedAgentName || 'Unassigned'}
          </span>
        </div>
      </div>
    </div>
  );
};
