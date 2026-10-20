import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent, generateContentStream: vi.fn(), embedContent: vi.fn() };
  },
}));

import {
  classifyLlmError,
  generateText,
  getLlmProvider,
  heuristicSentiment,
  LlmError,
} from '../../src/modules/ai/llm.js';

describe('llm provider module', () => {
  beforeEach(() => {
    generateContent.mockReset();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('defaults LLM_PROVIDER to gemini', () => {
    delete process.env.LLM_PROVIDER;
    expect(getLlmProvider()).toBe('gemini');
    process.env.LLM_PROVIDER = 'openai';
    expect(getLlmProvider()).toBe('openai');
    delete process.env.LLM_PROVIDER;
  });

  it('classifies common Gemini failures', () => {
    expect(classifyLlmError({ status: 429, message: 'x' }).kind).toBe('quota');
    expect(classifyLlmError({ status: 403, message: 'x' }).kind).toBe('invalid_key');
    expect(classifyLlmError({ status: 404, message: 'x' }).kind).toBe('model_not_found');
    expect(classifyLlmError({ status: 503, message: 'x' }).retryable).toBe(true);
  });

  it('retries retryable errors with backoff then succeeds', async () => {
    generateContent
      .mockRejectedValueOnce({ status: 503, message: 'UNAVAILABLE' })
      .mockResolvedValueOnce({ text: 'hello', usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 1, totalTokenCount: 4 } });
    const res = await generateText({ userMessage: 'hi' }, { backoffMs: 1 });
    expect(res.text).toBe('hello');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable errors', async () => {
    generateContent.mockRejectedValue({ status: 403, message: 'PERMISSION_DENIED' });
    await expect(generateText({ userMessage: 'hi' }, { backoffMs: 1 })).rejects.toMatchObject({ kind: 'invalid_key' });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('throws not_configured without a key', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(generateText({ userMessage: 'hi' })).rejects.toBeInstanceOf(LlmError);
  });

  it('flags frustration heuristically', () => {
    expect(heuristicSentiment('this is useless')).toBe('frustrated');
    expect(heuristicSentiment('WHY IS THIS NOT WORKING')).toBe('frustrated');
    expect(heuristicSentiment('what is the price of 3bhk?')).toBe('neutral');
  });
});
