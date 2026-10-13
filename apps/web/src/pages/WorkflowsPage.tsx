import React, { useState, useEffect } from 'react';
import {
  Workflow as WorkflowIcon,
  Plus,
  Play,
  Pause,
  Sparkles,
  Layers,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Settings,
  Trash2,
  Save,
  ChevronDown,
  Info,
  ShieldAlert,
  Loader2,
  Search,
  Filter,
} from 'lucide-react';
import { apiRequest } from '../services/api-client.js';

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action' | 'delay';
  name?: string;
  config: Record<string, any>;
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
  description?: string;
  triggerType: string;
  status: 'draft' | 'active' | 'paused';
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
  triggerType: string;
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
  errorMessage?: string;
  steps?: Array<{
    id: string;
    nodeId: string;
    status: string;
    startedAt: string;
    output?: any;
    errorMessage?: string;
  }>;
}

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
  const [simulationResult, setSimulationResult] = useState<any>(null);
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
      const res = await apiRequest<{ workflows: WorkflowItem[] }>('/api/workflows');
      setWorkflows(res.workflows || []);
      if (res.workflows && res.workflows.length > 0 && !activeWorkflow) {
        setActiveWorkflow(res.workflows[0] ?? null);
      }
    } catch (err) {
      console.error('Failed to load workflows', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await apiRequest<{ templates: WorkflowTemplate[] }>('/api/workflows/templates');
      setTemplates(res.templates || []);
    } catch (err) {
      console.error('Failed to load templates', err);
    }
  };

  const loadHistory = async (workflowId: string) => {
    try {
      setLoadingRuns(true);
      const res = await apiRequest<{ runs: WorkflowRun[] }>(`/api/workflows/${workflowId}/runs`);
      setRuns(res.runs || []);
    } catch (err) {
      console.error('Failed to load workflow runs', err);
    } finally {
      setLoadingRuns(false);
    }
  };

  const handleToggleStatus = async (workflow: WorkflowItem) => {
    try {
      const updated = await apiRequest<WorkflowItem>(`/api/workflows/${workflow.id}/toggle`, {
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
          triggerType: template.triggerType,
          status: 'draft',
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
        triggerType: string;
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
          triggerType: drafted.triggerType,
          status: 'draft',
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
          description: activeWorkflow.description,
          triggerType: activeWorkflow.triggerType,
          status: activeWorkflow.status,
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
      const res = await apiRequest<any>(`/api/workflows/${activeWorkflow.id}/test`, {
        method: 'POST',
        body: JSON.stringify({
          leadId: simulationLeadId || undefined,
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
    let newConfig: Record<string, any> = {};

    if (type === 'condition') {
      newConfig = { field: 'score', operator: 'gte', value: 70 };
    } else if (type === 'action') {
      newConfig = { action: 'send_whatsapp', template: 'welcome_greeting' };
    } else if (type === 'delay') {
      newConfig = { durationMinutes: 60 };
    }

    const newNode: WorkflowNode = {
      id: newId,
      type,
      name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      config: newConfig,
    };

    const lastNode = activeWorkflow.definition.nodes[activeWorkflow.definition.nodes.length - 1];
    const newEdges = [...activeWorkflow.definition.edges];
    if (lastNode) {
      newEdges.push({
        id: `e_${lastNode.id}_${newId}`,
        source: lastNode.id,
        target: newId,
      });
    }

    const updatedWorkflow: WorkflowItem = {
      ...activeWorkflow,
      definition: {
        nodes: [...activeWorkflow.definition.nodes, newNode],
        edges: newEdges,
      },
    };

    setActiveWorkflow(updatedWorkflow);
    setSelectedNode(newNode);
  };

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header Bar */}
      <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-teal-500 shadow-md">
            <WorkflowIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">Workflows & Automation</h1>
              <span className="rounded-full bg-teal-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-teal-300">
                Phase 15B Growth
              </span>
            </div>
            <p className="text-xs text-slate-400">
              No-code lifecycle triggers, delay queues, guarded actions & AI execution
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            <Layers className="h-4 w-4 text-indigo-400" />
            <span>Templates</span>
          </button>

          <button
            onClick={() => setIsAiDraftModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md hover:from-indigo-500 hover:to-teal-500 transition"
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span>Draft with AI</span>
          </button>

          {activeWorkflow && (
            <>
              <button
                onClick={() => {
                  setIsTestRunModalOpen(true);
                  setSimulationResult(null);
                }}
                className="flex items-center gap-2 rounded-xl border border-teal-500/30 bg-teal-500/10 px-3.5 py-2 text-xs font-semibold text-teal-300 hover:bg-teal-500/20 transition"
              >
                <Play className="h-3.5 w-3.5 fill-teal-300" />
                <span>Test Run</span>
              </button>

              <button
                onClick={() => {
                  loadHistory(activeWorkflow.id);
                  setIsHistoryDrawerOpen(true);
                }}
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                <History className="h-4 w-4 text-slate-400" />
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
        <aside className="w-80 border-r border-slate-800 bg-slate-900/60 flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Workflows ({workflows.length})
            </span>
            <button
              onClick={() => setIsTemplateModalOpen(true)}
              className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 font-medium"
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
                      : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-100 group-hover:text-teal-300 transition">
                      {wf.name}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(wf);
                      }}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                        wf.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : wf.status === 'paused'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-slate-700/60 text-slate-400 border border-slate-600'
                      }`}
                    >
                      {wf.status}
                    </button>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{wf.description || 'No description'}</p>
                  <div className="mt-2.5 flex items-center gap-3 text-[11px] text-slate-500">
                    <span>Trigger: <strong className="text-slate-300">{wf.triggerType}</strong></span>
                    <span>•</span>
                    <span>{wf.definition?.nodes?.length || 0} nodes</span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center: Workflow Canvas */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-8 flex flex-col items-center">
          {activeWorkflow ? (
            <div className="w-full max-w-3xl flex flex-col items-center space-y-6">
              {/* Canvas Header */}
              <div className="w-full flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur">
                <div>
                  <h2 className="text-base font-bold text-white">{activeWorkflow.name}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Triggered by event <span className="font-mono text-teal-400 font-semibold">{activeWorkflow.triggerType}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Add node:</span>
                  <button
                    onClick={() => handleAddNode('condition')}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
                  >
                    + Condition
                  </button>
                  <button
                    onClick={() => handleAddNode('action')}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
                  >
                    + Action
                  </button>
                  <button
                    onClick={() => handleAddNode('delay')}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
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
                  const isAction = node.type === 'action';
                  const isDelay = node.type === 'delay';

                  return (
                    <React.Fragment key={node.id}>
                      {/* Node Card */}
                      <div
                        onClick={() => setSelectedNode(node)}
                        className={`w-full max-w-xl rounded-2xl border p-4 cursor-pointer transition relative group ${
                          isSelected
                            ? 'border-teal-400 bg-slate-800/90 shadow-xl ring-2 ring-teal-500/50'
                            : 'border-slate-800 bg-slate-900/90 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-xl text-white font-bold text-xs ${
                                isTrigger
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : isCondition
                                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                  : isAction
                                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                  {node.type}
                                </span>
                                <h4 className="text-sm font-bold text-slate-100">{node.name || node.id}</h4>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                                {isTrigger && `Event: ${node.config?.event || activeWorkflow.triggerType}`}
                                {isCondition && `${node.config?.field || 'field'} ${node.config?.operator || '=='} ${node.config?.value ?? ''}`}
                                {isAction && `Action: ${node.config?.action || 'notify'} (${node.config?.channel || 'in-app'})`}
                                {isDelay && `Wait ${node.config?.durationMinutes || node.config?.duration_minutes || 0} minutes`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 group-hover:text-teal-400 transition">
                              Configure &rarr;
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* SVG Connector Edge */}
                      {index < activeWorkflow.definition.nodes.length - 1 && (
                        <div className="flex flex-col items-center">
                          <div className="h-6 w-0.5 bg-gradient-to-b from-teal-500 to-indigo-500" />
                          <ChevronDown className="h-4 w-4 -mt-1 text-indigo-400" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <WorkflowIcon className="h-12 w-12 text-slate-700 mb-3" />
              <p className="text-sm">Select or create a workflow to view its automation graph</p>
            </div>
          )}
        </main>

        {/* Right Sidebar: Node Config Inspector */}
        {selectedNode && (
          <aside className="w-80 border-l border-slate-800 bg-slate-900/70 p-5 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400">
                Node Properties
              </h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Node Title</label>
                <input
                  type="text"
                  value={selectedNode.name || ''}
                  onChange={(e) => {
                    const updated = { ...selectedNode, name: e.target.value };
                    setSelectedNode(updated);
                    if (activeWorkflow) {
                      setActiveWorkflow({
                        ...activeWorkflow,
                        definition: {
                          ...activeWorkflow.definition,
                          nodes: activeWorkflow.definition.nodes.map((n) =>
                            n.id === updated.id ? updated : n
                          ),
                        },
                      });
                    }
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-teal-500 focus:outline-none"
                />
              </div>

              {selectedNode.type === 'condition' && (
                <>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Field</label>
                    <input
                      type="text"
                      value={selectedNode.config?.field || ''}
                      onChange={(e) => {
                        const updated = {
                          ...selectedNode,
                          config: { ...selectedNode.config, field: e.target.value },
                        };
                        setSelectedNode(updated);
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Operator</label>
                    <select
                      value={selectedNode.config?.operator || 'equals'}
                      onChange={(e) => {
                        const updated = {
                          ...selectedNode,
                          config: { ...selectedNode.config, operator: e.target.value },
                        };
                        setSelectedNode(updated);
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                    >
                      <option value="equals">equals</option>
                      <option value="gte">&gt;=</option>
                      <option value="lte">&lt;=</option>
                      <option value="contains">contains</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Value</label>
                    <input
                      type="text"
                      value={selectedNode.config?.value ?? ''}
                      onChange={(e) => {
                        const updated = {
                          ...selectedNode,
                          config: { ...selectedNode.config, value: e.target.value },
                        };
                        setSelectedNode(updated);
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === 'delay' && (
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={selectedNode.config?.durationMinutes || 0}
                    onChange={(e) => {
                      const updated = {
                        ...selectedNode,
                        config: { ...selectedNode.config, durationMinutes: Number(e.target.value) },
                      };
                      setSelectedNode(updated);
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                  />
                </div>
              )}

              {selectedNode.type === 'action' && (
                <>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Action Type</label>
                    <select
                      value={selectedNode.config?.action || 'send_whatsapp'}
                      onChange={(e) => {
                        const updated = {
                          ...selectedNode,
                          config: { ...selectedNode.config, action: e.target.value },
                        };
                        setSelectedNode(updated);
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                    >
                      <option value="send_whatsapp">Send WhatsApp</option>
                      <option value="send_email">Send Email</option>
                      <option value="send_sms">Send SMS</option>
                      <option value="update_stage">Update Lead Stage</option>
                      <option value="assign_agent">Assign to Agent</option>
                      <option value="generate_booking_payment">Guarded Token Booking Link</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Template / Message</label>
                    <textarea
                      rows={3}
                      value={selectedNode.config?.template || selectedNode.config?.message || ''}
                      onChange={(e) => {
                        const updated = {
                          ...selectedNode,
                          config: { ...selectedNode.config, template: e.target.value },
                        };
                        setSelectedNode(updated);
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
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
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-400" />
                Select Production Workflow Template
              </h2>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-2">
              {templates.map((tpl, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-800 bg-slate-800/60 p-4 hover:border-teal-500/50 hover:bg-slate-800 transition flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-slate-100 text-sm">{tpl.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">{tpl.description}</p>
                    <span className="mt-2 inline-block rounded bg-teal-500/20 px-2 py-0.5 text-[10px] font-mono text-teal-300">
                      Trigger: {tpl.triggerType}
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
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                Draft Workflow with Natural Language
              </h2>
              <button
                onClick={() => setIsAiDraftModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Describe your desired automation in plain English. The AI engine will parse triggers, conditions, delays, and action sequences into a validated workflow graph.
            </p>

            <textarea
              rows={4}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. When a new lead has a budget over 1 Cr, send a priority WhatsApp greeting, wait 2 hours, and notify the senior broker."
              className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setIsAiDraftModalOpen(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-white"
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
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Play className="h-4 w-4 text-teal-400" />
                Dry-Run Simulation Simulator
              </h2>
              <button
                onClick={() => setIsTestRunModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Test your workflow conditions and node actions in a sandbox without sending actual external messages.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lead UUID (Optional mock lead):
                </label>
                <input
                  type="text"
                  placeholder="Leave empty for synthetic lead simulation"
                  value={simulationLeadId}
                  onChange={(e) => setSimulationLeadId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-slate-100"
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
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-teal-300 max-h-56 overflow-y-auto">
                  <div className="flex items-center gap-2 font-bold mb-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Simulation Completed: {simulationResult.status}</span>
                  </div>
                  <pre className="text-[11px] text-slate-300 whitespace-pre-wrap">
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
        <div className="fixed inset-y-0 right-0 z-50 w-96 border-l border-slate-800 bg-slate-900/95 p-6 shadow-2xl backdrop-blur flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="h-4 w-4 text-slate-400" />
              Execution Logs
            </h2>
            <button
              onClick={() => setIsHistoryDrawerOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {loadingRuns ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-xs">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span>Loading runs...</span>
              </div>
            ) : runs.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No executions recorded yet.</p>
            ) : (
              runs.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-slate-800 bg-slate-800/50 p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-300">{r.id.slice(0, 8)}...</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        r.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : r.status === 'failed'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Started: {new Date(r.startedAt).toLocaleString()}
                  </div>
                  {r.errorMessage && (
                    <div className="text-[11px] text-rose-400 font-mono mt-1">
                      {r.errorMessage}
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
