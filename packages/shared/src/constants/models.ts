/**
 * Registry of the Gemini models an agent may use. Agents store a model id from this list, so
 * adding or retiring a model is a code change in one place, not a data migration.
 * Prices are approximate USD per 1,000 tokens and only drive cost estimates in usage views.
 */
export type ModelTier = 'fast' | 'balanced' | 'smart';

export interface ModelDefinition {
  id: string;
  label: string;
  tier: ModelTier;
  description: string;
  contextTokens: number;
  promptPer1k: number;
  completionPer1k: number;
}

export const DEFAULT_AGENT_MODEL = 'gemini-3.8-flash';

export const GEMINI_MODELS: readonly ModelDefinition[] = [
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    tier: 'balanced',
    description: 'Default. Fast, accurate and inexpensive for property Q&A and lead qualification.',
    contextTokens: 1_000_000,
    promptPer1k: 0.0001,
    completionPer1k: 0.0004,
  },
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    tier: 'balanced',
    description: 'Previous-generation Flash; use if 3.8 behaves differently for your prompts.',
    contextTokens: 1_000_000,
    promptPer1k: 0.0001,
    completionPer1k: 0.0004,
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    tier: 'fast',
    description: 'Cheapest and quickest. Good for simple FAQ and classification agents.',
    contextTokens: 1_000_000,
    promptPer1k: 0.00005,
    completionPer1k: 0.0002,
  },
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro (preview)',
    tier: 'smart',
    description: 'Strongest reasoning for complex negotiations and multi-step advice. Slower and pricier; preview model.',
    contextTokens: 1_000_000,
    promptPer1k: 0.00125,
    completionPer1k: 0.005,
  },
];

export function findModel(id: string | null | undefined): ModelDefinition | undefined {
  return GEMINI_MODELS.find(m => m.id === id);
}

export function estimateCostUsd(modelId: string | null | undefined, promptTokens: number, completionTokens: number): number {
  const m = findModel(modelId) ?? GEMINI_MODELS[0]!;
  return (promptTokens / 1000) * m.promptPer1k + (completionTokens / 1000) * m.completionPer1k;
}
