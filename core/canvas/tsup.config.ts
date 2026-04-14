import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2024',
  clean: true,
  sourcemap: true,
  dts: true,
  external: [
    '@vibe-ctl/plugin-api',
    '@jamesyong42/infinite-canvas',
    '@jamesyong42/reactive-ecs',
    '@vibecook/truffle',
    'react',
    'react-dom',
  ],
});
