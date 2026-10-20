import React, { useState } from 'react';
import { X, Activity, Ban } from 'lucide-react';
import type { FlowExecutionItem } from '@propbot/shared';
import { useCancelExecution, useExecution, useExecutions, useFlows } from '../services/flows.service.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Skeleton } from '../components/common/Skeleton.js';
import { TRIGGER_LABEL } from './FlowsPage.js';

const STATUS_VARIANT: Record<string, 'mint' | 'gold' | 'slate' | 'blue'> = { completed: 'mint', failed: 'gold', cancelled: 'slate', running: 'blue', waiting: 'blue', ok: 'mint', error: 'gold', skipped: 'slate' };
const selectCls = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white';

const Detail: React.FC<{ id: string; onClose: () => void }> = ({ id, onClose }) => {
  const { data, isLoading } = useExecution(id);
  const cancel = useCancelExecution();
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50" role="dialog" aria-modal="true" aria-label="Execution detail">
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white">{data?.flowName ?? 'Execution'}</h2>
            {data && <p className="text-xs text-slate-500">v{data.flowVersion} · {TRIGGER_LABEL[data.triggerType] ?? data.triggerType} · {new Date(data.startedAt).toLocaleString()}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        {isLoading || !data ? (
          <Skeleton className="mt-4 h-40 w-full" />
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={STATUS_VARIANT[data.status] ?? 'slate'} size="sm">{data.status}</Badge>
              {data.isTest && <Badge variant="outline" size="sm">Test</Badge>}
              {data.leadName && <span className="text-slate-600 dark:text-slate-300">Lead: {data.leadName}</span>}
              <span className="text-slate-400">{data.totalTokens} tokens</span>
              {data.durationMs !== null && <span className="text-slate-400">{data.durationMs} ms</span>}
              {(data.status === 'waiting' || data.status === 'running') && (
                <button type="button" disabled={cancel.isPending} onClick={() => window.confirm('Cancel this run?') && cancel.mutate(data.id)} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 font-semibold text-rose-700 cursor-pointer"><Ban className="h-3 w-3" /> Cancel run</button>
              )}
            </div>
            {data.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30" role="alert">{data.error}</p>}
            {data.resumeAt && <p className="text-xs text-slate-500">Resumes {new Date(data.resumeAt).toLocaleString()}</p>}
            <ol className="relative space-y-2 border-l border-slate-200 pl-4 dark:border-slate-800">
              {data.steps.map(s => (
                <li key={s.id} className="text-xs">
                  <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white bg-slate-300 dark:border-slate-900" />
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{s.nodeType.replace('_', ' ')}</span>
                    <Badge variant={STATUS_VARIANT[s.status] ?? 'slate'} size="sm">{s.status}</Badge>
                    {s.durationMs !== null && <span className="text-slate-400">{s.durationMs} ms</span>}
                    {s.tokens > 0 && <span className="text-slate-400">{s.tokens} tok</span>}
                  </div>
                  {s.error && <p className="mt-0.5 text-rose-600">{s.error}</p>}
                  {s.output !== null && s.output !== undefined && <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-slate-50 p-2 text-[10px] dark:bg-slate-950/50">{JSON.stringify(s.output, null, 2)}</pre>}
                </li>
              ))}
            </ol>
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">Variables at the end of the run</summary>
              <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-slate-50 p-2 text-[10px] dark:bg-slate-950/50">{JSON.stringify(data.variables, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};

export const ExecutionsPage: React.FC = () => {
  const { data: flows } = useFlows();
  const [flowId, setFlowId] = useState('');
  const [status, setStatus] = useState('');
  const [includeTests, setIncludeTests] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading, error } = useExecutions({ flowId: flowId || undefined, status: status || undefined, includeTests });
  const rows: FlowExecutionItem[] = data ?? [];

  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Executions</h1>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">Every flow run with its step-by-step trace, AI tokens and errors.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="Filter by flow" value={flowId} onChange={e => setFlowId(e.target.value)} className={selectCls}>
          <option value="">All flows</option>
          {(flows ?? []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)} className={selectCls}>
          <option value="">Any status</option>
          {['running', 'waiting', 'completed', 'failed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={includeTests} onChange={e => setIncludeTests(e.target.checked)} /> Include test runs</label>
      </div>
      {error && <p className="text-sm text-rose-600" role="alert">{error.message}</p>}
      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><EmptyState icon={<Activity className="h-7 w-7" />} title="No runs yet" description="Runs appear here as soon as a published flow is triggered." /></div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <tr>{['Flow', 'Trigger', 'Lead', 'Status', 'Duration', 'Tokens', 'Started'].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} onClick={() => setOpen(r.id)} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white"><button type="button" onClick={() => setOpen(r.id)} className="cursor-pointer text-left">{r.flowName}</button> {r.isTest && <Badge variant="outline" size="sm">Test</Badge>}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{TRIGGER_LABEL[r.triggerType] ?? r.triggerType}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.leadName ?? '-'}</td>
                  <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[r.status] ?? 'slate'} size="sm">{r.status}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{r.durationMs !== null ? `${r.durationMs} ms` : '-'}</td>
                  <td className="px-4 py-3 text-slate-500">{r.totalTokens}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(r.startedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <Detail id={open} onClose={() => setOpen(null)} />}
    </div>
  );
};
