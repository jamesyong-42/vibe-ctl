/**
 * submit — add a new plugin to the registry.
 *
 * Target flow (spec 04 §3):
 *   1. Ensure `gh` auth or a GITHUB_TOKEN is available.
 *   2. Prompt for registry entry fields (id, repo, category, etc.).
 *   3. Fetch latest release from `<repo>`, download plugin.json, validate.
 *   4. Fork vibe-ctl/plugins, branch, append the entry to plugins.json
 *      sorted alphabetically by id.
 *   5. Push, open PR with a standard body.
 *
 * Currently a stub — the end-to-end flow requires real network calls and
 * that work is deferred (see utils/github.ts).
 */

import kleur from 'kleur';
import prompts from 'prompts';

import type { RegistryEntry } from '../utils/manifest-schema.js';

export async function submitCommand(argv: string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
${kleur.bold('submit')} — open a PR adding your plugin to the registry.

${kleur.bold('Usage')}
  vibe-ctl-plugin submit

Interactive. Prompts for repo, id, category, and metadata, then opens a
PR against vibe-ctl/plugins.
`);
    return;
  }

  console.log(kleur.cyan('▸ Submit plugin to registry\n'));

  const answers = await prompts(
    [
      { type: 'text', name: 'repo', message: 'GitHub repo (owner/name)' },
      { type: 'text', name: 'id', message: 'Plugin id (must match manifest)' },
      { type: 'text', name: 'category', message: 'Category', initial: 'misc' },
      { type: 'text', name: 'description', message: 'Short description (<120 chars)' },
      { type: 'text', name: 'authorName', message: 'Author display name' },
    ],
    {
      onCancel: () => {
        console.log('Cancelled.');
        process.exit(1);
      },
    },
  );

  const draft: Partial<RegistryEntry> = {
    id: answers.id,
    repo: answers.repo,
    description: answers.description,
    category: answers.category,
    author: { name: answers.authorName },
    manifestPath: 'plugin.json',
    verified: false,
    signingKey: null,
    addedAt: new Date().toISOString().slice(0, 10),
    reviewedBy: null,
    minimumApiVersion: '^1.0.0',
    disabled: false,
    disabledReason: null,
  };

  console.log(kleur.dim('\nDraft registry entry:'));
  console.log(JSON.stringify(draft, null, 2));

  // TODO: call utils/github.ts
  //   1. await gh.validateAuthenticated()
  //   2. const release = await gh.getLatestRelease(draft.repo)
  //   3. const manifest = await gh.fetchJsonAsset(release, 'plugin.json')
  //   4. await validateManifest(manifest)
  //   5. assert manifest.id === draft.id
  //   6. await gh.forkRepo('vibe-ctl/plugins')
  //   7. await gh.createBranchWithEntry(draft)
  //   8. const prUrl = await gh.openPR({ title: `Add ${draft.id}`, body: ... })
  //   9. console.log('Opened:', prUrl)

  console.log(
    kleur.yellow('\n⚠ submit is not implemented yet. See the TODO list in src/commands/submit.ts.'),
  );
}
