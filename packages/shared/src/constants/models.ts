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

export const DEFAULT_AGENT_MODEL = 'gemini-2.0-flash';

export const GEMINI_MODELS: readonly ModelDefinition[] = [
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    tier: 'balanced',
    description: 'Default. Fast, accurate and inexpensive for property Q&A and lead qualification.',
    contextTokens: 1_000_000,
    promptPer1k: 0.0001,
    completionPer1k: 0.0004,
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    tier: 'balanced',
    description: 'Smarter Flash variant. Better reasoning for complex buyer queries.',
    contextTokens: 1_000_000,
    promptPer1k: 0.0003,
    completionPer1k: 0.0025,
  },
  {
    id: 'gemini-2.0-flash-lite',
    label: 'Gemini 2.0 Flash-Lite',
    tier: 'fast',
    description: 'Cheapest and quickest. Good for simple FAQ and classification agents.',
    contextTokens: 1_000_000,
    promptPer1k: 0.00005,
    completionPer1k: 0.0002,
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    tier: 'smart',
    description: 'Strongest reasoning for complex negotiations and multi-step advice. Slower and pricier.',
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
