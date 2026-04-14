import { defineConfig } from 'tsup';

// `clean` wipes dist/ at the start of every run. In watch mode that wipe
// races against downstream watchers (runtime, canvas, shell) that resolve
// types from this package — they'd see a missing .d.ts during the gap
// before tsup re-emits. One-shot builds still clean for determinism.
export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2022',
  clean: !options.watch,
  sourcemap: true,
  dts: true,
}));
