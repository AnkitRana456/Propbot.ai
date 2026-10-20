/**
 * Live Gemini check: one tiny generation call. Never prints the key.
 * Usage: pnpm --filter @propbot/api check:gemini
 */
import 'dotenv/config';
import { classifyLlmError, generateText, getGeminiModel } from '../src/modules/ai/llm.js';

const HINTS: Record<string, string> = {
  not_configured: 'Set GEMINI_API_KEY in apps/api/.env.',
  invalid_key: 'The key was rejected. Create a new one at https://aistudio.google.com/apikey.',
  quota: 'Quota or rate limit hit. Check billing/limits for the key, or retry later.',
  model_not_found: 'Set GEMINI_MODEL to a model your key can access (run models.list to see available ones).',
  timeout: 'Request timed out. Check network/proxy access to generativelanguage.googleapis.com.',
  unavailable: 'Gemini is temporarily unavailable. Retry shortly.',
};

async function main() {
  const present = Boolean(process.env.GEMINI_API_KEY);
  const model = getGeminiModel();
  console.log(`GEMINI_API_KEY: ${present ? 'present' : 'missing'}`);
  console.log(`GEMINI_MODEL:   ${model}`);
  if (!present) {
    console.error(`FAIL [not_configured] ${HINTS.not_configured}`);
    process.exit(1);
  }
  try {
    const res = await generateText(
      { userMessage: 'Reply with the single word: ok', temperature: 0, maxTokens: 16 },
      { attempts: 1, timeoutMs: 15_000 },
    );
    console.log(`Model reachable: yes`);
    console.log(`Latency:         ${res.latencyMs} ms`);
    console.log(`Tokens:          ${res.totalTokens}`);
    console.log(`Reply:           ${res.text.trim().slice(0, 60)}`);
  } catch (err) {
    const e = classifyLlmError(err);
    console.error(`Model reachable: no`);
    console.error(`FAIL [${e.kind}] ${e.message}. ${HINTS[e.kind] ?? ''}`);
    process.exit(1);
  }
}

main();
