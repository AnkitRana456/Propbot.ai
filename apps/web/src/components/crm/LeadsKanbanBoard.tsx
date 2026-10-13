import React from 'react';
import type { LeadItemResponse } from '@propbot/shared';
import { useKanbanBoard } from '../../services/crm.service.js';
import { KanbanColumn } from './KanbanColumn.js';
import { Skeleton } from '../common/Skeleton.js';

interface LeadsKanbanBoardProps {
  onSelectLead: (lead: LeadItemResponse) => void;
}

export const LeadsKanbanBoard: React.FC<LeadsKanbanBoardProps> = ({ onSelectLead }) => {
  const { data: board, isLoading } = useKanbanBoard();

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="w-72 shrink-0 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <Skeleton className="mb-4 h-6 w-32 rounded-lg" />
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const columns = board?.columns || [];

  return (
    <div className="flex gap-4 overflow-x-auto pb-6 pt-1">
      {columns.map(col => (
        <KanbanColumn
          key={col.id}
          stageId={col.id}
          title={col.title}
          leads={col.leads}
          count={col.count}
          onSelectLead={onSelectLead}
        />
      ))}
    </div>
  );
};
