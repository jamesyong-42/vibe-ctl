import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'tsup';
import type { Options } from 'tsup';

/**
 * Host-provided singletons that every plugin must externalize.
 * These are injected by the kernel at runtime — plugins never bundle them.
 */
export const pluginExternals = [
  '@vibe-ctl/extension-api',
  '@jamesyong42/infinite-canvas',
  '@jamesyong42/reactive-ecs',
  '@vibecook/truffle',
  'react',
  'react-dom',
];

/**
 * Copy plugin.json and assets/ into dist/ after a successful build.
 * Uses Node.js fs — works on Windows, macOS, and Linux.
 */
function copyPluginAssets(): void {
  const cwd = process.cwd();
  const dist = resolve(cwd, 'dist');

  const pluginJson = resolve(cwd, 'plugin.json');
  if (existsSync(pluginJson)) {
    cpSync(pluginJson, resolve(dist, 'plugin.json'));
  }

  const assets = resolve(cwd, 'assets');
  if (existsSync(assets)) {
    cpSync(assets, resolve(dist, 'assets'), { recursive: true });
  }
}

/**
 * Define a tsup config for a vibe-ctl plugin with sensible defaults.
 * Host-provided externals and asset copying are handled automatically.
 */
export function definePluginConfig(overrides: Partial<Options> = {}) {
  const { external: extraExternal = [], onSuccess: userOnSuccess, ...rest } = overrides;

  const mergedExternal = [
    ...pluginExternals,
    ...(Array.isArray(extraExternal) ? extraExternal : [extraExternal]),
  ];

  return defineConfig({
    format: ['esm'],
    target: 'es2024',
    clean: true,
    sourcemap: true,
    dts: false,
    ...rest,
    external: mergedExternal,
    async onSuccess() {
      copyPluginAssets();
      if (typeof userOnSuccess === 'function') {
        await userOnSuccess();
      } else if (typeof userOnSuccess === 'string') {
        const { execSync } = await import('node:child_process');
        execSync(userOnSuccess, { stdio: 'inherit' });
      }
    },
  });
}
