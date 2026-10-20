import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Wrench, X, Play, Search } from 'lucide-react';
import type { ActionDefinitionItem, ToolItem, ToolParam, ToolRunItem } from '@propbot/shared';
import { useActions, useDeleteTool, useRunAction, useRunTool, useSaveTool, useToolRuns, useTools } from '../services/tools.service.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Skeleton } from '../components/common/Skeleton.js';

const inputCls = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white';
const labelCls = 'text-xs font-semibold text-slate-700 dark:text-slate-300';
const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
const errMsg = (e: unknown, f: string) => (e instanceof Error ? e.message : f);

const STATUS_VARIANT: Record<string, 'mint' | 'gold' | 'slate' | 'blue'> = { ok: 'mint', error: 'gold', blocked: 'slate', pending_approval: 'blue' };

const ParamEditor: React.FC<{ label: string; params: ToolParam[]; onChange: (p: ToolParam[]) => void }> = ({ label, params, onChange }) => (
  <div>
    <div className="flex items-center justify-between">
      <span className={labelCls}>{label}</span>
      <button type="button" onClick={() => onChange([...params, { key: '', type: 'string', description: '', required: false }])} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 cursor-pointer">
        <Plus className="h-3 w-3" /> Add
      </button>
    </div>
    <div className="mt-2 space-y-2">
      {params.map((p, i) => (
        <div key={i} className="grid grid-cols-12 items-center gap-2">
          <input aria-label={`${label} name`} placeholder="name" value={p.key} onChange={e => onChange(params.map((x, j) => (j === i ? { ...x, key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') } : x)))} className={`${inputCls} col-span-3 mt-0 font-mono`} />
          <select aria-label={`${label} type`} value={p.type} onChange={e => onChange(params.map((x, j) => (j === i ? { ...x, type: e.target.value as ToolParam['type'] } : x)))} className={`${inputCls} col-span-2 mt-0`}>
            <option value="string">text</option>
            <option value="number">number</option>
            <option value="boolean">yes/no</option>
          </select>
          <input aria-label={`${label} description`} placeholder="description" value={p.description} onChange={e => onChange(params.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} className={`${inputCls} col-span-4 mt-0`} />
          <label className="col-span-2 flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={p.required} onChange={e => onChange(params.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))} /> req.
          </label>
          <button type="button" aria-label={`Remove ${label} row`} onClick={() => onChange(params.filter((_, j) => j !== i))} className="col-span-1 text-slate-400 hover:text-rose-600 cursor-pointer">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {params.length === 0 && <p className="text-[11px] text-slate-400">None.</p>}
    </div>
  </div>
);

const RunResult: React.FC<{ run: ToolRunItem }> = ({ run }) => (
  <div className="rounded-xl border border-slate-200 p-3 text-[11px] dark:border-slate-800">
    <div className="flex items-center gap-2">
      <Badge variant={STATUS_VARIANT[run.status] ?? 'slate'} size="sm">{run.status.replace('_', ' ')}</Badge>
      {run.durationMs !== null && <span className="text-slate-400">{run.durationMs} ms</span>}
    </div>
    {run.error && <p className="mt-1 text-rose-600">{run.error}</p>}
    {run.output !== null && run.output !== undefined && <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-50 p-2 text-[10px] dark:bg-slate-950/50">{JSON.stringify(run.output, null, 2)}</pre>}
  </div>
);

const ToolEditor: React.FC<{ tool: ToolItem | null; onClose: () => void }> = ({ tool, onClose }) => {
  const save = useSaveTool();
  const runTool = useRunTool();
  const { data: runs } = useToolRuns(tool?.id);
  const cfg = (tool?.config ?? {}) as Record<string, unknown>;
  const [type, setType] = useState<'gpt' | 'api'>(tool?.type ?? 'api');
  const [name, setName] = useState(tool?.name ?? '');
  const [description, setDescription] = useState(tool?.description ?? '');
  const [prompt, setPrompt] = useState(String(cfg.prompt ?? ''));
  const [method, setMethod] = useState(String(cfg.method ?? 'GET'));
  const [url, setUrl] = useState(String(cfg.url ?? 'https://'));
  const [body, setBody] = useState(String(cfg.body ?? ''));
  const [headers, setHeaders] = useState(Object.entries((cfg.headers as Record<string, string>) ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n'));
  const [mapping, setMapping] = useState(Object.entries((cfg.responseMapping as Record<string, string>) ?? {}).map(([k, v]) => `${k} = ${v}`).join('\n'));
  const [authMode, setAuthMode] = useState(String(cfg.authMode ?? 'none'));
  const [secret, setSecret] = useState('');
  const [inputs, setInputs] = useState<ToolParam[]>(tool?.inputSchema ?? []);
  const [outputs, setOutputs] = useState<ToolParam[]>(tool?.outputSchema ?? []);
  const [needsApproval, setNeedsApproval] = useState(tool?.requiresApproval ?? false);
  const [rate, setRate] = useState(tool?.rateLimitPerMin ?? 30);
  const [testValues, setTestValues] = useState<Record<string, string>>({});
  const [lastRun, setLastRun] = useState<ToolRunItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buildConfig = (): Record<string, unknown> => {
    if (type === 'gpt') return { prompt, temperature: 0 };
    const parseLines = (text: string, sep: RegExp) =>
      Object.fromEntries(text.split('\n').map(l => l.split(sep).map(s => s.trim())).filter(([k, v]) => k && v) as Array<[string, string]>);
    return {
      method,
      url,
      body,
      headers: parseLines(headers, /:(.+)/s),
      responseMapping: parseLines(mapping, /=(.+)/s),
      authMode,
    };
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    try {
      const saved = tool
        ? await save.mutateAsync({ id: tool.id, update: { name, description: description || null, config: buildConfig(), inputSchema: inputs, outputSchema: outputs, requiresApproval: needsApproval, rateLimitPerMin: rate, ...(secret ? { secret } : {}) } })
        : await save.mutateAsync({ create: { key: slug(name) || 'tool', name, description: description || null, type, config: buildConfig(), inputSchema: inputs, outputSchema: outputs, requiresApproval: needsApproval, rateLimitPerMin: rate, ...(secret ? { secret } : {}) } });
      setSecret('');
      return saved;
    } catch (err) {
      setError(errMsg(err, 'Could not save the tool.'));
      return null;
    }
  };

  const test = async () => {
    const saved = await submit();
    if (!saved) return;
    try {
      const input = Object.fromEntries(inputs.filter(p => p.key && testValues[p.key] !== undefined && testValues[p.key] !== '').map(p => [p.key, testValues[p.key]]));
      setLastRun(await runTool.mutateAsync({ id: saved.id, input }));
    } catch (err) {
      setError(errMsg(err, 'The test failed.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label="Tool editor">
      <form onSubmit={e => void submit(e).then(s => s && onClose())} className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between p-5 pb-2">
          <h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white">{tool ? 'Edit tool' : 'New tool'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 pb-2">
          {!tool && (
            <div className="grid grid-cols-2 gap-2">
              {([['api', 'API tool', 'Call your CRM, ERP or any HTTPS endpoint.'], ['gpt', 'AI tool', 'A prompt that returns structured data (e.g. extract budget and BHK).']] as const).map(([id, title, desc]) => (
                <button key={id} type="button" onClick={() => setType(id)} className={`rounded-xl border p-3 text-left text-xs cursor-pointer ${type === id ? 'border-[#B84A22] bg-orange-50/60 dark:bg-orange-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                  <span className="font-semibold text-slate-900 dark:text-white">{title}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">{desc}</span>
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="tool-name">Name</label>
              <input id="tool-name" required minLength={2} maxLength={150} value={name} onChange={e => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="tool-desc">What it does</label>
              <input id="tool-desc" maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} className={inputCls} />
            </div>
          </div>

          {type === 'gpt' ? (
            <div>
              <label className={labelCls} htmlFor="tool-prompt">Prompt</label>
              <textarea id="tool-prompt" rows={4} required minLength={5} maxLength={4000} value={prompt} onChange={e => setPrompt(e.target.value)} className={inputCls} placeholder="Extract the buyer's budget and BHK from: {{message}}" />
              <p className="mt-1 text-[11px] text-slate-500">Use {'{{name}}'} for each input. The reply is parsed into the outputs below.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2">
                <select aria-label="HTTP method" value={method} onChange={e => setMethod(e.target.value)} className={`${inputCls} col-span-3 mt-0`}>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
                </select>
                <input aria-label="URL" required value={url} onChange={e => setUrl(e.target.value)} className={`${inputCls} col-span-9 mt-0 font-mono`} placeholder="https://api.example.com/units?tower={{tower}}" />
              </div>
              {method !== 'GET' && <textarea aria-label="Body template" rows={3} value={body} onChange={e => setBody(e.target.value)} className={`${inputCls} font-mono`} placeholder={'{"name":"{{name}}"}'} />}
              <textarea aria-label="Headers" rows={2} value={headers} onChange={e => setHeaders(e.target.value)} className={`${inputCls} font-mono`} placeholder="Header-Name: value (one per line)" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls} htmlFor="tool-auth">Authentication</label>
                  <select id="tool-auth" value={authMode} onChange={e => setAuthMode(e.target.value)} className={inputCls}>
                    <option value="none">None</option>
                    <option value="bearer">Bearer token</option>
                    <option value="header">X-API-Key header</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="tool-secret">Secret {tool?.hasSecret && <span className="font-normal text-slate-400">(saved, leave blank to keep)</span>}</label>
                  <input id="tool-secret" type="password" autoComplete="off" value={secret} onChange={e => setSecret(e.target.value)} className={inputCls} placeholder={tool?.hasSecret ? '••••••••' : 'Stored encrypted'} />
                </div>
              </div>
              <div>
                <label className={labelCls} htmlFor="tool-map">Response mapping</label>
                <textarea id="tool-map" rows={2} value={mapping} onChange={e => setMapping(e.target.value)} className={`${inputCls} font-mono`} placeholder="price = data.items.0.price (one per line; blank returns the whole response)" />
              </div>
            </div>
          )}

          <ParamEditor label="Inputs" params={inputs} onChange={setInputs} />
          {type === 'gpt' && <ParamEditor label="Outputs" params={outputs} onChange={setOutputs} />}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
              <input type="checkbox" className="mt-0.5" checked={needsApproval} onChange={e => setNeedsApproval(e.target.checked)} />
              <span><span className="font-semibold">Needs human approval</span><span className="block text-[11px] text-slate-500">Agents and flows pause instead of calling it.</span></span>
            </label>
            <div className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
              <label htmlFor="tool-rate" className="font-semibold">Calls per minute</label>
              <input id="tool-rate" type="number" min={1} max={600} value={rate} onChange={e => setRate(Math.min(600, Math.max(1, Number(e.target.value) || 30)))} className={inputCls} />
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">Test it</h3>
            <p className="text-[11px] text-slate-500">Saves your changes and runs the tool once with these values.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {inputs.filter(p => p.key).map(p => (
                <input key={p.key} aria-label={`Test value for ${p.key}`} placeholder={p.key} value={testValues[p.key] ?? ''} onChange={e => setTestValues({ ...testValues, [p.key]: e.target.value })} className={`${inputCls} mt-0`} />
              ))}
            </div>
            <button type="button" disabled={runTool.isPending || save.isPending} onClick={() => void test()} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-slate-700 cursor-pointer">
              <Play className="h-3.5 w-3.5" /> {runTool.isPending ? 'Running…' : 'Save & run test'}
            </button>
            {lastRun && <div className="mt-2"><RunResult run={lastRun} /></div>}
          </section>

          {tool && (
            <section>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Recent runs</h3>
              <ul className="mt-1 space-y-1">
                {(runs ?? []).slice(0, 8).map(r => (
                  <li key={r.id} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                    <Badge variant={STATUS_VARIANT[r.status] ?? 'slate'} size="sm">{r.status.replace('_', ' ')}</Badge>
                    <span>{new Date(r.createdAt).toLocaleString()}</span>
                    <span className="truncate text-rose-600">{r.error}</span>
                  </li>
                ))}
                {(runs ?? []).length === 0 && <li className="text-[11px] text-slate-400">No runs yet.</li>}
              </ul>
            </section>
          )}
        </div>
        {error && <p className="px-5 pt-2 text-xs text-rose-600" role="alert">{error}</p>}
        <div className="flex justify-end gap-2 p-5">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">Close</button>
          <button type="submit" disabled={save.isPending} className="rounded-xl bg-gradient-to-r from-[#B84A22] to-[#c75528] px-5 py-2 text-xs font-bold text-white disabled:opacity-50 cursor-pointer">{save.isPending ? 'Saving…' : 'Save tool'}</button>
        </div>
      </form>
    </div>
  );
};

const ActionCard: React.FC<{ action: ActionDefinitionItem }> = ({ action }) => {
  const run = useRunAction();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setError(null);
    try {
      const input = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ''));
      setResult(await run.mutateAsync({ id: action.id, input }));
    } catch (e) {
      setError(errMsg(e, 'The action failed.'));
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-serif text-sm font-bold text-slate-900 dark:text-white">{action.name}</h3>
        <Badge variant="slate" size="sm">{action.category}</Badge>
      </div>
      <p className="mt-1 text-xs text-slate-500">{action.description}</p>
      <p className="mt-2 text-[10px] text-slate-400">Returns: {action.outputs.join(', ')}</p>
      <button type="button" onClick={() => setOpen(o => !o)} className="mt-2 text-xs font-bold text-[#B84A22] cursor-pointer">{open ? 'Hide tester' : 'Try it'}</button>
      {open && (
        <div className="mt-2 space-y-2">
          {action.inputs.map(p => (
            <input key={p.key} aria-label={`${action.name}: ${p.key}`} placeholder={`${p.key}${p.required ? ' *' : ''} — ${p.description}`} value={values[p.key] ?? ''} onChange={e => setValues({ ...values, [p.key]: e.target.value })} className={`${inputCls} mt-0`} />
          ))}
          <button type="button" disabled={run.isPending} onClick={() => void go()} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 dark:bg-slate-700 cursor-pointer">
            <Play className="h-3.5 w-3.5" /> Run
          </button>
          {error && <p className="text-[11px] text-rose-600" role="alert">{error}</p>}
          {result !== null && <pre className="max-h-48 overflow-auto rounded-lg bg-slate-50 p-2 text-[10px] dark:bg-slate-950/50">{JSON.stringify(result, null, 2)}</pre>}
        </div>
      )}
    </div>
  );
};

export const ToolsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const tab: 'tools' | 'actions' = location.pathname.endsWith('/actions') ? 'actions' : 'tools';
  const { data: tools, isLoading, error } = useTools();
  const { data: actions } = useActions();
  const del = useDeleteTool();
  const [editing, setEditing] = useState<ToolItem | 'new' | null>(null);
  const [q, setQ] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const remove = async (t: ToolItem) => {
    if (!window.confirm(`Delete the tool "${t.name}"?`)) return;
    setActionError(null);
    try {
      await del.mutateAsync(t.id);
    } catch (e) {
      setActionError(errMsg(e, 'Could not delete the tool.'));
    }
  };
  const shownActions = (actions ?? []).filter(a => `${a.name} ${a.description} ${a.category}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Tools &amp; actions</h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">Connect your own systems and reuse ready-made real-estate actions. Agents also check live inventory automatically when buyers ask about availability.</p>
        </div>
        {tab === 'tools' && (
          <button type="button" onClick={() => setEditing('new')} className="flex items-center gap-2 self-start rounded-xl bg-gradient-to-r from-[#B84A22] to-[#c75528] px-4 py-2.5 text-xs font-bold text-white cursor-pointer sm:self-auto">
            <Plus className="h-4 w-4" /> New tool
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
        {([['tools', 'My tools', '/tools'], ['actions', 'Action library', '/tools/actions']] as const).map(([id, label, path]) => (
          <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => navigate(path)} className={`border-b-2 px-4 py-2 text-xs font-semibold cursor-pointer ${tab === id ? 'border-[#B84A22] text-[#B84A22]' : 'border-transparent text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {(error || actionError) && <p className="text-sm text-rose-600" role="alert">{actionError ?? error?.message}</p>}

      {tab === 'tools' ? (
        isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !tools || tools.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <EmptyState icon={<Wrench className="h-7 w-7" />} title="No tools yet" description="Add an API tool for your CRM or ERP, or an AI tool that extracts structured data." actionLabel="New tool" onAction={() => setEditing('new')} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tools.map(t => (
              <div key={t.id} className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate font-serif text-sm font-bold text-slate-900 dark:text-white">{t.name}</h3>
                  <Badge variant={t.status === 'active' ? 'mint' : 'slate'} size="sm">{t.status}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{t.description || 'No description.'}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="outline" size="sm">{t.type === 'api' ? 'API' : 'AI'}</Badge>
                  <Badge variant="slate" size="sm">{t.inputSchema.length} inputs</Badge>
                  {t.requiresApproval && <Badge variant="blue" size="sm">Needs approval</Badge>}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button type="button" onClick={() => setEditing(t)} className="text-xs font-bold text-[#B84A22] hover:underline cursor-pointer">Edit &amp; test</button>
                  <button type="button" aria-label={`Delete ${t.name}`} onClick={() => void remove(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input aria-label="Search actions" value={q} onChange={e => setQ(e.target.value)} placeholder="Search actions" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shownActions.map(a => <ActionCard key={a.id} action={a} />)}
            {shownActions.length === 0 && <p className="text-xs text-slate-400">No actions match.</p>}
          </div>
        </div>
      )}

      {editing && <ToolEditor key={editing === 'new' ? 'new' : editing.id} tool={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
};
