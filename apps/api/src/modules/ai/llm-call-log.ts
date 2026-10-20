import { estimateCostUsd } from '@propbot/shared';
import { pino } from 'pino';
import { db } from '../../db/index.js';
import { paymentsService } from '../payments/payments.service.js';
import { llmCalls, usageLedger } from '../../db/schema/index.js';
import type { ChatTurn } from './llm.js';

const log = pino({ name: 'llm-call-log', level: process.env.LOG_LEVEL ?? 'info' });

/** Context attached to a model call so it can be traced back to an agent / conversation. */
export interface LlmTrace {
  agentId?: string | null;
  agentVersionId?: string | null;
  conversationId?: string | null;
  channel?: string;
  purpose?: 'chat' | 'routing' | 'extraction' | 'summary' | 'test' | 'compare' | 'tool';
}

interface CallParamsLike {
  companyId: string;
  chatbotId: string;
  trace?: LlmTrace;
}

interface CallResultLike {
  provider: string;
  model: string;
  tokens: { prompt: number; completion: number; total: number };
  latencyMs: number;
  circuitBreakerTripped: boolean;
}

/** UUID check: callers sometimes pass placeholder ids (tests, previews) that must not hit uuid columns. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (v: string | null | undefined) => (v && UUID.test(v) ? v : null);

/**
 * Fire-and-forget: one llm_calls row per model call (tokens, latency, estimated cost, outcome).
 * Never throws and never delays the visitor's answer.
 */
export function recordLlmCall(params: CallParamsLike, result: CallResultLike): void {
  if (!UUID.test(params.companyId)) return;
  const fallback = result.provider === 'fallback_offline';
  void db
    .insert(llmCalls)
    .values({
      companyId: params.companyId,
      chatbotId: uuidOrNull(params.chatbotId),
      agentId: uuidOrNull(params.trace?.agentId),
      agentVersionId: uuidOrNull(params.trace?.agentVersionId),
      conversationId: uuidOrNull(params.trace?.conversationId),
      channel: params.trace?.channel ?? null,
      purpose: params.trace?.purpose ?? 'chat',
      model: result.model,
      promptTokens: result.tokens.prompt,
      completionTokens: result.tokens.completion,
      totalTokens: result.tokens.total,
      latencyMs: result.latencyMs,
      costUsd: fallback ? '0' : estimateCostUsd(result.model, result.tokens.prompt, result.tokens.completion).toFixed(6),
      status: fallback ? 'fallback' : 'ok',
      errorKind: fallback ? 'provider_unavailable' : null,
    })
    .catch(err => log.warn({ err: err instanceof Error ? err.message : err }, 'Could not record llm call'));
  // Usage metering (tracking only): the base for credits when pricing is decided
  if (!fallback) {
    const cost = estimateCostUsd(result.model, result.tokens.prompt, result.tokens.completion);
    void db
      .insert(usageLedger)
      .values({ companyId: params.companyId, kind: 'llm_tokens', channel: params.trace?.channel ?? null, quantity: String(result.tokens.total), unit: 'tokens', costUsd: cost.toFixed(6), refType: 'llm_call' })
      .returning({ id: usageLedger.id })
      .then(([row]) => paymentsService.consume(params.companyId, paymentsService.usageCredits(cost), row?.id))
      .catch(() => undefined);
  }
}

export function toGeminiHistory(
  history: Array<{ role: 'visitor' | 'assistant'; content: string }> | undefined,
): ChatTurn[] | undefined {
  if (!history?.length) return undefined;
  return history.map(h => ({ role: h.role === 'visitor' ? 'user' : 'model', text: h.content }));
}
