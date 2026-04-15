import { defineConfig } from 'tsup';

// See the note in core/plugin-api/tsup.config.ts — watch-mode cleaning
// causes a DTS race across downstream watchers.
//
// Two entries:
//   - index: the library consumed by the shell's main process (dts emitted).
//   - kernel-utility: the utility-process entry, forked by the shell via
//     electron's utilityProcess.fork(dist/kernel-utility.js). No dts needed.
export default defineConfig((options) => [
  {
    entry: { index: 'src/index.ts' },
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
  },
  {
    entry: { 'kernel-utility': 'src/kernel-utility/entry.ts' },
    format: ['esm'],
    target: 'es2024',
    platform: 'node',
    clean: false,
    sourcemap: true,
    dts: false,
    external: [
      '@vibe-ctl/plugin-api',
      '@jamesyong42/reactive-ecs',
      '@jamesyong42/infinite-canvas',
      '@vibecook/truffle',
      'chokidar',
    ],
  },
]);
