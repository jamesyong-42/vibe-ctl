import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2022',
  platform: 'node',
  clean: true,
  sourcemap: true,
  dts: true,
  external: [
    '@vibe-ctl/extension-api',
    '@jamesyong42/reactive-ecs',
    '@jamesyong42/infinite-canvas',
    '@vibecook/truffle',
    'chokidar',
  ],
});
