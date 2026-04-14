import type { ScaffoldContext } from '../scaffold.js';

/**
 * tsup config for a plugin. Uses the shared plugin preset from
 * @vibe-ctl/tsup-plugin-preset which handles externals, target, and
 * post-build asset copying automatically.
 */
export function tsupConfigTemplate(ctx: ScaffoldContext): string {
  const entry =
    ctx.executionContext === 'split'
      ? `{ main: 'src/main.ts', renderer: 'src/renderer.ts' }`
      : `['src/index.ts']`;

  return `import { definePluginConfig } from '@vibe-ctl/tsup-plugin-preset';

export default definePluginConfig({
  entry: ${entry},
});
`;
}
