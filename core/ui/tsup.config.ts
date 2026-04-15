import { defineConfig } from 'tsup';

// Watch-mode cleaning causes a DTS race across downstream watchers —
// keep `clean` off in watch mode (same trick as core/plugin-api).
export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2024',
  clean: !options.watch,
  sourcemap: true,
  dts: true,
  external: ['@vibe-ctl/plugin-api', '@vibe-ctl/canvas', 'react', 'react-dom', 'react/jsx-runtime'],
}));
