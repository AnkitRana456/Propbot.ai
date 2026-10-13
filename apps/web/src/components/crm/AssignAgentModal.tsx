import React, { useState } from 'react';
import { X, UserCheck, RefreshCw, User } from 'lucide-react';
import { useAssignLead, useBulkAssign, useRoundRobinAssign } from '../../services/crm.service.js';

interface AssignAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId?: string;
  leadIds?: string[];
  currentAgentId?: string | null;
}

// Sample team members list; can also fetch from company users endpoint
const TEAM_AGENTS = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'John Doe', role: 'Sales Director', email: 'john@example.com' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Priya Sharma', role: 'Senior Property Advisor', email: 'priya@example.com' },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Rahul Verma', role: 'Relationship Manager', email: 'rahul@example.com' },
];

export const AssignAgentModal: React.FC<AssignAgentModalProps> = ({
  isOpen,
  onClose,
  leadId,
  leadIds,
  currentAgentId,
}) => {
  const assignSingleMutation = useAssignLead();
  const bulkAssignMutation = useBulkAssign();
  const roundRobinMutation = useRoundRobinAssign();

  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    currentAgentId || TEAM_AGENTS[0]?.id || '',
  );

  if (!isOpen) return null;

  const isBulk = leadIds && leadIds.length > 0;

  const handleAssign = async () => {
    if (!selectedAgentId) return;

    if (isBulk) {
      await bulkAssignMutation.mutateAsync({
        leadIds,
        agentId: selectedAgentId,
      });
    } else if (leadId) {
      await assignSingleMutation.mutateAsync({
        leadId,
        agentId: selectedAgentId,
      });
    }
    onClose();
  };

  const handleRoundRobin = async () => {
    if (leadId) {
      await roundRobinMutation.mutateAsync(leadId);
      onClose();
    }
  };

  const isPending =
    assignSingleMutation.isPending || bulkAssignMutation.isPending || roundRobinMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <UserCheck className="h-5 w-5" />
            <h3 className="font-bold text-slate-900 dark:text-white">
              {isBulk ? `Assign ${leadIds.length} Leads` : 'Assign Lead to Agent'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Select Agent:
            </label>
            {TEAM_AGENTS.map(agent => (
              <label
                key={agent.id}
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-xs transition-colors ${
                  selectedAgentId === agent.id
                    ? 'border-blue-500 bg-blue-50/50 text-blue-900 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-200 font-semibold'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold">{agent.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                      {agent.role} • {agent.email}
                    </p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="agent"
                  checked={selectedAgentId === agent.id}
                  onChange={() => setSelectedAgentId(agent.id)}
                  className="text-blue-600 focus:ring-blue-500"
                />
              </label>
            ))}
          </div>

          {!isBulk && leadId && (
            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={handleRoundRobin}
                disabled={isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
                Auto Assign via Round-Robin Distribution
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAssign}
              disabled={isPending || !selectedAgentId}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {isPending ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
