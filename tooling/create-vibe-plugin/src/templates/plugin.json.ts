import type { ScaffoldContext } from '../scaffold.js';

/**
 * Emit the plugin.json manifest per spec 01 §2.
 * Keep the generated manifest minimal so authors can extend it as needed.
 */
export function pluginJsonTemplate(ctx: ScaffoldContext): string {
  const entry =
    ctx.executionContext === 'split'
      ? { main: './dist/main.js', renderer: './dist/renderer.js' }
      : './dist/index.js';

  const manifest: Record<string, unknown> = {
    $schema: 'https://vibe-ctl.dev/schemas/plugin/v1.json',
    id: ctx.pluginId,
    name: ctx.displayName,
    version: '0.1.0',
    apiVersion: '^1.0.0',
    description: ctx.description,
    ...(ctx.authorName ? { author: { name: ctx.authorName } } : {}),
    license: 'MIT',
    executionContext: ctx.executionContext,
    entry,
    eagerActivation: false,
    engines: {
      'vibe-ctl': '^1.0.0',
    },
    provides: {},
    dependencies: {},
    optionalDependencies: {},
    waitForReady: [],
    sync: {
      settings: true,
      data: [],
    },
    permissions: [],
  };

  return `${JSON.stringify(manifest, null, 2)}\n`;
}
