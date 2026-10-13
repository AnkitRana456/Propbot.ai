import { z } from 'zod';
import {
  actionStatusSchema,
  actionTierSchema,
  agentActionSchema,
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
} from '../schemas/actions.js';

export type ActionTier = z.infer<typeof actionTierSchema>;
export type ActionStatus = z.infer<typeof actionStatusSchema>;
export type AgentAction = z.infer<typeof agentActionSchema>;

export type SearchPropertiesAction = z.infer<typeof searchPropertiesActionSchema>;
export type SummarizeLeadAction = z.infer<typeof summarizeLeadActionSchema>;
export type AddTagAction = z.infer<typeof addTagActionSchema>;
export type CreateTaskAction = z.infer<typeof createTaskActionSchema>;
export type DraftMessageAction = z.infer<typeof draftMessageActionSchema>;
export type UpdateBuyerDnaAction = z.infer<typeof updateBuyerDnaActionSchema>;
export type SendPriceQuoteAction = z.infer<typeof sendPriceQuoteActionSchema>;
export type MarkBookedAction = z.infer<typeof markBookedActionSchema>;
export type ReassignHotLeadAction = z.infer<typeof reassignHotLeadActionSchema>;
export type SendPaymentLinkAction = z.infer<typeof sendPaymentLinkActionSchema>;
