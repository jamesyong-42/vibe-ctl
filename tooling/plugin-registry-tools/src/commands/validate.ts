/**
 * validate — check a plugin.json against the manifest Zod schema from
 * @vibe-ctl/extension-api.
 *
 * Usage:
 *   vibe-ctl-plugin-registry validate ./plugin.json
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import kleur from 'kleur';

import { validateManifest } from '../utils/manifest-schema.js';

export async function validateCommand(argv: string[]): Promise<void> {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    console.log(`
${kleur.bold('validate')} — validate a plugin.json.

${kleur.bold('Usage')}
  vibe-ctl-plugin-registry validate <path-to-plugin.json>
`);
    if (argv.length === 0) process.exit(1);
    return;
  }

  const target = path.resolve(process.cwd(), argv[0]!);

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(target, 'utf8'));
  } catch (err) {
    console.error(kleur.red(`✗ Could not read/parse ${target}:`));
    console.error(err);
    process.exit(1);
  }

  const result = validateManifest(parsed);

  if (result.ok) {
    console.log(kleur.green('✓ Manifest is valid.'));
    console.log(kleur.dim(`  id:      ${result.value.id}`));
    console.log(kleur.dim(`  version: ${result.value.version}`));
    console.log(kleur.dim(`  context: ${result.value.executionContext}`));
    return;
  }

  console.error(kleur.red('✗ Manifest is invalid:\n'));
  for (const issue of result.issues) {
    console.error(`  ${kleur.yellow(issue.path)}: ${issue.message}`);
  }
  process.exit(1);
}
