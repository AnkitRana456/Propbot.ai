import React, { useState, useEffect } from 'react';
import {
  Workflow as WorkflowIcon,
  Plus,
  Play,
  Sparkles,
  Layers,
  History,
  CheckCircle2,
  Save,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { apiRequest } from '../services/api-client.js';

interface WorkflowSimulationResult {
  runId: string;
  status: string;
  stepsExecuted?: number;
  logs?: string[];
  executionSteps?: Array<{
    nodeId: string;
    actionKind?: string;
    status: string;
    tier?: string;
    details?: string;
  }>;
}

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action' | 'branch' | 'end';
  label?: string;
  config: Record<string, unknown>;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

interface WorkflowItem {
  id: string;
  name: string;
  description?: string | null;
  status: 'draft' | 'active' | 'paused' | 'archived';
  definition: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
  createdAt: string;
  updatedAt: string;
}

interface WorkflowTemplate {
  name: string;
  description: string;
  category: string;
  definition: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
}

interface WorkflowRun {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  error?: string | null;
  steps?: Array<{
    id: string;
    nodeId: string;
    status: string;
    startedAt: string;
    output?: Record<string, unknown>;
    errorMessage?: string;
  }>;
}

const triggerEvent = (wf: WorkflowItem) =>
  String(wf.definition?.nodes?.find((n) => n.type === 'trigger')?.config?.event_type ?? 'none');

const nodeParams = (node: WorkflowNode) => (node.config?.parameters ?? {}) as Record<string, unknown>;

export const WorkflowsPage: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowItem | null>(null);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals & Drawers
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isAiDraftModalOpen, setIsAiDraftModalOpen] = useState(false);
  const [isTestRunModalOpen, setIsTestRunModalOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  // AI Draft Prompt
  const [aiPrompt, setAiPrompt] = useState('');
  const [draftingAi, setDraftingAi] = useState(false);

  // Test Run Simulator
  const [simulationLeadId, setSimulationLeadId] = useState('');
  const [simulationResult, setSimulationResult] = useState<WorkflowSimulationResult | null>(null);
  const [testingWorkflow, setTestingWorkflow] = useState(false);

  // Execution History
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);

  useEffect(() => {
    loadWorkflows();
    loadTemplates();
  }, []);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const items = await apiRequest<WorkflowItem[]>('/api/workflows');
      setWorkflows(items);
      if (items.length > 0 && !activeWorkflow) {
        setActiveWorkflow(items[0] ?? null);
      }
    } catch (err) {
      console.error('Failed to load workflows', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      setTemplates(await apiRequest<WorkflowTemplate[]>('/api/workflows/templates'));
    } catch (err) {
      console.error('Failed to load templates', err);
    }
  };

  const loadHistory = async (workflowId: string) => {
    try {
      setLoadingRuns(true);
      setRuns(await apiRequest<WorkflowRun[]>(`/api/workflows/${workflowId}/runs`));
    } catch (err) {
      console.error('Failed to load workflow runs', err);
    } finally {
      setLoadingRuns(false);
    }
  };

  const handleToggleStatus = async (workflow: WorkflowItem) => {
    try {
      const action = workflow.status === 'active' ? 'pause' : 'activate';
      const updated = await apiRequest<WorkflowItem>(`/api/workflows/${workflow.id}/${action}`, {
        method: 'POST',
      });
      setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      if (activeWorkflow?.id === updated.id) {
        setActiveWorkflow(updated);
      }
    } catch (err) {
      console.error('Failed to toggle workflow status', err);
    }
  };

  const handleApplyTemplate = async (template: WorkflowTemplate) => {
    try {
      setSaving(true);
      const created = await apiRequest<WorkflowItem>('/api/workflows', {
        method: 'POST',
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          definition: template.definition,
        }),
      });
      setWorkflows((prev) => [created, ...prev]);
      setActiveWorkflow(created);
      setIsTemplateModalOpen(false);
    } catch (err) {
      console.error('Failed to apply template', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAiDraft = async () => {
    if (!aiPrompt.trim()) return;
    try {
      setDraftingAi(true);
      const drafted = await apiRequest<{
        name: string;
        description: string;
        definition: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
      }>('/api/workflows/draft-from-prompt', {
        method: 'POST',
        body: JSON.stringify({ prompt: aiPrompt }),
      });

      const created = await apiRequest<WorkflowItem>('/api/workflows', {
        method: 'POST',
        body: JSON.stringify({
          name: drafted.name,
          description: drafted.description,
          definition: drafted.definition,
        }),
      });

      setWorkflows((prev) => [created, ...prev]);
      setActiveWorkflow(created);
      setIsAiDraftModalOpen(false);
      setAiPrompt('');
    } catch (err) {
      console.error('Failed to draft workflow with AI', err);
    } finally {
      setDraftingAi(false);
    }
  };

  const handleSaveWorkflow = async () => {
    if (!activeWorkflow) return;
    try {
      setSaving(true);
      const updated = await apiRequest<WorkflowItem>(`/api/workflows/${activeWorkflow.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: activeWorkflow.name,
          description: activeWorkflow.description ?? undefined,
          definition: activeWorkflow.definition,
        }),
      });
      setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setActiveWorkflow(updated);
    } catch (err) {
      console.error('Failed to save workflow', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!activeWorkflow) return;
    try {
      setTestingWorkflow(true);
      setSimulationResult(null);
      const res = await apiRequest<WorkflowSimulationResult>(`/api/workflows/${activeWorkflow.id}/test`, {
        method: 'POST',
        body: JSON.stringify({
          payload: simulationLeadId ? { leadId: simulationLeadId } : {},
        }),
      });
      setSimulationResult(res);
    } catch (err) {
      console.error('Simulation error', err);
    } finally {
      setTestingWorkflow(false);
    }
  };

  const handleAddNode = (type: 'condition' | 'action' | 'delay') => {
    if (!activeWorkflow) return;
    const newId = `${type}_${Date.now()}`;
    let newConfig: Record<string, unknown> = {};

    if (type === 'condition') {
      newConfig = { field: 'intent_score', operator: 'greater_than', value: 70 };
    } else if (type === 'action') {
      newConfig = { action_kind: 'send_whatsapp', parameters: { message: '' } };
    } else {
      newConfig = { action_kind: 'wait', parameters: { hours: 1 } };
    }

    const newNode: WorkflowNode = {
      id: newId,
      type: type === 'delay' ? 'action' : type,
      label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      config: newConfig,
    };

    const { nodes, edges } = activeWorkflow.definition;
    const endNode = nodes.find((n) => n.type === 'end');
    const lastNode = nodes[nodes.length - 1];
    let newNodes = [...nodes, newNode];
    let newEdges = [...edges];

    // The engine stops at an end node, so new steps go in front of it.
    if (endNode) {
      newNodes = [...nodes.filter((n) => n.id !== endNode.id), newNode, endNode];
      newEdges = [
        ...edges.map((e) => (e.target === endNode.id ? { ...e, target: newId } : e)),
        { id: `e_${newId}_${endNode.id}`, source: newId, target: endNode.id },
      ];
    } else if (lastNode) {
      newEdges.push({ id: `e_${lastNode.id}_${newId}`, source: lastNode.id, target: newId });
    }

    setActiveWorkflow({ ...activeWorkflow, definition: { nodes: newNodes, edges: newEdges } });
    setSelectedNode(newNode);
  };

  const updateNode = (updated: WorkflowNode) => {
    setSelectedNode(updated);
    if (!activeWorkflow) return;
    setActiveWorkflow({
      ...activeWorkflow,
      definition: {
        ...activeWorkflow.definition,
        nodes: activeWorkflow.definition.nodes.map((n) => (n.id === updated.id ? updated : n)),
      },
    });
  };

  return (
    <div className="flex h-screen flex-col bg-bg text-text overflow-hidden">
      {/* Top Header Bar */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-teal-500 shadow-md">
            <WorkflowIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-text tracking-tight">Workflows & Automation</h1>
              <span className="rounded-full bg-teal-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                Phase 15B Growth
              </span>
            </div>
            <p className="text-xs text-text-muted">
              No-code lifecycle triggers, delay queues, guarded actions & AI execution
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-xs font-semibold text-text hover:bg-surface-3 transition"
          >
            <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Templates</span>
          </button>

          <button
            onClick={() => setIsAiDraftModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md hover:from-indigo-500 hover:to-teal-500 transition"
          >
            <Sparkles className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            <span>Draft with AI</span>
          </button>

          {activeWorkflow && (
            <>
              <button
                onClick={() => {
                  setIsTestRunModalOpen(true);
                  setSimulationResult(null);
                }}
                className="flex items-center gap-2 rounded-xl border border-teal-500/30 bg-teal-500/10 px-3.5 py-2 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition"
              >
                <Play className="h-3.5 w-3.5 fill-teal-300" />
                <span>Test Run</span>
              </button>

              <button
                onClick={() => {
                  loadHistory(activeWorkflow.id);
                  setIsHistoryDrawerOpen(true);
                }}
                className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-xs font-semibold text-text/80 hover:bg-surface-3 transition"
              >
                <History className="h-4 w-4 text-text-muted" />
                <span>Runs History</span>
              </button>

              <button
                onClick={handleSaveWorkflow}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-teal-500 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>Save</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Workflow List */}
        <aside className="w-80 border-r border-border bg-surface flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              Workflows ({workflows.length})
              {loading && <Loader2 className="h-3 w-3 animate-spin text-teal-600 dark:text-teal-400" />}
            </span>
            <button
              onClick={() => setIsTemplateModalOpen(true)}
              className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-300 font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {workflows.map((wf) => {
              const isActive = activeWorkflow?.id === wf.id;
              return (
                <div
                  key={wf.id}
                  onClick={() => {
                    setActiveWorkflow(wf);
                    setSelectedNode(null);
                  }}
                  className={`group relative rounded-xl border p-3.5 cursor-pointer transition ${
                    isActive
                      ? 'border-teal-500/60 bg-teal-500/10 shadow-lg ring-1 ring-teal-500/40'
                      : 'border-border bg-surface hover:border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-text group-hover:text-teal-300 transition">
                      {wf.name}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(wf);
                      }}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                        wf.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
                          : wf.status === 'paused'
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                          : 'bg-surface-3 text-text-muted border border-border'
                      }`}
                    >
                      {wf.status}
                    </button>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-text-muted">{wf.description || 'No description'}</p>
                  <div className="mt-2.5 flex items-center gap-3 text-[11px] text-text-muted">
                    <span>Trigger: <strong className="text-text/80">{triggerEvent(wf)}</strong></span>
                    <span>•</span>
                    <span>{wf.definition?.nodes?.length || 0} nodes</span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center: Workflow Canvas */}
        <main className="flex-1 overflow-y-auto bg-bg p-8 flex flex-col items-center">
          {activeWorkflow ? (
            <div className="w-full max-w-3xl flex flex-col items-center space-y-6">
              {/* Canvas Header */}
              <div className="w-full flex items-center justify-between rounded-2xl border border-border bg-surface p-4 backdrop-blur">
                <div>
                  <h2 className="text-base font-bold text-text">{activeWorkflow.name}</h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Triggered by event <span className="font-mono text-teal-600 dark:text-teal-400 font-semibold">{triggerEvent(activeWorkflow)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Add node:</span>
                  <button
                    onClick={() => handleAddNode('condition')}
                    className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-text/80 hover:bg-surface-3 transition"
                  >
                    + Condition
                  </button>
                  <button
                    onClick={() => handleAddNode('action')}
                    className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-text/80 hover:bg-surface-3 transition"
                  >
                    + Action
                  </button>
                  <button
                    onClick={() => handleAddNode('delay')}
                    className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-text/80 hover:bg-surface-3 transition"
                  >
                    + Delay
                  </button>
                </div>
              </div>

              {/* Node Sequence Chain */}
              <div className="w-full flex flex-col items-center space-y-4">
                {activeWorkflow.definition.nodes.map((node, index) => {
                  const isSelected = selectedNode?.id === node.id;
                  const isTrigger = node.type === 'trigger';
                  const isCondition = node.type === 'condition';
                  const isDelay = node.type === 'action' && node.config?.action_kind === 'wait';
                  const isAction = node.type === 'action' && !isDelay;

                  return (
                    <React.Fragment key={node.id}>
                      {/* Node Card */}
                      <div
                        onClick={() => setSelectedNode(node)}
                        className={`w-full max-w-xl rounded-2xl border p-4 cursor-pointer transition relative group ${
                          isSelected
                            ? 'border-teal-400 bg-surface-2 shadow-xl ring-2 ring-teal-500/50'
                            : 'border-border bg-surface hover:border-border hover:bg-surface'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-xl text-white font-bold text-xs ${
                                isTrigger
                                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                  : isCondition
                                  ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                                  : isAction
                                  ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30'
                                  : 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                                  {node.type}
                                </span>
                                <h4 className="text-sm font-bold text-text">{node.label || node.id}</h4>
                              </div>
                              <p className="text-xs text-text-muted mt-0.5 font-mono">
                                {isTrigger && `Event: ${node.config?.event_type}`}
                                {isCondition && `${node.config?.field || 'field'} ${node.config?.operator || 'equals'} ${node.config?.value ?? ''}`}
                                {isAction && `Action: ${node.config?.action_kind}`}
                                {isDelay && `Wait ${nodeParams(node).hours ?? 0} hours`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-text-muted group-hover:text-teal-400 transition">
                              Configure &rarr;
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* SVG Connector Edge */}
                      {index < activeWorkflow.definition.nodes.length - 1 && (
                        <div className="flex flex-col items-center">
                          <div className="h-6 w-0.5 bg-gradient-to-b from-teal-500 to-indigo-500" />
                          <ChevronDown className="h-4 w-4 -mt-1 text-indigo-600 dark:text-indigo-400" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-text-muted">
              <WorkflowIcon className="h-12 w-12 text-text-faint mb-3" />
              <p className="text-sm">Select or create a workflow to view its automation graph</p>
            </div>
          )}
        </main>

        {/* Right Sidebar: Node Config Inspector */}
        {selectedNode && (
          <aside className="w-80 border-l border-border bg-surface p-5 flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Node Properties
              </h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-text-muted hover:text-text text-xs"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-text-muted font-medium mb-1">Node Title</label>
                <input
                  type="text"
                  value={selectedNode.label || ''}
                  onChange={(e) => updateNode({ ...selectedNode, label: e.target.value })}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text focus:border-teal-500 focus:outline-none"
                />
              </div>

              {selectedNode.type === 'condition' && (
                <>
                  <div>
                    <label className="block text-text-muted font-medium mb-1">Field</label>
                    <input
                      type="text"
                      value={(selectedNode.config?.field as string) || ''}
                      onChange={(e) => updateNode({ ...selectedNode, config: { ...selectedNode.config, field: e.target.value } })}
                      className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text"
                    />
                  </div>
                  <div>
                    <label className="block text-text-muted font-medium mb-1">Operator</label>
                    <select
                      value={(selectedNode.config?.operator as string) || 'equals'}
                      onChange={(e) => updateNode({ ...selectedNode, config: { ...selectedNode.config, operator: e.target.value } })}
                      className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text"
                    >
                      <option value="equals">equals</option>
                      <option value="not_equals">not equals</option>
                      <option value="greater_than">&gt;</option>
                      <option value="less_than">&lt;</option>
                      <option value="contains">contains</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-text-muted font-medium mb-1">Value</label>
                    <input
                      type="text"
                      value={(selectedNode.config?.value as string | number) ?? ''}
                      onChange={(e) => updateNode({ ...selectedNode, config: { ...selectedNode.config, value: e.target.value } })}
                      className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === 'action' && selectedNode.config?.action_kind === 'wait' && (
                <div>
                  <label className="block text-text-muted font-medium mb-1">Duration (Hours)</label>
                  <input
                    type="number"
                    min={0}
                    value={(nodeParams(selectedNode).hours as number) ?? 0}
                    onChange={(e) =>
                      updateNode({
                        ...selectedNode,
                        config: { ...selectedNode.config, parameters: { ...nodeParams(selectedNode), hours: Number(e.target.value) } },
                      })
                    }
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text"
                  />
                </div>
              )}

              {selectedNode.type === 'action' && selectedNode.config?.action_kind !== 'wait' && (
                <>
                  <div>
                    <label className="block text-text-muted font-medium mb-1">Action Type</label>
                    <select
                      value={(selectedNode.config?.action_kind as string) || 'send_whatsapp'}
                      onChange={(e) => updateNode({ ...selectedNode, config: { ...selectedNode.config, action_kind: e.target.value } })}
                      className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text"
                    >
                      <option value="send_whatsapp">Send WhatsApp</option>
                      <option value="send_email">Send Email</option>
                      <option value="send_sms">Send SMS</option>
                      <option value="change_status">Update Lead Stage</option>
                      <option value="assign_agent">Assign to Agent</option>
                      <option value="add_tag">Add Tag</option>
                      <option value="create_task">Create Task</option>
                      <option value="call_webhook">Call Webhook</option>
                      <option value="send_payment_link">Guarded Token Booking Link</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-text-muted font-medium mb-1">Message</label>
                    <textarea
                      rows={3}
                      value={(nodeParams(selectedNode).message as string) || ''}
                      onChange={(e) =>
                        updateNode({
                          ...selectedNode,
                          config: { ...selectedNode.config, parameters: { ...nodeParams(selectedNode), message: e.target.value } },
                        })
                      }
                      className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text"
                    />
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Production Templates Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h2 className="text-base font-bold text-text flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Select Production Workflow Template
              </h2>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-text-muted hover:text-text"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-2">
              {templates.map((tpl, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-surface-2 p-4 hover:border-teal-500/50 hover:bg-surface-2 transition flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-text text-sm">{tpl.name}</h3>
                    <p className="text-xs text-text-muted mt-1">{tpl.description}</p>
                    <span className="mt-2 inline-block rounded bg-teal-500/20 px-2 py-0.5 text-[10px] font-mono text-teal-700 dark:text-teal-300">
                      {tpl.category}
                    </span>
                  </div>
                  <button
                    onClick={() => handleApplyTemplate(tpl)}
                    className="ml-4 rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-500 transition whitespace-nowrap"
                  >
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Draft Modal */}
      {isAiDraftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h2 className="text-base font-bold text-text flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                Draft Workflow with Natural Language
              </h2>
              <button
                onClick={() => setIsAiDraftModalOpen(false)}
                className="text-text-muted hover:text-text"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-muted mb-3 leading-relaxed">
              Describe your desired automation in plain English. The AI engine will parse triggers, conditions, delays, and action sequences into a validated workflow graph.
            </p>

            <textarea
              rows={4}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. When a new lead has a budget over 1 Cr, send a priority WhatsApp greeting, wait 2 hours, and notify the senior broker."
              className="w-full rounded-xl border border-border bg-surface-2 p-3 text-sm text-text placeholder-text-faint focus:border-teal-500 focus:outline-none"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setIsAiDraftModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs text-text-muted hover:text-text"
              >
                Cancel
              </button>
              <button
                onClick={handleAiDraft}
                disabled={draftingAi || !aiPrompt.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow hover:opacity-90 disabled:opacity-50"
              >
                {draftingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>Generate Workflow</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Run Simulator Modal */}
      {isTestRunModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h2 className="text-base font-bold text-text flex items-center gap-2">
                <Play className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Dry-Run Simulation Simulator
              </h2>
              <button
                onClick={() => setIsTestRunModalOpen(false)}
                className="text-text-muted hover:text-text"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-muted mb-4">
              Test your workflow conditions and node actions in a sandbox without sending actual external messages.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text/80 mb-1">
                  Lead UUID (Optional mock lead):
                </label>
                <input
                  type="text"
                  placeholder="Leave empty for synthetic lead simulation"
                  value={simulationLeadId}
                  onChange={(e) => setSimulationLeadId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-xs text-text"
                />
              </div>

              <button
                onClick={handleRunSimulation}
                disabled={testingWorkflow}
                className="w-full rounded-xl bg-teal-600 py-2.5 text-xs font-bold text-white hover:bg-teal-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {testingWorkflow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-white" />}
                <span>Execute Dry-Run Simulation</span>
              </button>

              {simulationResult && (
                <div className="rounded-xl border border-border bg-bg p-4 font-mono text-xs text-teal-700 dark:text-teal-300 max-h-56 overflow-y-auto">
                  <div className="flex items-center gap-2 font-bold mb-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Simulation Completed: {simulationResult.status}</span>
                  </div>
                  <pre className="text-[11px] text-text/80 whitespace-pre-wrap">
                    {JSON.stringify(simulationResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Execution Runs Drawer */}
      {isHistoryDrawerOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-96 border-l border-border bg-surface p-6 shadow-2xl backdrop-blur flex flex-col">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
            <h2 className="text-sm font-bold text-text flex items-center gap-2">
              <History className="h-4 w-4 text-text-muted" />
              Execution Logs
            </h2>
            <button
              onClick={() => setIsHistoryDrawerOpen(false)}
              className="text-text-muted hover:text-text"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {loadingRuns ? (
              <div className="flex items-center justify-center py-12 text-text-muted text-xs">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span>Loading runs...</span>
              </div>
            ) : runs.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-8">No executions recorded yet.</p>
            ) : (
              runs.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-border bg-surface-2 p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-text/80">{r.id.slice(0, 8)}...</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        r.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : r.status === 'failed'
                          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                          : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-text-muted">
                    Started: {new Date(r.startedAt).toLocaleString()}
                  </div>
                  {r.error && (
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 font-mono mt-1">
                      {r.error}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
