import { z } from 'zod';

export const FLOW_TRIGGER_TYPES = [
  'new_lead',
  'lead_stage_changed',
  'visit_booked',
  'form_submitted',
  'schedule',
  'webhook',
] as const;
export type FlowTriggerType = (typeof FLOW_TRIGGER_TYPES)[number];

export const FLOW_NODE_TYPES = [
  'trigger',
  'send_message',
  'ai_step',
  'condition',
  'llm_router',
  'wait',
  'loop',
  'tool',
  'action',
  'set_variable',
  'sub_flow',
  'end',
] as const;
export type FlowNodeType = (typeof FLOW_NODE_TYPES)[number];

export const FLOW_NODE_CATEGORY: Record<FlowNodeType, 'Entry' | 'Content' | 'Routing' | 'Agent' | 'Tool' | 'Action' | 'Sub-flow'> = {
  trigger: 'Entry',
  send_message: 'Content',
  ai_step: 'Agent',
  condition: 'Routing',
  llm_router: 'Routing',
  wait: 'Routing',
  loop: 'Routing',
  tool: 'Tool',
  action: 'Action',
  set_variable: 'Action',
  sub_flow: 'Sub-flow',
  end: 'Routing',
};

export const CONDITION_OPERATORS = ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_set', 'is_empty'] as const;
export type FlowConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const flowNodeSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(FLOW_NODE_TYPES),
  position: z.object({ x: z.number(), y: z.number() }).default({ x: 0, y: 0 }),
  data: z.record(z.unknown()).default({}),
});
export type FlowNode = z.infer<typeof flowNodeSchema>;

export const flowEdgeSchema = z.object({
  id: z.string().min(1).max(120),
  source: z.string().min(1).max(80),
  target: z.string().min(1).max(80),
  /** Which output of the source: 'out' (default), 'true'/'false', 'body'/'done', 'error', or a router choice id. */
  sourceHandle: z.string().max(80).optional().nullable(),
});
export type FlowEdge = z.infer<typeof flowEdgeSchema>;

export const flowGraphSchema = z.object({
  nodes: z.array(flowNodeSchema).max(200),
  edges: z.array(flowEdgeSchema).max(400),
});
export type FlowGraph = z.infer<typeof flowGraphSchema>;

export const flowSettingsSchema = z
  .object({
    maxSteps: z.number().int().min(1).max(200).default(50),
  })
  .default({});
export type FlowSettings = z.infer<typeof flowSettingsSchema>;

export const createFlowSchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(1000).optional().nullable(),
  tags: z.array(z.string().min(1).max(40)).max(10).default([]),
  template: z.string().max(60).optional(),
});
export type CreateFlowInput = z.infer<typeof createFlowSchema>;

export const updateFlowSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  description: z.string().max(1000).optional().nullable(),
  tags: z.array(z.string().min(1).max(40)).max(10).optional(),
  status: z.enum(['active', 'archived']).optional(),
});
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>;

export const saveFlowDraftSchema = z.object({
  graph: flowGraphSchema,
  settings: flowSettingsSchema.optional(),
  changeNote: z.string().max(500).optional().nullable(),
});
export type SaveFlowDraftInput = z.infer<typeof saveFlowDraftSchema>;

export const testFlowSchema = z.object({
  versionId: z.string().uuid().optional(),
  /** Pretend this lead triggered the flow. */
  leadId: z.string().uuid().optional(),
  /** Extra values available as {{event.*}}. */
  event: z.record(z.unknown()).default({}),
  /** false = really send messages and run tools (still flagged as a test). */
  dryRun: z.boolean().default(true),
});
export type TestFlowInput = z.infer<typeof testFlowSchema>;

export const triggerFlowSchema = z.object({
  leadId: z.string().uuid().optional(),
  event: z.record(z.unknown()).default({}),
});
export type TriggerFlowInput = z.infer<typeof triggerFlowSchema>;

export interface FlowValidationIssue {
  nodeId?: string;
  level: 'error' | 'warning';
  message: string;
}

const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

/** Structural validation shared by the canvas (live badges) and the publish endpoint. */
export function validateFlowGraph(graph: FlowGraph): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];
  const ids = new Set(graph.nodes.map(n => n.id));
  if (ids.size !== graph.nodes.length) issues.push({ level: 'error', message: 'Two steps share the same id.' });
  const triggers = graph.nodes.filter(n => n.type === 'trigger');
  if (triggers.length === 0) issues.push({ level: 'error', message: 'Add a trigger so the flow knows when to start.' });

  for (const e of graph.edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) issues.push({ level: 'error', message: `A connection points to a step that no longer exists (${e.id}).` });
  }
  const out = (id: string, handle?: string) => graph.edges.filter(e => e.source === id && (handle === undefined || (e.sourceHandle ?? 'out') === handle));

  for (const n of graph.nodes) {
    const d = n.data;
    const need = (ok: boolean, message: string) => ok || issues.push({ nodeId: n.id, level: 'error', message });
    switch (n.type) {
      case 'trigger':
        need((FLOW_TRIGGER_TYPES as readonly string[]).includes(String(d.triggerType)), 'Choose what starts this flow.');
        if (d.triggerType === 'schedule') need(Number(d.everyMinutes) >= 5, 'Schedule must run at least every 5 minutes.');
        break;
      case 'send_message':
        need(text(d.text), 'Write the message to send.');
        break;
      case 'ai_step':
        need(text(d.prompt), 'Write the instruction for the AI.');
        break;
      case 'condition':
        need(text(d.field), 'Choose the value to check.');
        need((CONDITION_OPERATORS as readonly string[]).includes(String(d.operator)), 'Choose how to compare.');
        break;
      case 'llm_router': {
        const choices = Array.isArray(d.choices) ? d.choices : [];
        need(choices.length >= 2, 'Add at least two choices for the AI to pick from.');
        break;
      }
      case 'wait':
        need(Number(d.minutes) >= 1 && Number(d.minutes) <= 60 * 24 * 30, 'Wait between 1 minute and 30 days.');
        break;
      case 'loop':
        need(Number(d.times) >= 1 && Number(d.times) <= 20, 'Repeat between 1 and 20 times.');
        break;
      case 'tool':
        need(text(d.toolId), 'Pick a tool.');
        break;
      case 'action':
        need(text(d.actionId), 'Pick an action.');
        break;
      case 'set_variable':
        need(text(d.name), 'Name the variable.');
        break;
      case 'sub_flow':
        need(text(d.flowId), 'Pick the flow to run.');
        break;
      default:
        break;
    }
    if (n.type !== 'end' && n.type !== 'trigger' && out(n.id).length === 0 && n.type !== 'sub_flow') {
      issues.push({ nodeId: n.id, level: 'warning', message: 'This step has no next step; the flow ends here.' });
    }
  }

  // Reachability from the triggers
  const reached = new Set<string>();
  const stack = triggers.map(t => t.id);
  while (stack.length) {
    const id = stack.pop()!;
    if (reached.has(id)) continue;
    reached.add(id);
    for (const e of out(id)) stack.push(e.target);
  }
  for (const n of graph.nodes) {
    if (!reached.has(n.id)) issues.push({ nodeId: n.id, level: 'warning', message: 'Not connected to any trigger; this step never runs.' });
  }
  return issues;
}

export interface FlowItem {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  template: string | null;
  status: 'active' | 'archived';
  activeVersionId: string | null;
  activeVersion: number | null;
  latestVersion: number;
  hasUnpublishedDraft: boolean;
  triggerTypes: string[];
  executionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FlowVersionItem {
  id: string;
  flowId: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  graph: FlowGraph;
  settings: FlowSettings;
  changeNote: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface FlowTemplateItem {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export type ExecutionStatus = 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';

export interface FlowExecutionItem {
  id: string;
  flowId: string;
  flowName: string;
  flowVersion: number;
  triggerType: string;
  leadId: string | null;
  leadName: string | null;
  conversationId: string | null;
  status: ExecutionStatus;
  isTest: boolean;
  currentNode: string | null;
  resumeAt: string | null;
  error: string | null;
  totalTokens: number;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
}

export interface FlowStepRunItem {
  id: string;
  nodeId: string;
  nodeType: string;
  status: 'ok' | 'error' | 'skipped' | 'waiting';
  input: unknown;
  output: unknown;
  error: string | null;
  tokens: number;
  durationMs: number | null;
  startedAt: string;
}

export interface FlowExecutionDetail extends FlowExecutionItem {
  variables: Record<string, unknown>;
  steps: FlowStepRunItem[];
}
