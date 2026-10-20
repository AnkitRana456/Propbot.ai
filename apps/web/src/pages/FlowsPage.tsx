import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Workflow, X, Archive, ArchiveRestore, Sparkles } from 'lucide-react';
import type { FlowItem } from '@propbot/shared';
import { useCreateFlow, useDeleteFlow, useFlows, useFlowTemplates, useUpdateFlow } from '../services/flows.service.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Skeleton } from '../components/common/Skeleton.js';

export const TRIGGER_LABEL: Record<string, string> = {
  new_lead: 'New lead',
  lead_stage_changed: 'Lead stage changed',
  visit_booked: 'Site visit booked',
  form_submitted: 'Form submitted',
  schedule: 'On a schedule',
  webhook: 'API / webhook',
};

const CreateFlowModal: React.FC<{ onClose: () => void; onCreated: (id: string) => void }> = ({ onClose, onCreated }) => {
  const { data: templates } = useFlowTemplates();
  const create = useCreateFlow();
  const [template, setTemplate] = useState<string>('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const chosen = templates?.find(t => t.id === template);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await create.mutateAsync({ name: name.trim() || chosen?.name || 'New flow', tags: [], ...(template ? { template } : {}) });
      onCreated(res.flow.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the flow.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label="Create flow">
      <form onSubmit={submit} className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white">Create a flow</h2>
            <p className="mt-1 text-xs text-slate-500">Start from a proven real-estate template or a blank canvas.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setTemplate('')} className={`rounded-xl border p-3 text-left cursor-pointer ${template === '' ? 'border-[#B84A22] bg-orange-50/60 dark:bg-orange-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Blank canvas</span>
            <p className="mt-1 text-[11px] text-slate-500">Build from scratch.</p>
          </button>
          {templates?.map(t => (
            <button key={t.id} type="button" onClick={() => setTemplate(t.id)} className={`rounded-xl border p-3 text-left cursor-pointer ${template === t.id ? 'border-[#B84A22] bg-orange-50/60 dark:bg-orange-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white"><Sparkles className="h-3.5 w-3.5 text-[#B84A22]" /> {t.name}</span>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">{t.description}</p>
            </button>
          ))}
        </div>
        <label className="mt-4 block text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="flow-name">Flow name</label>
        <input id="flow-name" value={name} onChange={e => setName(e.target.value)} placeholder={chosen?.name ?? 'e.g. Missed-visit follow-up'} maxLength={150} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-800 dark:text-white" />
        {error && <p className="mt-2 text-xs text-rose-600" role="alert">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">Cancel</button>
          <button type="submit" disabled={create.isPending} className="rounded-xl bg-gradient-to-r from-[#B84A22] to-[#c75528] px-5 py-2 text-xs font-bold text-white disabled:opacity-50 cursor-pointer">{create.isPending ? 'Creating…' : 'Create & open canvas'}</button>
        </div>
      </form>
    </div>
  );
};

const FlowCard: React.FC<{ flow: FlowItem; onOpen: () => void }> = ({ flow, onOpen }) => {
  const update = useUpdateFlow();
  const del = useDeleteFlow();
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    }
  };
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900">
      <div>
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={onOpen} className="min-w-0 text-left cursor-pointer"><h3 className="truncate font-serif text-sm font-bold text-slate-900 hover:text-[#B84A22] dark:text-white">{flow.name}</h3></button>
          {flow.status === 'archived' ? <Badge variant="slate" size="sm">Archived</Badge> : flow.activeVersion ? <Badge variant="mint" size="sm">Live v{flow.activeVersion}</Badge> : <Badge variant="gold" size="sm">Not published</Badge>}
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{flow.description || 'No description yet.'}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {flow.triggerTypes.map(t => <Badge key={t} variant="outline" size="sm">{TRIGGER_LABEL[t] ?? t}</Badge>)}
          {flow.hasUnpublishedDraft && flow.activeVersion && <Badge variant="blue" size="sm">Draft v{flow.latestVersion} pending</Badge>}
          <Badge variant="slate" size="sm">{flow.executionCount} runs</Badge>
        </div>
      </div>
      {error && <p className="mt-3 text-[11px] text-rose-600" role="alert">{error}</p>}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <button type="button" onClick={onOpen} className="text-xs font-bold text-[#B84A22] hover:underline cursor-pointer">Open canvas</button>
        <div className="flex gap-1">
          <button type="button" aria-label={flow.status === 'archived' ? 'Restore flow' : 'Archive flow'} onClick={() => run(() => update.mutateAsync({ id: flow.id, input: { status: flow.status === 'archived' ? 'active' : 'archived' } }))} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer">
            {flow.status === 'archived' ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </button>
          <button type="button" aria-label="Delete flow" onClick={() => window.confirm(`Delete the flow "${flow.name}"?`) && void run(() => del.mutateAsync(flow.id))} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
};

export const FlowsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: flows, isLoading, error } = useFlows();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const visible = (flows ?? []).filter(f => showArchived || f.status === 'active');

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Flows</h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">Automate follow-ups: reply to new leads in a minute, remind buyers about visits, win back cold leads. Every run is traced step by step.</p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-2 self-start rounded-xl bg-gradient-to-r from-[#B84A22] to-[#c75528] px-4 py-2.5 text-xs font-bold text-white cursor-pointer sm:self-auto"><Plus className="h-4 w-4" /> New flow</button>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived</label>
      {error && <p className="text-sm text-rose-600" role="alert">{error.message}</p>}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-44 w-full" />)}</div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          <EmptyState icon={<Workflow className="h-7 w-7" />} title="No flows yet" description="Start from a template such as Instant lead response or Site-visit reminders." actionLabel="Create a flow" onAction={() => setCreating(true)} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map(f => <FlowCard key={f.id} flow={f} onOpen={() => navigate(`/flows/${f.id}`)} />)}</div>
      )}
      {creating && <CreateFlowModal onClose={() => setCreating(false)} onCreated={id => navigate(`/flows/${id}`)} />}
    </div>
  );
};
