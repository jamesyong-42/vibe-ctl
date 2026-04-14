import { defineConfig } from 'tsup';

// See the note in core/plugin-api/tsup.config.ts — watch-mode cleaning
// causes a DTS race across downstream watchers.
export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2024',
  platform: 'node',
  clean: !options.watch,
  sourcemap: true,
  dts: true,
  external: [
    '@vibe-ctl/plugin-api',
    '@jamesyong42/reactive-ecs',
    '@jamesyong42/infinite-canvas',
    '@vibecook/truffle',
    'chokidar',
  ],
}));
