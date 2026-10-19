import React from 'react';
import type { LeadItemResponse } from '@propbot/shared';
import { KanbanLeadCard } from './KanbanLeadCard.js';

interface KanbanColumnProps {
  stageId: string;
  title: string;
  stageColor: string;
  leads: LeadItemResponse[];
  count: number;
  onSelectLead: (lead: LeadItemResponse) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  stageColor,
  leads,
  count,
  onSelectLead,
}) => {
  return (
    <div className="flex w-64 shrink-0 flex-col px-3 py-2">
      {/* Column Header */}
      <div className="mb-3 flex items-center justify-between pb-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span
            style={{ backgroundColor: stageColor }}
            className="h-2 w-2 rounded-full"
          />
          <h3 className="font-serif text-sm font-medium text-[var(--text)] truncate">
            {title}
          </h3>
        </div>
        <span className="font-mono text-[10px] text-[var(--text-muted)] bg-[var(--surface-2)] px-2 py-0.5 rounded-[4px] border border-[var(--border)]">
          {count}
        </span>
      </div>

      {/* Cards List */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto max-h-[calc(100vh-290px)] pr-1">
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[6px] border border-dashed border-[var(--border)] py-8 text-center text-xs font-mono text-[var(--text-muted)]">
            <span>No leads in stage</span>
          </div>
        ) : (
          leads.map(lead => (
            <KanbanLeadCard
              key={lead.id}
              lead={lead}
              stageColor={stageColor}
              onClick={() => onSelectLead(lead)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
