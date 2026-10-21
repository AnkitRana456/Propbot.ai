import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAgents, useAssignAgent } from '../../services/agents.service.js';

export const AgentPicker: React.FC<{ chatbotId: string; agentId: string | null | undefined }> = ({ chatbotId, agentId }) => {
  const { data: agents } = useAgents();
  const assign = useAssignAgent();
  const [error, setError] = useState<string | null>(null);

  const change = async (value: string) => {
    setError(null);
    try {
      await assign.mutateAsync({ chatbotId, agentId: value || null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not assign the agent.');
    }
  };

  const usable = (agents ?? []).filter(a => a.status === 'active' && (a.activeVersion || a.id === agentId));

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <label htmlFor="agent-picker" className="text-xs font-bold text-slate-900 dark:text-white">AI agent</label>
      <p className="mt-1 text-[11px] text-slate-500">
        The agent decides how this chatbot behaves, what it knows and what it collects. Without one, the persona below is used.{' '}
        <Link to="/agents" className="font-semibold text-accent hover:underline">Manage agents</Link>
      </p>
      <select
        id="agent-picker"
        value={agentId ?? ''}
        disabled={assign.isPending}
        onChange={e => void change(e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white"
      >
        <option value="">No agent (use persona below)</option>
        {usable.map(a => (
          <option key={a.id} value={a.id}>{a.name}{a.activeVersion ? ` (v${a.activeVersion})` : ''}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-[11px] text-rose-600" role="alert">{error}</p>}
    </div>
  );
};
