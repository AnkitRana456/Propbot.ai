import { z } from 'zod';

// ==========================================
// Model Context Protocol (MCP) Schemas
// ==========================================

export const mcpToolNameSchema = z.enum([
  'get_leads',
  'get_lead_detail',
  'get_pipeline_stats',
  'get_appointments',
  'get_inventory',
  'create_lead_note',
  'update_lead_status',
  'schedule_appointment',
  'send_payment_link',
]);

export const mcpGetLeadsInputSchema = z.object({
  status: z.string().optional(),
  intentLabel: z.enum(['hot', 'warm', 'cold']).optional(),
  minScore: z.number().min(0).max(100).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export const mcpGetLeadDetailInputSchema = z.object({
  leadId: z.string().uuid(),
});

export const mcpGetPipelineStatsInputSchema = z.object({
  groupBy: z.enum(['status', 'intent', 'source']).default('status'),
});

export const mcpGetAppointmentsInputSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const mcpGetInventoryInputSchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.string().optional(),
  bhk: z.number().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const mcpCreateLeadNoteInputSchema = z.object({
  leadId: z.string().uuid(),
  content: z.string().min(1).max(2000),
});

export const mcpUpdateLeadStatusInputSchema = z.object({
  leadId: z.string().uuid(),
  status: z.string().min(1).max(50),
  reason: z.string().max(500).optional(),
});

export const mcpScheduleAppointmentInputSchema = z.object({
  leadId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  scheduledAt: z.string(),
  type: z.enum(['site_visit', 'video_call', 'in_person']).default('site_visit'),
  notes: z.string().max(500).optional(),
});

export const mcpSendPaymentLinkInputSchema = z.object({
  leadId: z.string().uuid(),
  amount: z.number().positive(),
  unitId: z.string().optional(),
  currency: z.string().default('INR'),
  notes: z.string().max(500).optional(),
});

export const mcpToolCallResultSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal('text'),
      text: z.string(),
    }),
  ),
  isError: z.boolean().optional(),
});

export type McpToolName = z.infer<typeof mcpToolNameSchema>;
export type McpGetLeadsInput = z.infer<typeof mcpGetLeadsInputSchema>;
export type McpGetLeadDetailInput = z.infer<typeof mcpGetLeadDetailInputSchema>;
export type McpGetPipelineStatsInput = z.infer<typeof mcpGetPipelineStatsInputSchema>;
export type McpGetAppointmentsInput = z.infer<typeof mcpGetAppointmentsInputSchema>;
export type McpGetInventoryInput = z.infer<typeof mcpGetInventoryInputSchema>;
export type McpCreateLeadNoteInput = z.infer<typeof mcpCreateLeadNoteInputSchema>;
export type McpUpdateLeadStatusInput = z.infer<typeof mcpUpdateLeadStatusInputSchema>;
export type McpScheduleAppointmentInput = z.infer<typeof mcpScheduleAppointmentInputSchema>;
export type McpSendPaymentLinkInput = z.infer<typeof mcpSendPaymentLinkInputSchema>;
export type McpToolCallResult = z.infer<typeof mcpToolCallResultSchema>;
