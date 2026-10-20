import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Plus, Sparkles, Trash2, Archive, ArchiveRestore, X, Layers, MessageSquare } from 'lucide-react';
import type { AgentItem } from '@propbot/shared';
import {
  useAgents,
  useAgentTemplates,
  useCreateAgent,
  useDeleteAgent,
  useUpdateAgent,
} from '../services/agents.service.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Skeleton } from '../components/common/Skeleton.js';

const TEMPLATE_ICON_TINT: Record<string, string> = {
  lead_qualifier: 'bg-blue-500/10 text-blue-600',
  site_visit_booker: 'bg-emerald-500/10 text-emerald-600',
  emi_helper: 'bg-amber-500/10 text-amber-600',
  neighbourhood_guide: 'bg-violet-500/10 text-violet-600',
  reengagement: 'bg-rose-500/10 text-rose-600',
  blank: 'bg-slate-500/10 text-slate-600',
};

const CreateAgentModal: React.FC<{ onClose: () => void; onCreated: (id: string) => void }> = ({ onClose, onCreated }) => {
  const { data: templates, isLoading } = useAgentTemplates();
  const create = useCreateAgent();
  const [template, setTemplate] = useState<string>('lead_qualifier');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const chosen = templates?.find(t => t.id === template);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const finalName = name.trim() || chosen?.name || 'New agent';
    try {
      const res = await create.mutateAsync({ name: finalName, template, tags: [] });
      onCreated(res.agent.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the agent.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label="Create agent">
      <form onSubmit={submit} className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white">Create an agent</h2>
            <p className="mt-1 text-xs text-slate-500">Start from a real-estate template, then make it yours in the studio.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {isLoading && <Skeleton className="h-16 w-full" />}
          {templates?.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplate(t.id)}
              className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                template === t.id ? 'border-[#B84A22] bg-orange-50/60 dark:bg-orange-950/20' : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${TEMPLATE_ICON_TINT[t.id] ?? TEMPLATE_ICON_TINT.blank}`}>
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{t.name}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{t.description}</p>
            </button>
          ))}
        </div>

        <label className="mt-4 block text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="agent-name">
          Agent name
        </label>
        <input
          id="agent-name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={chosen?.name ?? 'e.g. Lakeside qualifier'}
          maxLength={150}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-800 dark:text-white"
        />
        {error && <p className="mt-2 text-xs text-rose-600" role="alert">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            Cancel
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-xl bg-gradient-to-r from-[#B84A22] to-[#c75528] px-5 py-2 text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
          >
            {create.isPending ? 'Creating…' : 'Create & open studio'}
          </button>
        </div>
      </form>
    </div>
  );
};

const AgentCard: React.FC<{ agent: AgentItem; onOpen: () => void }> = ({ agent, onOpen }) => {
  const update = useUpdateAgent();
  const del = useDeleteAgent();
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900">
      <div>
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={onOpen} className="min-w-0 text-left cursor-pointer">
            <h3 className="truncate font-serif text-sm font-bold text-slate-900 hover:text-[#B84A22] dark:text-white">{agent.name}</h3>
          </button>
          {agent.status === 'archived' ? (
            <Badge variant="slate" size="sm">Archived</Badge>
          ) : agent.activeVersion ? (
            <Badge variant="mint" size="sm">Live v{agent.activeVersion}</Badge>
          ) : (
            <Badge variant="gold" size="sm">Not published</Badge>
          )}
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{agent.description || 'No description yet.'}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {agent.hasUnpublishedDraft && agent.activeVersion && <Badge variant="blue" size="sm">Draft v{agent.latestVersion} pending</Badge>}
          <Badge variant="outline" size="sm" icon={<MessageSquare className="h-3 w-3" />}>
            {agent.chatbotCount} chatbot{agent.chatbotCount === 1 ? '' : 's'}
          </Badge>
          {agent.tags.map(t => (
            <Badge key={t} variant="slate" size="sm">{t}</Badge>
          ))}
        </div>
      </div>

      {error && <p className="mt-3 text-[11px] text-rose-600" role="alert">{error}</p>}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <button type="button" onClick={onOpen} className="text-xs font-bold text-[#B84A22] hover:underline cursor-pointer">
          Open studio
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title={agent.status === 'archived' ? 'Restore' : 'Archive'}
            aria-label={agent.status === 'archived' ? 'Restore agent' : 'Archive agent'}
            onClick={() => run(() => update.mutateAsync({ id: agent.id, input: { status: agent.status === 'archived' ? 'active' : 'archived' } }))}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
          >
            {agent.status === 'archived' ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </button>
          <button
            type="button"
            title="Delete"
            aria-label="Delete agent"
            onClick={() => {
              if (window.confirm(`Delete the agent "${agent.name}"? Its version history is removed from view.`)) void run(() => del.mutateAsync(agent.id));
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const AgentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: agents, isLoading, error } = useAgents();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const visible = useMemo(() => (agents ?? []).filter(a => showArchived || a.status === 'active'), [agents, showArchived]);
  const live = (agents ?? []).filter(a => a.status === 'active' && a.activeVersion).length;

  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-r from-white via-slate-50/50 to-orange-50/20 p-6 shadow-card dark:border-slate-800 dark:from-slate-900 dark:via-slate-900/90 dark:to-orange-950/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">AI Agents</h1>
              <span className="flex items-center gap-1 rounded-full border border-orange-200 bg-orange-500/10 px-2.5 py-0.5 text-xs font-bold text-[#B84A22] dark:border-orange-800/60 dark:text-orange-300">
                <Layers className="h-3 w-3" /> {live} live
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Give each job its own personality, knowledge and data to collect: qualify buyers, book site visits, explain EMI, win back cold leads.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 self-start rounded-xl bg-gradient-to-r from-[#B84A22] to-[#c75528] px-4 py-2.5 text-xs font-bold text-white shadow-button hover:-translate-y-0.5 transition-all cursor-pointer sm:self-auto"
          >
            <Plus className="h-4 w-4" /> New agent
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
        <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
        Show archived
      </label>

      {error && <p className="text-sm text-rose-600" role="alert">{error.message}</p>}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-44 w-full" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          <EmptyState
            icon={<Bot className="h-7 w-7" />}
            title="No agents yet"
            description="Create your first agent from a template. It stays a draft until you publish and assign it to a chatbot."
            actionLabel="Create an agent"
            onAction={() => setCreating(true)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map(a => (
            <AgentCard key={a.id} agent={a} onOpen={() => navigate(`/agents/${a.id}`)} />
          ))}
        </div>
      )}

      {creating && <CreateAgentModal onClose={() => setCreating(false)} onCreated={id => navigate(`/agents/${id}`)} />}
    </div>
  );
};
