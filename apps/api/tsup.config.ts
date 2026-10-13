import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    server: 'src/server.ts',
    worker: 'src/worker.ts',
  },
  format: ['esm'],
  clean: true,
  sourcemap: true,
  target: 'node20',
  dts: false,
});
