import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', phone: 'src/utils/phone.ts' },
  format: ['esm'],
  dts: false,
  clean: false,
  sourcemap: true,
  treeshake: true,
});
