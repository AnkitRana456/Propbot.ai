import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Keeps live LLM keys out of the unit/integration suite (see tests/setup-env.ts).
    setupFiles: ['./tests/setup-env.ts'],
    // ~100 files share one dev database and create users with bcrypt; a loaded machine needs more than the 5 s default.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
