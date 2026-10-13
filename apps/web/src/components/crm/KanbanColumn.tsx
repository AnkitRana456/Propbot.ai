import React from 'react';
import type { LeadItemResponse, LeadStatus } from '@propbot/shared';
import { KanbanLeadCard } from './KanbanLeadCard.js';

interface KanbanColumnProps {
  stageId: LeadStatus;
  title: string;
  leads: LeadItemResponse[];
  count: number;
  onSelectLead: (lead: LeadItemResponse) => void;
  onDropToStage?: (leadId: string, stageId: LeadStatus) => void;
}

const STAGE_THEMES: Record<string, { pill: string; dot: string }> = {
  new: { pill: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300', dot: 'bg-blue-500' },
  contacted: { pill: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300', dot: 'bg-purple-500' },
  qualified: { pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300', dot: 'bg-emerald-500' },
  site_visit_scheduled: { pill: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300', dot: 'bg-amber-500' },
  site_visit_done: { pill: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300', dot: 'bg-cyan-500' },
  negotiation: { pill: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300', dot: 'bg-indigo-500' },
  booked: { pill: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300', dot: 'bg-teal-500' },
  lost: { pill: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', dot: 'bg-slate-400' },
};

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  stageId,
  title,
  leads,
  count,
  onSelectLead,
}) => {
  const theme = STAGE_THEMES[stageId] || { pill: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' };

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-2xl bg-slate-50/70 p-3 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80">
      {/* Column Header */}
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
            {title}
          </h3>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${theme.pill}`}
        >
          {count}
        </span>
      </div>

      {/* Cards List */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400 dark:border-slate-800">
            <span>No leads in stage</span>
          </div>
        ) : (
          leads.map(lead => (
            <KanbanLeadCard
              key={lead.id}
              lead={lead}
              onClick={() => onSelectLead(lead)}
            />
          ))
        )}
      </div>
    </div>
  );
};
