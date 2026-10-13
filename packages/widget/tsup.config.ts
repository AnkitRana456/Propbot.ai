import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    widget: 'src/index.ts',
  },
  format: ['esm', 'iife'],
  globalName: 'PropBotWidget',
  dts: false,
  clean: true,
  sourcemap: true,
  minify: false,
});
