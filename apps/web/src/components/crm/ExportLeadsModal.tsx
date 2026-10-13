import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, Check } from 'lucide-react';
import { useExportLeads } from '../../services/crm.service.js';

interface ExportLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeadIds?: string[];
  activeFilters?: {
    status?: string;
    priority?: string;
    search?: string;
  };
}

const AVAILABLE_COLUMNS: { id: string; label: string }[] = [
  { id: 'name', label: 'Full Name' },
  { id: 'phone', label: 'Phone Number' },
  { id: 'email', label: 'Email Address' },
  { id: 'status', label: 'Pipeline Status' },
  { id: 'lostReason', label: 'Lost Reason' },
  { id: 'intentScore', label: 'Live Intent Score' },
  { id: 'intentLabel', label: 'Intent Tier (Cold/Warm/Hot)' },
  { id: 'priority', label: 'Priority Pill' },
  { id: 'source', label: 'Lead Source' },
  { id: 'assignedAgent', label: 'Assigned Agent' },
  { id: 'pageUrl', label: 'Origin Landing URL' },
  { id: 'nextFollowUp', label: 'Next Follow-up Due' },
  { id: 'createdAt', label: 'Date Captured' },
];

export const ExportLeadsModal: React.FC<ExportLeadsModalProps> = ({
  isOpen,
  onClose,
  selectedLeadIds = [],
  activeFilters = {},
}) => {
  const exportMutation = useExportLeads();
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'name',
    'phone',
    'email',
    'status',
    'intentScore',
    'priority',
    'source',
    'assignedAgent',
    'createdAt',
  ]);

  if (!isOpen) return null;

  const toggleColumn = (id: string) => {
    setSelectedColumns(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    setSelectedColumns(AVAILABLE_COLUMNS.map(c => c.id));
  };

  const deselectAll = () => {
    setSelectedColumns(['name', 'phone']);
  };

  const handleExport = async () => {
    await exportMutation.mutateAsync({
      format: 'csv',
      columns: selectedColumns,
      leadIds: selectedLeadIds.length > 0 ? selectedLeadIds : undefined,
      status: activeFilters.status,
      priority: activeFilters.priority,
      search: activeFilters.search,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <FileSpreadsheet className="h-5 w-5" />
            <h3 className="font-bold text-slate-900 dark:text-white">Export Leads to CSV</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {selectedLeadIds.length > 0
              ? `Exporting ${selectedLeadIds.length} specifically selected leads.`
              : 'Exporting leads matching your current filters.'}
          </p>

          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">Choose Columns to Include:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
              >
                Select all
              </button>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-xs font-semibold text-slate-500 hover:underline dark:text-slate-400 cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800 max-h-56 overflow-y-auto">
            {AVAILABLE_COLUMNS.map(col => {
              const isChecked = selectedColumns.includes(col.id);
              return (
                <label
                  key={col.id}
                  onClick={() => toggleColumn(col.id)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs transition-colors select-none ${
                    isChecked
                      ? 'bg-blue-50/70 text-blue-900 font-medium dark:bg-blue-950/40 dark:text-blue-200'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isChecked
                        ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
                        : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                  <span>{col.label}</span>
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={exportMutation.isPending}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exportMutation.isPending || selectedColumns.length === 0}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              {exportMutation.isPending ? 'Generating CSV...' : 'Download CSV File'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
