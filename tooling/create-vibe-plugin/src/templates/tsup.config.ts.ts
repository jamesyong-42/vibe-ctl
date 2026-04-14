import type { ScaffoldContext } from '../scaffold.js';

/**
 * tsup config for a plugin. Matches spec 03 §5:
 *   - host-provided modules marked external
 *   - ESM only
 *   - es2022 target (shell's Chromium + Node 24 both support it)
 */
export function tsupConfigTemplate(ctx: ScaffoldContext): string {
  const entry =
    ctx.executionContext === 'split'
      ? `{ main: 'src/main.ts', renderer: 'src/renderer.ts' }`
      : `['src/index.ts']`;

  return `import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ${entry},
  format: ['esm'],
  target: 'es2022',
  clean: true,
  sourcemap: true,
  dts: false,
  external: [
    '@vibe-ctl/extension-api',
    'react',
    'react-dom',
    '@jamesyong42/infinite-canvas',
    '@jamesyong42/reactive-ecs',
    '@vibecook/truffle',
  ],
});
`;
}
