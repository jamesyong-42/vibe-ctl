import type { ScaffoldContext } from '../scaffold.js';

export function tsconfigJsonTemplate(_ctx: ScaffoldContext): string {
  const tsconfig = {
    extends: '@vibe-ctl/tsconfig/plugin.json',
    compilerOptions: {
      rootDir: 'src',
      outDir: 'dist',
      jsx: 'react-jsx',
    },
    include: ['src/**/*'],
  };
  return `${JSON.stringify(tsconfig, null, 2)}\n`;
}
