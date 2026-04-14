/**
 * prerelease — emit a BRAT-style install URL for a pre-release build.
 *
 * vibe-ctl supports a `vibe-ctl://install?repo=<owner/repo>&ref=<tag>`
 * handler that bypasses the registry. This command just formats the URL
 * for a given repo + tag, with some sanity checks.
 */

import kleur from 'kleur';
import prompts from 'prompts';

export async function prereleaseCommand(argv: string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
${kleur.bold('prerelease')} — generate a pre-release install URL.

${kleur.bold('Usage')}
  vibe-ctl-plugin prerelease

Interactive. Prompts for repo + tag, then prints a
\`vibe-ctl://install\` URL users can paste into the app to install the
pre-release without going through the registry.
`);
    return;
  }

  const answers = await prompts(
    [
      { type: 'text', name: 'repo', message: 'GitHub repo (owner/name)' },
      { type: 'text', name: 'tag', message: 'Release tag (e.g. v0.2.0-beta.1)' },
    ],
    {
      onCancel: () => {
        console.log('Cancelled.');
        process.exit(1);
      },
    },
  );

  if (!/^[^/]+\/[^/]+$/.test(answers.repo ?? '')) {
    console.error(kleur.red('✗ Expected owner/repo'));
    process.exit(1);
  }

  // TODO: optionally verify the tag exists on GitHub before emitting the URL.

  const url = `vibe-ctl://install?repo=${encodeURIComponent(answers.repo)}&ref=${encodeURIComponent(answers.tag)}`;
  console.log(`\n${kleur.bold('Install URL:')}\n  ${kleur.cyan(url)}\n`);
  console.log(
    kleur.dim(
      'Share this URL with beta testers. Clicking it opens vibe-ctl and starts an install.',
    ),
  );
}
