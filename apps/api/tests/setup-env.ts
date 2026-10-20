/**
 * Tests must never call paid or external AI providers. The developer's .env may hold real keys, so
 * blank them before any module reads them (dotenv does not override variables that are already set).
 * The only live Gemini call in this repo is `pnpm --filter @propbot/api check:gemini`.
 */
for (const key of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'EMBEDDING_API_KEY']) {
  process.env[key] = '';
}
process.env.MOCK_PROVIDERS = 'true'; // use the deterministic offline grounded responder
