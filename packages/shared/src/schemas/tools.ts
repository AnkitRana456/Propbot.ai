import { z } from 'zod';

const KEY_RE = /^[a-z][a-z0-9_]{1,79}$/;

export const toolParamTypeSchema = z.enum(['string', 'number', 'boolean']);
export type ToolParamType = z.infer<typeof toolParamTypeSchema>;

export const toolParamSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9_]{0,59}$/, 'Letters, numbers and underscores, starting with a letter'),
  type: toolParamTypeSchema.default('string'),
  description: z.string().max(300).default(''),
  required: z.boolean().default(false),
});
export type ToolParam = z.infer<typeof toolParamSchema>;

export const gptToolConfigSchema = z.object({
  /** Instruction; reference inputs as {{key}}. */
  prompt: z.string().min(5).max(4000),
  model: z.string().max(60).optional(),
  temperature: z.number().min(0).max(1).default(0),
});

export const apiToolConfigSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  /** https URL; reference inputs as {{key}}. */
  url: z.string().min(8).max(1000),
  headers: z.record(z.string().max(500)).default({}),
  /** JSON or text body template for non-GET calls. */
  body: z.string().max(5000).default(''),
  /** Output name -> dot path into the JSON response (e.g. data.items.0.price). */
  responseMapping: z.record(z.string().max(200)).default({}),
  /** How the vaulted secret is sent. */
  authMode: z.enum(['none', 'bearer', 'header']).default('none'),
  authHeaderName: z.string().max(60).default('X-API-Key'),
  timeoutMs: z.number().int().min(500).max(15000).default(8000),
});

export const createToolSchema = z.object({
  key: z.string().regex(KEY_RE),
  name: z.string().min(2).max(150),
  description: z.string().max(1000).optional().nullable(),
  type: z.enum(['gpt', 'api']),
  config: z.record(z.unknown()),
  inputSchema: z.array(toolParamSchema).max(20).default([]),
  outputSchema: z.array(toolParamSchema).max(20).default([]),
  /** Plain secret; stored encrypted and never returned. */
  secret: z.string().max(2000).optional(),
  requiresApproval: z.boolean().default(false),
  rateLimitPerMin: z.number().int().min(1).max(600).default(30),
});
export type CreateToolInput = z.infer<typeof createToolSchema>;

export const updateToolSchema = createToolSchema.omit({ key: true, type: true }).partial().extend({
  status: z.enum(['active', 'disabled']).optional(),
  clearSecret: z.boolean().optional(),
});
export type UpdateToolInput = z.infer<typeof updateToolSchema>;

export const runToolSchema = z.object({ input: z.record(z.unknown()).default({}) });
export type RunToolInput = z.infer<typeof runToolSchema>;

export interface ToolItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  type: 'gpt' | 'api';
  config: Record<string, unknown>;
  inputSchema: ToolParam[];
  outputSchema: ToolParam[];
  hasSecret: boolean;
  requiresApproval: boolean;
  rateLimitPerMin: number;
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface ToolRunItem {
  id: string;
  toolId: string | null;
  status: 'ok' | 'error' | 'blocked' | 'pending_approval';
  input: Record<string, unknown>;
  output: unknown;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface ActionDefinitionItem {
  id: string;
  name: string;
  category: 'lead' | 'property' | 'appointment' | 'messaging' | 'ops';
  description: string;
  inputs: ToolParam[];
  outputs: string[];
  requiresApproval: boolean;
}
