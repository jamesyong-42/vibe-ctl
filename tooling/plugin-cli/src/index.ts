/**
 * @vibe-ctl/plugin-cli — CLI entry.
 *
 * Usage:
 *   vibe-ctl-plugin <command> [...args]
 *
 * Commands:
 *   submit                    Fork vibe-ctl/plugins, add entry, open PR
 *   validate <plugin.json>    Validate manifest against the Zod schema
 *   check <owner/repo>        Verify latest release has required assets
 *   prerelease                Emit a BRAT-style pre-release install URL
 */

import process from 'node:process';

import kleur from 'kleur';

import { checkCommand } from './commands/check.js';
import { prereleaseCommand } from './commands/prerelease.js';
import { submitCommand } from './commands/submit.js';
import { validateCommand } from './commands/validate.js';

interface ParsedArgs {
  command: string | null;
  rest: string[];
  help: boolean;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const out: ParsedArgs = { command: null, rest: [], help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else if (out.command === null && !arg.startsWith('-')) {
      out.command = arg;
    } else {
      out.rest.push(arg);
    }
  }
  return out;
}

function printHelp(): void {
  console.log(`
${kleur.bold('vibe-ctl-plugin')} — tools for the vibe-ctl plugin registry.

${kleur.bold('Usage')}
  vibe-ctl-plugin <command> [options]

${kleur.bold('Commands')}
  submit                      Fork vibe-ctl/plugins, add entry, open PR
  validate <plugin.json>      Validate a manifest against the schema
  check <owner/repo>          Verify a repo's latest release is registry-ready
  prerelease                  Generate a BRAT-style pre-release install URL

${kleur.bold('Options')}
  -h, --help                  Show this help (pass to any subcommand for per-command help)

${kleur.bold('Docs')}
  ../../docs/specs/04-registry-marketplace.md in the vibe-ctl repo.
`);
}

type CommandHandler = (args: string[]) => Promise<void>;

const COMMANDS: Record<string, CommandHandler> = {
  submit: submitCommand,
  validate: validateCommand,
  check: checkCommand,
  prerelease: prereleaseCommand,
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help && !args.command) {
    printHelp();
    return;
  }

  if (!args.command) {
    printHelp();
    process.exit(1);
  }

  const handler = COMMANDS[args.command];
  if (!handler) {
    console.error(kleur.red(`Unknown command: ${args.command}`));
    printHelp();
    process.exit(1);
  }

  // Let subcommands see --help if requested.
  const forwarded = args.help ? ['--help', ...args.rest] : args.rest;
  await handler(forwarded);
}

main().catch((err) => {
  console.error(kleur.red('\n✗ command failed:'), err);
  process.exit(1);
});
