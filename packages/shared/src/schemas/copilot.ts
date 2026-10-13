import { z } from 'zod';

export const copilotSuggestReplyInputSchema = z.object({
  conversationId: z.string().uuid().optional(),
  lastVisitorMessage: z.string().optional(),
  tone: z.enum(['professional', 'warm', 'urgent', 'consultative']).default('warm'),
});
export type CopilotSuggestReplyInput = z.infer<typeof copilotSuggestReplyInputSchema>;

export const copilotSuggestedReplyItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  strategy: z.string(),
});
export type CopilotSuggestedReplyItem = z.infer<typeof copilotSuggestedReplyItemSchema>;

export const copilotSuggestReplyResponseSchema = z.object({
  suggestions: z.array(copilotSuggestedReplyItemSchema),
});
export type CopilotSuggestReplyResponse = z.infer<typeof copilotSuggestReplyResponseSchema>;

export const copilotSummaryResponseSchema = z.object({
  leadId: z.string().uuid(),
  leadName: z.string(),
  intentScore: numberOrZero(),
  status: z.string(),
  sentiment: z.string().optional(),
  intentLevel: z.string().optional(),
  summary: z.string(),
  keyRequirements: z.array(z.string()),
  statedObjections: z.array(z.string()),
  recommendedAction: z.string(),
  generatedAt: z.string(),
});
export type CopilotSummaryResponse = z.infer<typeof copilotSummaryResponseSchema>;

export const copilotCallScriptResponseSchema = z.object({
  leadId: z.string().uuid(),
  leadName: z.string(),
  callGoal: z.string(),
  suggestedOpener: z.string(),
  qualifyingQuestions: z.array(z.string()),
  talkingPoints: z.array(z.string()),
  objectionPreemptions: z.array(
    z.object({
      anticipatedObjection: z.string(),
      rebuttal: z.string(),
    }),
  ),
  closingHook: z.string(),
});
export type CopilotCallScriptResponse = z.infer<typeof copilotCallScriptResponseSchema>;

export const copilotObjectionRebuttalInputSchema = z.object({
  objection: z.string().min(2),
  projectContext: z.string().optional(),
});
export type CopilotObjectionRebuttalInput = z.infer<typeof copilotObjectionRebuttalInputSchema>;

export const copilotObjectionRebuttalResponseSchema = z.object({
  objection: z.string(),
  detectedCategory: z.string(),
  rebuttals: z.array(
    z.object({
      framework: z.string(), // e.g. "Value Reframing", "Payment Flexibility", "Connectivity Highlight"
      text: z.string(),
    }),
  ),
});
export type CopilotObjectionRebuttalResponse = z.infer<typeof copilotObjectionRebuttalResponseSchema>;

function numberOrZero() {
  return z.number().default(0);
}
