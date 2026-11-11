/**
 * ElevenLabs Custom LLM endpoint — OpenAI-compatible streaming completions.
 *
 * ElevenLabs docs: https://elevenlabs.io/docs/conversational-ai/customization/custom-llm
 *
 * Configure in ElevenLabs dashboard:
 *   Custom LLM URL: https://<your-api>/api/elevenlabs/llm/v1/chat/completions
 *   Custom LLM extra headers: { "x-elevenlabs-secret": "<ELEVENLABS_LLM_SECRET>" }
 *
 * Required env vars:
 *   ELEVENLABS_CHATBOT_ID   — the PropBot chatbot UUID to use for RAG
 *   ELEVENLABS_COMPANY_ID   — the company UUID that owns the chatbot
 *   ELEVENLABS_LLM_SECRET   — shared secret to verify requests are from ElevenLabs (optional in dev)
 */
import { Router, type Request, type Response } from 'express';
import { retrievalService } from '../modules/ai/retrieval.service.js';
import { generateTextStream } from '../modules/ai/llm.js';

export const elevenLabsLlmRouter: Router = Router();

// shortcut: no per-request auth — relies on shared secret; add IP allowlist for hardened prod setup
elevenLabsLlmRouter.post('/v1/chat/completions', async (req: Request, res: Response) => {
  // Secret check
  const secret = process.env.ELEVENLABS_LLM_SECRET;
  if (secret && req.headers['x-elevenlabs-secret'] !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const companyId = process.env.ELEVENLABS_COMPANY_ID;
  const chatbotId = process.env.ELEVENLABS_CHATBOT_ID;
  if (!companyId || !chatbotId) {
    res.status(503).json({ error: 'ELEVENLABS_COMPANY_ID / ELEVENLABS_CHATBOT_ID not set' });
    return;
  }

  // Parse OpenAI messages format
  const messages: Array<{ role: string; content: string }> = req.body?.messages ?? [];
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') {
      lastUserIdx = i;
      break;
    }
  }

  const userMessage = lastUserIdx >= 0 ? messages[lastUserIdx]?.content ?? '' : '';
  if (!userMessage) {
    res.status(400).json({ error: 'No user message found' });
    return;
  }

  // Build history from prior turns (skip last user message, already used as query)
  const prior = lastUserIdx >= 0 ? messages.slice(0, lastUserIdx) : [];
  const history = prior
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role === 'user' ? 'visitor' as const : 'assistant' as const, content: m.content }));

  // Get RAG system prompt without generating (we stream ourselves)
  let systemPrompt: string;
  try {
    const rag = await retrievalService.query(
      companyId,
      chatbotId,
      { query: userMessage, topK: 4 },
      { skipGeneration: true, history },
    );
    systemPrompt = rag.systemPrompt ?? `You are a helpful real estate assistant.`;
  } catch {
    systemPrompt = `You are a helpful real estate assistant.`;
  }

  // Stream in OpenAI SSE format
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const id = `chatcmpl-${Date.now()}`;
  const model = process.env.GEMINI_MODEL ?? 'gemini-flash-lite-latest';

  // Send start chunk
  const startChunk = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
  };
  res.write(`data: ${JSON.stringify(startChunk)}\n\n`);

  try {
    await generateTextStream(
      { systemPrompt, userMessage, history: history.map(h => ({ role: h.role === 'visitor' ? 'user' : 'model', text: h.content })), maxTokens: 300 },
      (chunk) => {
        const c = {
          id,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }],
        };
        res.write(`data: ${JSON.stringify(c)}\n\n`);
      },
    );
  } catch {
    // stream already started — send a graceful fallback chunk
    const fallback = { id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { content: ' I am having a little trouble right now. Please share your phone number and our team will call you back.' }, finish_reason: null }] };
    res.write(`data: ${JSON.stringify(fallback)}\n\n`);
  }

  // Done
  const doneChunk = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
  };
  res.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
});
