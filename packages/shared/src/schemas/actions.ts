import { z } from 'zod';

export const actionTierSchema = z.enum(['T0', 'T1', 'T2', 'T3']);

export const actionStatusSchema = z.enum([
  'proposed',
  'approved',
  'rejected',
  'executed',
  'failed',
  'expired',
]);

const baseActionSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable().optional(),
  agent_name: z.string(),
  status: actionStatusSchema,
  tier: actionTierSchema,
  approved_by: z.string().uuid().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime(),
});

// T0 Actions
export const searchPropertiesActionSchema = baseActionSchema.extend({
  tier: z.literal('T0'),
  action_type: z.literal('search_properties'),
  args: z.object({
    budget_max: z.number().optional(),
    bhk: z.array(z.number()).optional(),
    locality: z.string().optional(),
  }),
  result: z.record(z.unknown()).nullable().optional(),
});

export const summarizeLeadActionSchema = baseActionSchema.extend({
  tier: z.literal('T0'),
  action_type: z.literal('summarize_lead'),
  args: z.object({
    lead_id: z.string().uuid(),
  }),
  result: z.record(z.unknown()).nullable().optional(),
});

// T1 Actions
export const addTagActionSchema = baseActionSchema.extend({
  tier: z.literal('T1'),
  action_type: z.literal('add_tag'),
  args: z.object({
    lead_id: z.string().uuid(),
    tag: z.string(),
  }),
  result: z.record(z.unknown()).nullable().optional(),
});

export const createTaskActionSchema = baseActionSchema.extend({
  tier: z.literal('T1'),
  action_type: z.literal('create_task'),
  args: z.object({
    lead_id: z.string().uuid(),
    title: z.string(),
    due_date: z.string().datetime().optional(),
  }),
  result: z.record(z.unknown()).nullable().optional(),
});

export const draftMessageActionSchema = baseActionSchema.extend({
  tier: z.literal('T1'),
  action_type: z.literal('draft_message'),
  args: z.object({
    lead_id: z.string().uuid(),
    channel: z.enum(['whatsapp', 'email', 'sms']).default('whatsapp'),
    body: z.string(),
  }),
  result: z.record(z.unknown()).nullable().optional(),
});

export const updateBuyerDnaActionSchema = baseActionSchema.extend({
  tier: z.literal('T1'),
  action_type: z.literal('update_buyer_dna'),
  args: z.object({
    lead_id: z.string().uuid(),
    buyer_dna_patch: z.record(z.unknown()),
  }),
  result: z.record(z.unknown()).nullable().optional(),
});

// T2 Actions
export const sendPriceQuoteActionSchema = baseActionSchema.extend({
  tier: z.literal('T2'),
  action_type: z.literal('send_price_quote'),
  args: z.object({
    lead_id: z.string().uuid(),
    project_id: z.string().uuid().optional(),
    offered_price: z.number().positive(),
    terms: z.string().optional(),
  }),
  result: z.record(z.unknown()).nullable().optional(),
});

export const markBookedActionSchema = baseActionSchema.extend({
  tier: z.literal('T2'),
  action_type: z.literal('mark_booked'),
  args: z.object({
    lead_id: z.string().uuid(),
    unit_id: z.string().uuid().optional(),
    booking_amount: z.number().positive().optional(),
  }),
  result: z.record(z.unknown()).nullable().optional(),
});

export const reassignHotLeadActionSchema = baseActionSchema.extend({
  tier: z.literal('T2'),
  action_type: z.literal('reassign_hot_lead'),
  args: z.object({
    lead_id: z.string().uuid(),
    new_agent_id: z.string().uuid(),
  }),
  result: z.record(z.unknown()).nullable().optional(),
});

export const sendPaymentLinkActionSchema = baseActionSchema.extend({
  tier: z.literal('T2'),
  action_type: z.literal('send_payment_link'),
  args: z.object({
    lead_id: z.string().uuid(),
    unit_id: z.string().uuid().optional(),
    amount: z.number().positive(),
    description: z.string().optional(),
  }),
  result: z.record(z.unknown()).nullable().optional(),
});

export const agentActionSchema = z.discriminatedUnion('action_type', [
  searchPropertiesActionSchema,
  summarizeLeadActionSchema,
  addTagActionSchema,
  createTaskActionSchema,
  draftMessageActionSchema,
  updateBuyerDnaActionSchema,
  sendPriceQuoteActionSchema,
  markBookedActionSchema,
  reassignHotLeadActionSchema,
  sendPaymentLinkActionSchema,
]);

// Approval Queue DTOs
export const approveActionRequestSchema = z.object({
  editedArgs: z.record(z.unknown()).optional(),
});
export type ApproveActionRequest = z.infer<typeof approveActionRequestSchema>;

export const rejectActionRequestSchema = z.object({
  reason: z.string().min(1, 'A rejection reason is required'),
});
export type RejectActionRequest = z.infer<typeof rejectActionRequestSchema>;

export const nextBestActionItemSchema = z.object({
  actionType: z.string(),
  title: z.string(),
  explanation: z.string(),
  tier: actionTierSchema,
  args: z.record(z.unknown()).default({}),
  suggestedAt: z.string(),
  status: z.enum(['suggested', 'executing', 'executed', 'dismissed']).default('suggested'),
});
export type NextBestActionItem = z.infer<typeof nextBestActionItemSchema>;
