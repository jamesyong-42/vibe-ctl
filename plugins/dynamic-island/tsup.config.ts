import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { main: 'src/main.ts', renderer: 'src/renderer.ts' },
  format: ['esm'],
  target: 'es2022',
  clean: true,
  sourcemap: true,
  dts: false,
  external: [
    '@vibe-ctl/extension-api',
    '@jamesyong42/infinite-canvas',
    '@jamesyong42/reactive-ecs',
    '@vibecook/truffle',
    'react',
    'react-dom',
  ],
});
