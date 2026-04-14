import type { ScaffoldContext } from '../scaffold.js';

export function packageJsonTemplate(ctx: ScaffoldContext): string {
  const pkg: Record<string, unknown> = {
    name: ctx.pluginId,
    version: '0.1.0',
    private: true,
    type: 'module',
    description: ctx.description,
    license: 'MIT',
    scripts: {
      build:
        ctx.executionContext === 'split'
          ? 'tsup && cp plugin.json dist/'
          : 'tsup && cp plugin.json dist/',
      dev: 'tsup --watch',
      typecheck: 'tsc --noEmit',
      clean: 'rm -rf dist .turbo',
    },
    peerDependencies: {
      '@vibe-ctl/extension-api': '^1.0.0',
      react: '^19.0.0',
      '@vibecook/truffle': '^0.4.2',
      '@jamesyong42/reactive-ecs': '^0.1.0',
    },
    devDependencies: {
      '@types/react': '^19.0.0',
      '@vibe-ctl/extension-api': '^1.0.0',
      '@vibe-ctl/tsconfig': '^1.0.0',
      react: '^19.0.0',
      tsup: '^8.3.0',
      typescript: '^5.7.0',
      zod: '^3.23.0',
    },
  };

  if (ctx.authorName) {
    pkg.author = ctx.authorName;
  }

  return `${JSON.stringify(pkg, null, 2)}\n`;
}
