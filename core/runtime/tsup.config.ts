import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2024',
  platform: 'node',
  clean: true,
  sourcemap: true,
  dts: true,
  external: [
    '@vibe-ctl/plugin-api',
    '@jamesyong42/reactive-ecs',
    '@jamesyong42/infinite-canvas',
    '@vibecook/truffle',
    'chokidar',
  ],
});
