import React from 'react';
import type { LeadItemResponse } from '@propbot/shared';
import { useKanbanBoard } from '../../services/crm.service.js';
import { KanbanColumn } from './KanbanColumn.js';

interface LeadsKanbanBoardProps {
  onSelectLead: (lead: LeadItemResponse) => void;
}

// 6 Required Stages with Muted Earthy Tones
const PIPELINE_STAGES = [
  { id: 'new', title: 'New', color: '#B84A22' },             // Terracotta
  { id: 'contacted', title: 'Contacted', color: '#A9822B' }, // Brass
  { id: 'site_visit_scheduled', title: 'Site Visit', color: '#2F5D50' }, // Pine
  { id: 'negotiation', title: 'Negotiation', color: '#C58A1B' },         // Warm Ochre
  { id: 'booked', title: 'Booked', color: '#2F5D50' },                   // Pine
  { id: 'closed', title: 'Closed', color: '#6B6355' },                   // Muted Stone
];

export const LeadsKanbanBoard: React.FC<LeadsKanbanBoardProps> = ({ onSelectLead }) => {
  const { data: board, isLoading } = useKanbanBoard();

  if (isLoading) {
    return (
      <div className="flex divide-x divide-[var(--border)] border border-[var(--border)] rounded-[10px] bg-[var(--surface)] overflow-x-auto pb-4 pt-2">
        {PIPELINE_STAGES.map(stage => (
          <div key={stage.id} className="w-64 shrink-0 px-3 py-2 space-y-3">
            <div className="h-5 w-24 bg-[var(--surface-2)] rounded animate-pulse" />
            <div className="h-24 w-full bg-[var(--surface-2)] rounded-[6px] animate-pulse" />
            <div className="h-24 w-full bg-[var(--surface-2)] rounded-[6px] animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const rawColumns = board?.columns || [];

  return (
    <div className="editorial-card overflow-hidden">
      {/* Kanban Stages separated by hairlines (NOT boxed) */}
      <div className="flex divide-x divide-[var(--border)] overflow-x-auto pb-4 pt-2">
        {PIPELINE_STAGES.map(stage => {
          // Map backend column or filter
          const matchingCol = rawColumns.find(c => c.id === stage.id);
          const stageLeads = matchingCol ? matchingCol.leads : [];
          const count = matchingCol ? matchingCol.count : 0;

          return (
            <KanbanColumn
              key={stage.id}
              stageId={stage.id}
              title={stage.title}
              stageColor={stage.color}
              leads={stageLeads}
              count={count}
              onSelectLead={onSelectLead}
            />
          );
        })}
      </div>
    </div>
  );
};

export default LeadsKanbanBoard;
