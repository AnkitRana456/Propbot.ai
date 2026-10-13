import React from 'react';
import { Users, UserPlus, CheckSquare, Download, X } from 'lucide-react';
import type { LeadStatus } from '@propbot/shared';

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onOpenAssignModal: () => void;
  onBulkStatusChange: (status: LeadStatus) => void;
  onOpenExportModal: () => void;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  onClearSelection,
  onOpenAssignModal,
  onBulkStatusChange,
  onOpenExportModal,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-slate-900/95 px-5 py-3 text-white shadow-2xl backdrop-blur-md border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-2 border-r border-slate-700 pr-3 text-xs font-bold">
        <CheckSquare className="h-4 w-4 text-blue-400" />
        <span>{selectedCount} selected</span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        {/* Bulk Assign */}
        <button
          onClick={onOpenAssignModal}
          className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 font-medium hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <UserPlus className="h-3.5 w-3.5 text-blue-400" />
          Assign Agent
        </button>

        {/* Bulk Status Dropdown */}
        <div className="relative group">
          <button className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 font-medium hover:bg-slate-700 transition-colors cursor-pointer">
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            Set Stage
          </button>
          <div className="absolute bottom-full left-0 mb-2 hidden w-44 rounded-xl bg-slate-800 p-1 shadow-xl group-hover:block border border-slate-700">
            {[
              { id: 'contacted', label: 'Mark Contacted' },
              { id: 'qualified', label: 'Mark Qualified' },
              { id: 'site_visit_scheduled', label: 'Schedule Visit' },
              { id: 'site_visit_done', label: 'Visit Done' },
              { id: 'negotiation', label: 'Negotiation' },
              { id: 'booked', label: 'Booked / Converted' },
            ].map(s => (
              <button
                key={s.id}
                onClick={() => onBulkStatusChange(s.id as LeadStatus)}
                className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-slate-700 transition-colors cursor-pointer text-slate-200"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Export Selected */}
        <button
          onClick={onOpenExportModal}
          className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 font-medium hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 text-amber-400" />
          Export
        </button>
      </div>

      <button
        onClick={onClearSelection}
        className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
