/**
 * @vibe-ctl/create-plugin — CLI entry.
 *
 * Usage:
 *   npx @vibe-ctl/create-plugin [plugin-name] [--yes]
 *
 * Flow:
 *   1. Parse argv (positional plugin name; `--yes` skips prompts).
 *   2. Prompt for execution context, widget opt-in, etc.
 *   3. Create target dir (refuse to clobber a non-empty dir).
 *   4. Emit files from templates in ./templates.
 *   5. Print "next steps".
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import kleur from 'kleur';

import { runPrompts } from './prompts.js';
import type { ScaffoldContext } from './scaffold.js';
import { scaffold } from './scaffold.js';

interface ParsedArgs {
  positional: string | null;
  yes: boolean;
  help: boolean;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const out: ParsedArgs = { positional: null, yes: false, help: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--yes' || arg === '-y') out.yes = true;
    else if (!arg.startsWith('-') && out.positional === null) out.positional = arg;
  }
  return out;
}

function printHelp(): void {
  console.log(`
${kleur.bold('@vibe-ctl/create-plugin')} — scaffold a new vibe-ctl plugin.

${kleur.bold('Usage')}
  npx @vibe-ctl/create-plugin ${kleur.dim('[plugin-name]')} ${kleur.dim('[--yes]')}

${kleur.bold('Arguments')}
  plugin-name        Target directory + default plugin id (prompted if omitted)

${kleur.bold('Options')}
  -y, --yes          Accept all defaults, skip prompts
  -h, --help         Show this help

${kleur.bold('Example')}
  npx @vibe-ctl/create-plugin my-awesome-plugin
`);
}

function deriveIdFromFolder(folder: string): string {
  const base = path.basename(folder);
  return base.startsWith('@') ? base : base.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
}

function deriveNameFromId(id: string): string {
  const lastSegment = id.includes('/') ? id.split('/').pop()! : id;
  return lastSegment
    .replace(/^vibe-ctl-plugin-/, '')
    .replace(/^plugin-/, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}

function dirIsEmpty(dir: string): boolean {
  if (!existsSync(dir)) return true;
  return readdirSync(dir).length === 0;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  console.log(kleur.bold().cyan('\n▸ @vibe-ctl/create-plugin\n'));

  const answers = await runPrompts({
    suggestedName: args.positional,
    skipPrompts: args.yes,
  });

  const targetDir = path.resolve(process.cwd(), answers.targetDir);

  if (existsSync(targetDir) && !dirIsEmpty(targetDir)) {
    console.error(
      kleur.red(`\n✗ Target directory "${answers.targetDir}" exists and is not empty. Aborting.`),
    );
    process.exit(1);
  }

  mkdirSync(targetDir, { recursive: true });

  const pluginId = answers.pluginId || deriveIdFromFolder(targetDir);
  const displayName = answers.displayName || deriveNameFromId(pluginId);

  const ctx: ScaffoldContext = {
    targetDir,
    pluginId,
    displayName,
    description: answers.description,
    authorName: answers.authorName,
    executionContext: answers.executionContext,
    includeExampleWidget: answers.includeExampleWidget,
    // TypeScript only for now; JS variant is a future extension point.
    language: 'typescript',
  };

  await scaffold(ctx);

  console.log(kleur.green('\n✓ Plugin scaffolded.\n'));
  console.log(kleur.bold('Next steps:'));
  console.log(`  ${kleur.cyan(`cd ${answers.targetDir}`)}`);
  console.log(`  ${kleur.cyan('pnpm install')}`);
  console.log(`  ${kleur.cyan('pnpm dev')}`);
  console.log(
    `\n${kleur.dim('Point vibe-ctl at this folder by setting')} ${kleur.cyan(
      'VIBE_CTL_DEV_PLUGINS',
    )} ${kleur.dim('to its absolute path.')}\n`,
  );
}

main().catch((err) => {
  console.error(kleur.red('\n✗ @vibe-ctl/create-plugin failed:'), err);
  process.exit(1);
});
