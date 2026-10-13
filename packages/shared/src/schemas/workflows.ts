import { z } from 'zod';
import { domainEventTypeSchema } from './events.js';

export const workflowNodeTypeSchema = z.enum(['trigger', 'condition', 'action', 'branch', 'end']);
export const workflowStatusSchema = z.enum(['draft', 'active', 'paused', 'archived']);

const baseNodeSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
});

export const triggerNodeSchema = baseNodeSchema.extend({
  type: z.literal('trigger'),
  config: z.object({
    event_type: domainEventTypeSchema,
    filters: z.record(z.unknown()).optional(),
  }),
});

export const conditionNodeSchema = baseNodeSchema.extend({
  type: z.literal('condition'),
  config: z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'in']),
    value: z.unknown(),
  }),
});

export const actionKindSchema = z.enum([
  'send_whatsapp',
  'send_email',
  'send_sms',
  'assign_agent',
  'create_task',
  'add_tag',
  'change_status',
  'call_webhook',
  'wait',
  'send_payment_link',
]);

export const actionNodeSchema = baseNodeSchema.extend({
  type: z.literal('action'),
  config: z.object({
    action_kind: actionKindSchema,
    parameters: z.record(z.unknown()).default({}),
  }),
});

export const branchNodeSchema = baseNodeSchema.extend({
  type: z.literal('branch'),
  config: z.object({
    conditions: z.array(
      z.object({
        target_node_id: z.string(),
        expression: z.string(),
      }),
    ),
    default_node_id: z.string(),
  }),
});

export const endNodeSchema = baseNodeSchema.extend({
  type: z.literal('end'),
  config: z.object({
    outcome: z.string().optional(),
  }),
});

export const workflowNodeSchema = z.discriminatedUnion('type', [
  triggerNodeSchema,
  conditionNodeSchema,
  actionNodeSchema,
  branchNodeSchema,
  endNodeSchema,
]);

export const workflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  source_handle: z.string().optional(),
  target_handle: z.string().optional(),
});

export const workflowDefinitionSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: workflowStatusSchema.default('draft'),
  version: z.number().int().positive().default(1),
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const createWorkflowRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  definition: z.object({
    nodes: z.array(workflowNodeSchema),
    edges: z.array(workflowEdgeSchema),
  }),
});

export const updateWorkflowRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  definition: z.object({
    nodes: z.array(workflowNodeSchema),
    edges: z.array(workflowEdgeSchema),
  }).optional(),
});

export const workflowDraftFromPromptRequestSchema = z.object({
  prompt: z.string().min(5).max(1000),
});

export const testWorkflowRequestSchema = z.object({
  payload: z.record(z.unknown()).default({}),
});

export type WorkflowNodeType = z.infer<typeof workflowNodeTypeSchema>;
export type ActionKind = z.infer<typeof actionKindSchema>;
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
export type CreateWorkflowRequest = z.infer<typeof createWorkflowRequestSchema>;
export type UpdateWorkflowRequest = z.infer<typeof updateWorkflowRequestSchema>;
