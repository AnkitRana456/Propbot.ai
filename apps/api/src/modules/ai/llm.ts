import { GoogleGenAI } from '@google/genai';
import { pino } from 'pino';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

/**
 * Single entry point for Google Gemini (chat, RAG answering, embeddings, sentiment).
 * LLM_PROVIDER selects the backend; "gemini" is the default. OpenAI/Anthropic remain
 * available in ModelRouter only when LLM_PROVIDER is set to them.
 */
export type LlmProvider = 'gemini' | 'openai' | 'anthropic';

export const DEFAULT_GEMINI_MODEL = 'models/gemini-flash-lite-latest';
export const DEFAULT_GEMINI_EMBEDDING_MODEL = 'models/gemini-embedding-001';

export const LLM_FALLBACK_MESSAGE =
  "I'm having a little trouble right now. Please share your phone number and our team will get back to you shortly.";

export function getLlmProvider(): LlmProvider {
  const raw = (process.env.LLM_PROVIDER ?? '').toLowerCase();
  if (raw === 'openai' || raw === 'anthropic' || raw === 'gemini') return raw;
  return 'gemini';
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export type LlmErrorKind =
  | 'not_configured'
  | 'invalid_key'
  | 'quota'
  | 'model_not_found'
  | 'timeout'
  | 'unavailable'
  | 'unknown';

export class LlmError extends Error {
  constructor(
    readonly kind: LlmErrorKind,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

/** Maps SDK/HTTP failures to a stable, user-presentable classification. */
export function classifyLlmError(err: unknown): LlmError {
  if (err instanceof LlmError) return err;
  const e = err as { status?: number; code?: number; message?: string; name?: string };
  const status = e?.status ?? e?.code;
  const msg = e?.message ?? String(err);
  if (e?.name === 'AbortError' || /timed? ?out|aborted/i.test(msg)) {
    return new LlmError('timeout', 'Gemini request timed out', true);
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    // Not retried: an exhausted quota will not recover within the backoff window, so fail fast to the
    // offline fallback instead of making the visitor wait.
    return new LlmError('quota', 'Gemini quota or rate limit exceeded', false);
  }
  if (status === 401 || status === 403 || /API key (not valid|expired)|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) {
    return new LlmError('invalid_key', 'Gemini API key is invalid or not permitted', false);
  }
  if (status === 404 || /not found|NOT_FOUND/i.test(msg)) {
    return new LlmError('model_not_found', `Gemini model not found (${getGeminiModel()})`, false);
  }
  if (status === 500 || status === 502 || status === 503 || status === 504 || /UNAVAILABLE|overloaded/i.test(msg)) {
    return new LlmError('unavailable', 'Gemini service temporarily unavailable', true);
  }
  return new LlmError('unknown', msg.slice(0, 200), false);
}

let cachedClient: { key: string; client: GoogleGenAI } | null = null;

function getClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new LlmError('not_configured', 'GEMINI_API_KEY is not set', false);
  if (!cachedClient || cachedClient.key !== key) {
    cachedClient = { key, client: new GoogleGenAI({ apiKey: key, httpOptions: { retryOptions: { attempts: 1 } } }) };
  }
  return cachedClient.client;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export interface RetryOptions {
  /** Total attempts including the first. Default 3. */
  attempts?: number;
  /** Per-attempt timeout. Default 12s. */
  timeoutMs?: number;
  /** Base backoff; delays are base * 2^n (500ms, 1s, ...). Default 500ms. */
  backoffMs?: number;
}

async function withRetry<T>(fn: (signal: AbortSignal) => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const backoffMs = opts.backoffMs ?? 500;
  let last: LlmError | undefined;

  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await Promise.race([
        fn(controller.signal),
        new Promise<never>((_, reject) =>
          controller.signal.addEventListener('abort', () =>
            reject(new LlmError('timeout', 'Gemini request timed out', true)),
          ),
        ),
      ]);
    } catch (err) {
      last = classifyLlmError(err);
      if (!last.retryable || i === attempts - 1) break;
      const delay = backoffMs * 2 ** i;
      log.warn({ kind: last.kind, attempt: i + 1, delay }, 'Gemini call failed, retrying');
      await sleep(delay);
    } finally {
      clearTimeout(timer);
    }
  }
  throw last ?? new LlmError('unknown', 'Gemini call failed', false);
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface GenerateParams {
  systemPrompt?: string;
  userMessage: string;
  /** Earlier turns of the same conversation (oldest first). */
  history?: ChatTurn[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  json?: boolean;
}

export interface GenerateResult {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
}

function buildContents(params: GenerateParams) {
  const turns = (params.history ?? []).filter(t => t.text.trim()).slice(-20);
  if (turns.length === 0) return params.userMessage;
  return [
    ...turns.map(t => ({ role: t.role, parts: [{ text: t.text }] })),
    { role: 'user' as const, parts: [{ text: params.userMessage }] },
  ];
}

export async function generateText(params: GenerateParams, retry?: RetryOptions): Promise<GenerateResult> {
  const client = getClient();
  const model = params.model ?? getGeminiModel();
  const started = Date.now();

  const res = await withRetry(
    signal =>
      client.models.generateContent({
        model,
        contents: buildContents(params),
        config: {
          systemInstruction: params.systemPrompt,
          temperature: params.temperature ?? 0.7,
          maxOutputTokens: params.maxTokens ?? 600,
          abortSignal: signal,
          ...(params.json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    retry,
  );

  const usage = res.usageMetadata;
  const text = res.text ?? '';
  const promptTokens = usage?.promptTokenCount ?? Math.ceil(((params.systemPrompt?.length ?? 0) + params.userMessage.length) / 4);
  const completionTokens = usage?.candidatesTokenCount ?? Math.ceil(text.length / 4);
  return {
    text,
    model,
    promptTokens,
    completionTokens,
    totalTokens: usage?.totalTokenCount ?? promptTokens + completionTokens,
    latencyMs: Date.now() - started,
  };
}

/**
 * Streams chunks to onChunk. Retries only before the first chunk is delivered,
 * so a visitor never sees duplicated text.
 */
export async function generateTextStream(
  params: GenerateParams,
  onChunk: (chunk: string) => Promise<void> | void,
  retry?: RetryOptions,
): Promise<GenerateResult> {
  const client = getClient();
  const model = params.model ?? getGeminiModel();
  const started = Date.now();
  let delivered = false;
  let full = '';

  await withRetry(async signal => {
    if (delivered) throw new LlmError('unknown', 'Stream interrupted after output started', false);
    const stream = await client.models.generateContentStream({
      model,
      contents: buildContents(params),
      config: {
        systemInstruction: params.systemPrompt,
        temperature: params.temperature ?? 0.7,
        maxOutputTokens: params.maxTokens ?? 600,
        abortSignal: signal,
      },
    });
    for await (const chunk of stream) {
      const piece = chunk.text;
      if (piece) {
        delivered = true;
        full += piece;
        await onChunk(piece);
      }
    }
  }, { timeoutMs: 20_000, ...retry });

  const promptTokens = Math.ceil(((params.systemPrompt?.length ?? 0) + params.userMessage.length) / 4);
  const completionTokens = Math.ceil(full.length / 4);
  return {
    text: full,
    model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    latencyMs: Date.now() - started,
  };
}

/** Returns a vector, or throws LlmError. Callers decide on a deterministic fallback. */
export async function embedText(text: string, dimension?: number): Promise<number[]> {
  const client = getClient();
  const res = await withRetry(() =>
    client.models.embedContent({
      model: process.env.GEMINI_EMBEDDING_MODEL?.trim() || DEFAULT_GEMINI_EMBEDDING_MODEL,
      contents: text.slice(0, 8000),
      config: dimension ? { outputDimensionality: dimension } : undefined,
    }),
  );
  const values = res.embeddings?.[0]?.values;
  if (!values?.length) throw new LlmError('unknown', 'Gemini returned no embedding', false);
  return values;
}

export type Sentiment = 'positive' | 'neutral' | 'frustrated';

const FRUSTRATION_PATTERNS = [
  /\buseless\b/i,
  /\bnot working\b/i,
  /\bwaste of (time|money)\b/i,
  /\bterrible\b/i,
  /\bworst\b/i,
  /\bridiculous\b/i,
  /\b(scam|fraud|cheat(ed|ing)?)\b/i,
  /\bbad experience\b/i,
  /\bangry\b/i,
  /\bcancel booking\b/i,
  /!{2,}/, // multiple exclamation marks
];

/** Cheap local signal used before (or instead of) an LLM call. Shared by web chat and WhatsApp. */
export function heuristicSentiment(message: string): Sentiment {
  const letters = message.replace(/[^A-Za-z]/g, '');
  // Shouting = long, multi-word and entirely upper case (a lone acronym such as RERA is not anger)
  const allCaps =
    letters.length >= 8 && letters === letters.toUpperCase() && message.trim().split(/\s+/).length >= 2;
  if (allCaps || FRUSTRATION_PATTERNS.some(p => p.test(message))) return 'frustrated';
  return 'neutral';
}

export function isFrustrated(message: string): boolean {
  return heuristicSentiment(message) === 'frustrated';
}

export const DEFAULT_ESCALATION_MESSAGE =
  "I'm sorry about the trouble. I've flagged this for a senior property advisor who will contact you personally. If you share your phone number, they can call you right away.";

/** Heuristic first; the model only runs when the heuristic is inconclusive and Gemini is configured. */
export async function analyzeSentiment(message: string): Promise<Sentiment> {
  const quick = heuristicSentiment(message);
  if (quick === 'frustrated' || !isGeminiConfigured()) return quick;
  try {
    const { text } = await generateText(
      {
        systemPrompt:
          'Classify the sentiment of the user message as exactly one word: positive, neutral, or frustrated. Frustrated means anger, annoyance or complaint.',
        userMessage: message.slice(0, 1000),
        temperature: 0,
        maxTokens: 5,
      },
      { attempts: 1, timeoutMs: 4000 },
    );
    const word = text.trim().toLowerCase();
    return word.startsWith('frustrat') ? 'frustrated' : word.startsWith('pos') ? 'positive' : 'neutral';
  } catch {
    return quick;
  }
}
