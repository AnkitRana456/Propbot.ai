import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Clock,
  GitBranch,
  MessageSquare,
  Play,
  Redo2,
  Repeat,
  Rocket,
  Save,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Variable,
  Wrench,
  Zap,
  Workflow,
  Waypoints,
} from 'lucide-react';
import {
  FLOW_NODE_CATEGORY,
  validateFlowGraph,
  type FlowExecutionDetail,
  type FlowGraph,
  type FlowNodeType,
  type FlowValidationIssue,
  type FlowVersionItem,
} from '@propbot/shared';
import {
  useDiscardFlowDraft,
  useFlow,
  usePublishFlow,
  useRollbackFlow,
  useSaveFlowDraft,
  useTestFlow,
} from '../services/flows.service.js';
import { FlowInspector, TRIGGER_OPTIONS, type NodeConfig } from '../components/flows/FlowInspector.js';
import { Badge } from '../components/ui/Badge.js';
import { Skeleton } from '../components/common/Skeleton.js';

type StepData = { kind: FlowNodeType; config: NodeConfig; issues: FlowValidationIssue[]; runStatus?: string };
type StepNode = Node<StepData, 'step'>;

const KIND_META: Record<FlowNodeType, { label: string; icon: React.ReactNode; tint: string }> = {
  trigger: { label: 'Trigger', icon: <Zap className="h-3.5 w-3.5" />, tint: 'bg-amber-500/10 text-amber-700' },
  send_message: { label: 'Send message', icon: <MessageSquare className="h-3.5 w-3.5" />, tint: 'bg-blue-500/10 text-blue-700' },
  ai_step: { label: 'AI reply', icon: <Sparkles className="h-3.5 w-3.5" />, tint: 'bg-violet-500/10 text-violet-700' },
  condition: { label: 'If / else', icon: <GitBranch className="h-3.5 w-3.5" />, tint: 'bg-emerald-500/10 text-emerald-700' },
  llm_router: { label: 'AI routing', icon: <Bot className="h-3.5 w-3.5" />, tint: 'bg-violet-500/10 text-violet-700' },
  wait: { label: 'Wait', icon: <Clock className="h-3.5 w-3.5" />, tint: 'bg-slate-500/10 text-slate-700' },
  loop: { label: 'Repeat', icon: <Repeat className="h-3.5 w-3.5" />, tint: 'bg-slate-500/10 text-slate-700' },
  tool: { label: 'Use tool', icon: <Wrench className="h-3.5 w-3.5" />, tint: 'bg-orange-500/10 text-orange-700' },
  action: { label: 'Run action', icon: <Waypoints className="h-3.5 w-3.5" />, tint: 'bg-orange-500/10 text-orange-700' },
  set_variable: { label: 'Set variable', icon: <Variable className="h-3.5 w-3.5" />, tint: 'bg-slate-500/10 text-slate-700' },
  sub_flow: { label: 'Sub-flow', icon: <Workflow className="h-3.5 w-3.5" />, tint: 'bg-pink-500/10 text-pink-700' },
  end: { label: 'End', icon: <Square className="h-3.5 w-3.5" />, tint: 'bg-rose-500/10 text-rose-700' },
};

const PALETTE_ORDER: FlowNodeType[] = ['trigger', 'send_message', 'ai_step', 'condition', 'llm_router', 'wait', 'loop', 'tool', 'action', 'set_variable', 'sub_flow', 'end'];

interface OutputHandle {
  id: string;
  label?: string;
  color?: string;
}

/** The outputs a step exposes, so the canvas can draw one connector per branch. */
function outputsOf(kind: FlowNodeType, config: NodeConfig): OutputHandle[] {
  switch (kind) {
    case 'end':
      return [];
    case 'condition':
      return [{ id: 'true', label: 'yes', color: '#059669' }, { id: 'false', label: 'no', color: '#e11d48' }];
    case 'loop':
      return [{ id: 'body', label: 'repeat', color: '#2563eb' }, { id: 'done', label: 'done', color: '#059669' }];
    case 'llm_router': {
      const choices = (Array.isArray(config.choices) ? config.choices : []) as Array<{ id: string; label?: string }>;
      return [...choices.map(c => ({ id: c.id, label: c.label || c.id })), { id: 'default', label: 'default', color: '#94a3b8' }];
    }
    case 'tool':
    case 'action':
    case 'ai_step':
    case 'sub_flow':
      return [{ id: 'out' }, { id: 'error', label: 'on error', color: '#e11d48' }];
    default:
      return [{ id: 'out' }];
  }
}

function summaryOf(kind: FlowNodeType, c: NodeConfig): string {
  const s = (k: string) => (typeof c[k] === 'string' ? (c[k] as string) : '');
  switch (kind) {
    case 'trigger':
      return TRIGGER_OPTIONS.find(o => o.id === c.triggerType)?.label ?? 'Choose what starts the flow';
    case 'send_message':
      return s('text') || 'Write a message';
    case 'ai_step':
      return s('prompt') || 'Write an instruction';
    case 'condition':
      return s('field') ? `${s('field')} ${s('operator').replace(/_/g, ' ')} ${s('value')}` : 'Set a condition';
    case 'llm_router':
      return `${Array.isArray(c.choices) ? c.choices.length : 0} choices`;
    case 'wait': {
      const m = Number(c.minutes) || 0;
      return m % 1440 === 0 ? `${m / 1440} day(s)` : m % 60 === 0 ? `${m / 60} hour(s)` : `${m} minute(s)`;
    }
    case 'loop':
      return `${Number(c.times) || 0} times`;
    case 'set_variable':
      return s('name') ? `${s('name')} = ${s('value')}` : 'Name a variable';
    case 'tool':
      return s('toolId') ? 'Tool selected' : 'Pick a tool';
    case 'action':
      return s('actionId') ? s('actionId').replace(/_/g, ' ') : 'Pick an action';
    case 'sub_flow':
      return s('flowId') ? 'Flow selected' : 'Pick a flow';
    case 'end':
      return 'Finish';
  }
}

const RUN_RING: Record<string, string> = { ok: 'ring-2 ring-emerald-400', error: 'ring-2 ring-rose-500', skipped: 'ring-2 ring-slate-300', waiting: 'ring-2 ring-blue-400' };

const StepNodeView: React.FC<NodeProps<StepNode>> = ({ data, selected }) => {
  const meta = KIND_META[data.kind];
  const outs = outputsOf(data.kind, data.config);
  const errors = data.issues.filter(i => i.level === 'error');
  return (
    <div className={`relative w-56 rounded-xl border bg-white p-3 shadow-sm dark:bg-slate-900 ${selected ? 'border-accent' : 'border-slate-200 dark:border-slate-700'} ${data.runStatus ? RUN_RING[data.runStatus] ?? '' : ''}`}>
      {data.kind !== 'trigger' && <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-slate-400" />}
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${meta.tint}`}>{meta.icon}</span>
        <span className="text-xs font-bold text-slate-900 dark:text-white">{meta.label}</span>
        {errors.length > 0 && <span title={errors.map(e => e.message).join(' ')} className="ml-auto text-rose-600"><AlertTriangle className="h-3.5 w-3.5" aria-label="Needs attention" /></span>}
      </div>
      <p className="mt-1.5 line-clamp-2 break-words text-[11px] text-slate-500">{summaryOf(data.kind, data.config)}</p>
      {outs.map((o, i) => (
        <React.Fragment key={o.id}>
          <Handle
            type="source"
            id={o.id}
            position={Position.Right}
            style={{ top: outs.length === 1 ? '50%' : `${((i + 1) * 100) / (outs.length + 1)}%`, background: o.color ?? '#64748b', width: 12, height: 12 }}
          />
          {o.label && (
            <span className="pointer-events-none absolute -right-1 translate-x-full text-[9px] font-semibold text-slate-500" style={{ top: `calc(${((i + 1) * 100) / (outs.length + 1)}% - 6px)` }}>
              {o.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const nodeTypes = { step: StepNodeView };

const toRf = (graph: FlowGraph): { nodes: StepNode[]; edges: Edge[] } => ({
  nodes: graph.nodes.map(n => ({ id: n.id, type: 'step', position: n.position, data: { kind: n.type, config: n.data, issues: [] } })),
  edges: graph.edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? 'out', markerEnd: { type: MarkerType.ArrowClosed } })),
});
const fromRf = (nodes: StepNode[], edges: Edge[]): FlowGraph => ({
  nodes: nodes.map(n => ({ id: n.id, type: n.data.kind, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }, data: n.data.config })),
  edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? 'out' })),
});

const errMsg = (e: unknown, f: string) => (e instanceof Error ? e.message : f);

const Canvas: React.FC<{ flowId: string; versions: FlowVersionItem[]; activeVersionId: string | null; flowName: string }> = ({ flowId, versions, activeVersionId, flowName }) => {
  const latest = versions[0]!;
  const initial = useMemo(() => toRf(latest.graph), [latest.id]);
  const [nodes, setNodes, onNodesChange] = useNodesState<StepNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [panel, setPanel] = useState<'test' | 'versions'>('test');
  const [dryRun, setDryRun] = useState(true);
  const [lastRun, setLastRun] = useState<FlowExecutionDetail | null>(null);
  const history = useRef<{ past: FlowGraph[]; future: FlowGraph[] }>({ past: [], future: [] });
  const counter = useRef(Date.now() % 100000);

  const save = useSaveFlowDraft();
  const publish = usePublishFlow();
  const rollback = useRollbackFlow();
  const discard = useDiscardFlowDraft();
  const test = useTestFlow();

  const graph = useMemo(() => fromRf(nodes, edges), [nodes, edges]);
  const issues = useMemo(() => validateFlowGraph(graph), [graph]);
  const hasErrors = issues.some(i => i.level === 'error');

  // Attach live validation + last-run status to nodes
  const stepStatus = useMemo(() => new Map((lastRun?.steps ?? []).map(s => [s.nodeId, s.status])), [lastRun]);
  const decorated = useMemo(
    () => nodes.map(n => ({ ...n, data: { ...n.data, issues: issues.filter(i => i.nodeId === n.id), runStatus: stepStatus.get(n.id) } })),
    [nodes, issues, stepStatus],
  );

  const snapshot = useCallback(() => {
    history.current.past.push(graph);
    if (history.current.past.length > 50) history.current.past.shift();
    history.current.future = [];
  }, [graph]);

  const mutate = useCallback(() => {
    snapshot();
    setDirty(true);
    setNotice(null);
  }, [snapshot]);

  const restore = (g: FlowGraph) => {
    const rf = toRf(g);
    setNodes(rf.nodes);
    setEdges(rf.edges);
    setDirty(true);
  };
  const undo = () => {
    const prev = history.current.past.pop();
    if (!prev) return;
    history.current.future.push(graph);
    restore(prev);
  };
  const redo = () => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(graph);
    restore(next);
  };

  const onConnect = useCallback(
    (c: Connection) => {
      mutate();
      // one connection per output: replace an existing one from the same handle
      setEdges(es => addEdge({ ...c, id: `e_${c.source}_${c.sourceHandle ?? 'out'}_${c.target}`, markerEnd: { type: MarkerType.ArrowClosed } }, es.filter(e => !(e.source === c.source && (e.sourceHandle ?? 'out') === (c.sourceHandle ?? 'out')))));
    },
    [mutate, setEdges],
  );

  const addNode = (kind: FlowNodeType) => {
    mutate();
    const id = `${kind}_${(counter.current++).toString(36)}`;
    const defaults: Partial<Record<FlowNodeType, NodeConfig>> = {
      wait: { minutes: 60 },
      loop: { times: 3 },
      llm_router: { question: '{{event.message}}', choices: [{ id: 'option_a', label: 'Option A', description: '' }, { id: 'option_b', label: 'Option B', description: '' }] },
    };
    const x = 80 + (nodes.length % 4) * 280;
    const y = 80 + Math.floor(nodes.length / 4) * 160;
    setNodes(ns => [...ns, { id, type: 'step', position: { x, y }, data: { kind, config: defaults[kind] ?? {}, issues: [] } }]);
    setSelectedId(id);
  };

  const selected = nodes.find(n => n.id === selectedId) ?? null;
  const updateConfig = (config: NodeConfig) => {
    mutate();
    setNodes(ns => ns.map(n => (n.id === selectedId ? { ...n, data: { ...n.data, config } } : n)));
  };
  const deleteSelected = () => {
    if (!selectedId) return;
    mutate();
    setNodes(ns => ns.filter(n => n.id !== selectedId));
    setEdges(es => es.filter(e => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  };

  const customVariables = useMemo(() => {
    const names = new Set<string>();
    for (const n of nodes) {
      const c = n.data.config;
      for (const k of ['name', 'saveAs']) if (typeof c[k] === 'string' && c[k]) names.add(c[k] as string);
    }
    return [...names];
  }, [nodes]);

  const doSave = async (): Promise<FlowVersionItem | null> => {
    try {
      const v = await save.mutateAsync({ id: flowId, input: { graph } });
      setDirty(false);
      setNotice({ kind: 'ok', text: `Saved as draft v${v.version}.` });
      return v;
    } catch (e) {
      setNotice({ kind: 'err', text: errMsg(e, 'Could not save.') });
      return null;
    }
  };
  const doPublish = async () => {
    const v = dirty || latest.status !== 'draft' ? await doSave() : latest;
    if (!v) return;
    try {
      await publish.mutateAsync({ id: flowId, versionId: v.id });
      setNotice({ kind: 'ok', text: `Published v${v.version}. Triggers are now live.` });
    } catch (e) {
      setNotice({ kind: 'err', text: errMsg(e, 'Could not publish.') });
    }
  };
  const doTest = async () => {
    const v = dirty ? await doSave() : latest;
    if (!v) return;
    try {
      setLastRun(await test.mutateAsync({ id: flowId, input: { versionId: v.id, dryRun } }));
      setPanel('test');
    } catch (e) {
      setNotice({ kind: 'err', text: errMsg(e, 'The test run failed.') });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const btn = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-40 cursor-pointer';

  return (
    <div className="space-y-3 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link to="/flows" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><ArrowLeft className="h-3.5 w-3.5" /> All flows</Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="truncate font-serif text-xl font-bold text-slate-900 dark:text-white">{flowName}</h1>
            {activeVersionId ? <Badge variant="mint" size="sm">Live v{versions.find(v => v.id === activeVersionId)?.version}</Badge> : <Badge variant="gold" size="sm">Not published</Badge>}
            {dirty && <Badge variant="blue" size="sm">Unsaved</Badge>}
            {hasErrors && <Badge variant="gold" size="sm">{issues.filter(i => i.level === 'error').length} to fix</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-label="Undo" disabled={history.current.past.length === 0} onClick={undo} className={`${btn} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}><Undo2 className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Redo" disabled={history.current.future.length === 0} onClick={redo} className={`${btn} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}><Redo2 className="h-3.5 w-3.5" /></button>
          <button type="button" disabled={!dirty || save.isPending} onClick={() => void doSave()} className={`${btn} bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100`}><Save className="h-3.5 w-3.5" /> {save.isPending ? 'Saving…' : 'Save draft'}</button>
          <button type="button" disabled={hasErrors || publish.isPending} onClick={() => void doPublish()} className={`${btn} bg-gradient-to-r from-accent to-accent-hover text-white`}><Rocket className="h-3.5 w-3.5" /> {publish.isPending ? 'Publishing…' : 'Publish'}</button>
        </div>
      </div>

      {notice && <p role={notice.kind === 'err' ? 'alert' : 'status'} className={`rounded-xl px-3 py-2 text-xs ${notice.kind === 'err' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30'}`}>{notice.text}</p>}

      <div className="grid gap-3 lg:grid-cols-[12rem_1fr_20rem]">
        <aside aria-label="Step palette" className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
          {(['Entry', 'Content', 'Agent', 'Routing', 'Tool', 'Action', 'Sub-flow'] as const).map(cat => {
            const kinds = PALETTE_ORDER.filter(k => FLOW_NODE_CATEGORY[k] === cat);
            if (kinds.length === 0) return null;
            return (
              <div key={cat} className="mb-3">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{cat}</p>
                <div className="space-y-1">
                  {kinds.map(k => (
                    <button key={k} type="button" onClick={() => addNode(k)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer">
                      <span className={`flex h-5 w-5 items-center justify-center rounded ${KIND_META[k].tint}`}>{KIND_META[k].icon}</span>
                      {KIND_META[k].label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </aside>

        <div className="h-[34rem] overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50 shadow-card dark:border-slate-800 dark:bg-slate-950" data-testid="flow-canvas">
          <ReactFlow
            nodes={decorated}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={ch => {
              if (ch.some(c => c.type === 'remove')) mutate();
              onEdgesChange(ch);
            }}
            onConnect={onConnect}
            onNodeDragStart={snapshot}
            onNodeDragStop={() => setDirty(true)}
            onNodeClick={(_e, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={18} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!hidden sm:!block" />
          </ReactFlow>
        </div>

        <aside className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">{KIND_META[selected.data.kind].label}</h2>
                <button type="button" aria-label="Delete step" onClick={deleteSelected} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
              </div>
              {issues.filter(i => i.nodeId === selected.id).map((i, k) => (
                <p key={k} className={`rounded-lg px-2 py-1 text-[11px] ${i.level === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{i.message}</p>
              ))}
              <FlowInspector type={selected.data.kind} config={selected.data.config} onChange={updateConfig} flowId={flowId} customVariables={customVariables} />
            </div>
          ) : (
            <div>
              <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
                {(['test', 'versions'] as const).map(t => (
                  <button key={t} role="tab" aria-selected={panel === t} type="button" onClick={() => setPanel(t)} className={`border-b-2 px-3 py-2 text-xs font-semibold cursor-pointer ${panel === t ? 'border-accent text-accent' : 'border-transparent text-slate-500'}`}>{t === 'test' ? 'Test run' : 'Versions'}</button>
                ))}
              </div>
              <div className="pt-3">
                {panel === 'test' ? (
                  <div className="space-y-3">
                    <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={dryRun} onChange={e => setDryRun(e.target.checked)} /> <span><b>Dry run</b><span className="block text-[11px] text-slate-500">Nothing is sent and waits are skipped. Untick to really send messages and call tools.</span></span></label>
                    <button type="button" disabled={hasErrors || test.isPending} onClick={() => void doTest()} className={`${btn} bg-slate-900 text-white dark:bg-slate-700`}><Play className="h-3.5 w-3.5" /> {test.isPending ? 'Running…' : 'Run test'}</button>
                    {hasErrors && <p className="text-[11px] text-rose-600">Fix the steps marked with a warning first.</p>}
                    {lastRun && (
                      <div className="space-y-1 text-[11px]">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">Result: <Badge variant={lastRun.status === 'completed' ? 'mint' : lastRun.status === 'failed' ? 'gold' : 'blue'} size="sm">{lastRun.status}</Badge> {lastRun.durationMs !== null && <span className="font-normal text-slate-400">{lastRun.durationMs} ms</span>}</p>
                        {lastRun.error && <p className="text-rose-600">{lastRun.error}</p>}
                        <ol className="space-y-1">
                          {lastRun.steps.map(s => (
                            <li key={s.id} className="rounded-lg border border-slate-200 p-1.5 dark:border-slate-800">
                              <span className="font-semibold">{s.nodeType.replace('_', ' ')}</span> <span className="text-slate-400">· {s.status}</span>
                              {s.error && <span className="block text-rose-600">{s.error}</span>}
                              {s.output !== null && s.output !== undefined && <code className="mt-0.5 block max-h-16 overflow-auto whitespace-pre-wrap break-all text-[10px] text-slate-500">{JSON.stringify(s.output)}</code>}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {versions.map(v => (
                      <li key={v.id} className="rounded-xl border border-slate-200 p-2 text-xs dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">v{v.version}</span>
                          {v.id === activeVersionId ? <Badge variant="mint" size="sm">Live</Badge> : <Badge variant="slate" size="sm">{v.status}</Badge>}
                        </div>
                        {v.changeNote && <p className="text-slate-500">{v.changeNote}</p>}
                        <div className="mt-1 flex gap-2">
                          {v.status !== 'draft' && v.id !== activeVersionId && (
                            <button type="button" onClick={() => window.confirm(`Roll back to v${v.version}?`) && void rollback.mutateAsync({ id: flowId, versionId: v.id }).catch(e => setNotice({ kind: 'err', text: errMsg(e, 'Rollback failed.') }))} className="font-semibold text-accent cursor-pointer">Roll back</button>
                          )}
                          {v.status === 'draft' && versions.length > 1 && (
                            <button type="button" onClick={() => window.confirm(`Discard draft v${v.version}?`) && void discard.mutateAsync({ id: flowId, versionId: v.id }).catch(e => setNotice({ kind: 'err', text: errMsg(e, 'Could not discard.') }))} className="text-slate-500 hover:text-rose-600 cursor-pointer">Discard</button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {issues.length > 0 && panel === 'test' && (
                <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {issues.slice(0, 6).map((i, k) => <li key={k} className={`text-[11px] ${i.level === 'error' ? 'text-rose-600' : 'text-amber-600'}`}>• {i.message}</li>)}
                </ul>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export const FlowCanvasPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useFlow(id);
  if (isLoading || !data) return error ? <p className="p-6 text-sm text-rose-600" role="alert">{error.message}</p> : <Skeleton className="h-96 w-full" />;
  return (
    <ReactFlowProvider>
      <Canvas key={`${data.flow.id}:${data.flow.activeVersionId}`} flowId={data.flow.id} versions={data.versions} activeVersionId={data.flow.activeVersionId} flowName={data.flow.name} />
    </ReactFlowProvider>
  );
};
