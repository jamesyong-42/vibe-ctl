/**
 * Scaffold writer. Takes a context object and emits files.
 *
 * Each template module under ./templates/ exports a pure function that
 * returns file contents as a string — this module owns the "where" and
 * the templates own the "what".
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ExecutionContext } from './prompts.js';
import { gitignoreTemplate } from './templates/gitignore.js';
import { indexTsTemplate } from './templates/index.ts.js';
import { mainTsTemplate } from './templates/main.ts.js';
import { packageJsonTemplate } from './templates/package.json.js';
import { pluginJsonTemplate } from './templates/plugin.json.js';
import { readmeMdTemplate } from './templates/readme.md.js';
import { rendererTsTemplate } from './templates/renderer.ts.js';
import { tsconfigJsonTemplate } from './templates/tsconfig.json.js';
import { tsupConfigTemplate } from './templates/tsup.config.ts.js';
import { widgetTsxTemplate } from './templates/widget.tsx.js';

export interface ScaffoldContext {
  targetDir: string;
  pluginId: string;
  displayName: string;
  description: string;
  authorName: string;
  executionContext: ExecutionContext;
  includeExampleWidget: boolean;
  language: 'typescript';
}

function write(target: string, rel: string, contents: string): void {
  const full = path.join(target, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, contents, 'utf8');
}

export async function scaffold(ctx: ScaffoldContext): Promise<void> {
  // Root files, shared across all execution contexts.
  write(ctx.targetDir, 'package.json', packageJsonTemplate(ctx));
  write(ctx.targetDir, 'plugin.json', pluginJsonTemplate(ctx));
  write(ctx.targetDir, 'tsup.config.ts', tsupConfigTemplate(ctx));
  write(ctx.targetDir, 'tsconfig.json', tsconfigJsonTemplate(ctx));
  write(ctx.targetDir, 'README.md', readmeMdTemplate(ctx));
  write(ctx.targetDir, '.gitignore', gitignoreTemplate());

  // Source entry points per execution context.
  switch (ctx.executionContext) {
    case 'renderer':
      write(ctx.targetDir, 'src/index.ts', indexTsTemplate(ctx));
      break;
    case 'main':
      write(ctx.targetDir, 'src/index.ts', indexTsTemplate(ctx));
      break;
    case 'split':
      write(ctx.targetDir, 'src/main.ts', mainTsTemplate(ctx));
      write(ctx.targetDir, 'src/renderer.ts', rendererTsTemplate(ctx));
      break;
  }

  // Optional example widget. Only meaningful for renderer / split plugins.
  if (ctx.includeExampleWidget && ctx.executionContext !== 'main') {
    write(ctx.targetDir, 'src/widgets/example-widget.tsx', widgetTsxTemplate(ctx));
  }
}
